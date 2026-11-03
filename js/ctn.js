/* ============================================================
   CTN — Catálogo notarial + importador Excel seguro
   Persistencia remota en Supabase. Este módulo no utiliza IndexedDB.
============================================================ */
(() => {
    const PAGE_SIZE = 15;
    const FIELDS = [
        ["codigo", "Código", true], ["nombre", "Nombre", true], ["apellidos", "Apellidos", true],
        ["nif", "NIF"], ["telefono", "Teléfono"], ["provincia", "Provincia"], ["municipio", "Municipio"],
        ["cp", "Código postal"], ["direccion", "Dirección"], ["vc", "Videoconferencia"],
        ["apoderado", "Apoderado"], ["apoderado_s", "Apoderado S"],
        ["departamento_cancelaciones", "Departamento cancelaciones"],
        ["departamento_copias", "Departamento copias"], ["otros_departamentos", "Otros departamentos"],
        ["observacion", "Observaciones"]
    ];
    const HEADER_MAP = {
        codigo:"codigo", nombre:"nombre", apellidos:"apellidos", nif:"nif", telefono:"telefono",
        "departamento cancelaciones":"departamento_cancelaciones",
        "departamento copias":"departamento_copias", "otros departamentos":"otros_departamentos",
        cp:"cp", provincia:"provincia", municipio:"municipio", direccion:"direccion", vc:"vc",
        apoderado:"apoderado", "apoderado s":"apoderado_s", observacion:"observacion"
    };
    const SORT_FIELDS = new Set(["codigo","nombre","apellidos","nif","provincia","municipio","vc","apoderado"]);
    const state = {
        root:null, client:null, page:1, total:0,
        filters:{q:"",provincia:"",municipio:"",vc:""},
        sort:{field:"apellidos",ascending:true},
        importRows:null, importFile:null, selected:null, busy:false
    };

    function esc(v) {
        return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({
            "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
        }[c]));
    }
    function clean(v) { return v == null ? "" : String(v).trim(); }
    function norm(v) { return clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(); }
    function vc(v) {
        const value = norm(v).replace(/[\s_-]/g,"");
        return ["si","s","vc","videoconferencia","videoconference","true","1"].includes(value)
            ? "VideoConferencia" : "Presencial";
    }
    function db() {
        if (!state.client) state.client = window.getMolsanSupabase();
        return state.client;
    }
    function message(el, text, kind) {
        if (!el) return;
        el.innerHTML = '<div class="ctn-alert ctn-alert-' + (kind || "info") + '">' + esc(text) + '</div>';
    }

    async function initCtnModule() {
        state.root = document.getElementById("ctn-root");
        if (!state.root) return;
        try {
            const result = await db().auth.getSession();
            if (result.error) throw result.error;
            if (!result.data.session) { renderLogin(); return; }
            renderApp();
            await loadPage(1);
        } catch (error) { renderLogin(error.message || "No se ha podido iniciar la conexión."); }
    }

    function renderLogin(errorText) {
        const auth = state.root.querySelector("#ctn-auth");
        const app = state.root.querySelector("#ctn-app");
        if (app) app.hidden = true;
        auth.hidden = false;
        auth.innerHTML = '<div class="ctn-login-card">' +
            '<div class="ctn-mark">CTN</div><div><p class="ctn-eyebrow">MOLSAN · ESTADÍSTICAS</p>' +
            '<h2>Acceso al catálogo notarial</h2><p class="ctn-muted">Inicia sesión para consultar y administrar el catálogo privado.</p></div>' +
            '<form id="ctn-login-form" class="ctn-form-grid">' +
            '<label>Correo electrónico<input class="m-input" name="email" type="email" autocomplete="username" required></label>' +
            '<label>Contraseña<input class="m-input" name="password" type="password" autocomplete="current-password" required></label>' +
            '<div id="ctn-login-error" class="ctn-form-message" aria-live="polite">' + esc(errorText || "") + '</div>' +
            '<button class="m-btn m-btn-primary m-btn-round" type="submit">Entrar</button></form></div>';
        auth.querySelector("#ctn-login-form").addEventListener("submit", async event => {
            event.preventDefault();
            const form = event.currentTarget;
            const button = form.querySelector("button[type=submit]");
            const info = auth.querySelector("#ctn-login-error");
            button.disabled = true;
            info.textContent = "Verificando acceso…";
            try {
                const result = await db().auth.signInWithPassword({
                    email:clean(form.elements.email.value), password:form.elements.password.value
                });
                if (result.error) throw result.error;
                await initCtnModule();
            } catch (error) { info.textContent = error.message || "No se ha podido iniciar sesión."; }
            finally { button.disabled = false; }
        });
    }

    function renderApp() {
        state.root.querySelector("#ctn-auth").hidden = true;
        state.root.querySelector("#ctn-app").hidden = false;
        if (state.root.dataset.ctnBound === "1") return;
        state.root.dataset.ctnBound = "1";

        state.root.addEventListener("click", async event => {
            const action = event.target.closest("[data-ctn-action]");
            const sort = event.target.closest("[data-ctn-sort]");
            try {
                if (sort) {
                    const field = sort.dataset.ctnSort;
                    if (!SORT_FIELDS.has(field)) return;
                    state.sort = {field,ascending:state.sort.field === field ? !state.sort.ascending : true};
                    await loadPage(1);
                    return;
                }
                if (!action) return;
                const name = action.dataset.ctnAction;
                if (name === "refresh") await loadPage(state.page);
                else if (name === "logout") { await db().auth.signOut(); renderLogin(); }
                else if (name === "new") openEdit(null);
                else if (name === "import-toggle") toggleImport();
                else if (name === "detail") await openDetail(Number(action.dataset.id));
                else if (name === "edit") openEdit(state.selected);
                else if (name === "close-modal") closeModal();
                else if (name === "prev") await loadPage(Math.max(1,state.page-1));
                else if (name === "next") await loadPage(Math.min(Math.ceil(state.total/PAGE_SIZE),state.page+1));
                else if (name === "first") await loadPage(1);
                else if (name === "last") await loadPage(Math.max(1,Math.ceil(state.total/PAGE_SIZE)));
                else if (name === "preview-import") await previewImport();
                else if (name === "confirm-import") await confirmImport();
                else if (name === "cancel-import") resetImport();
            } catch (error) {
                message(state.root.querySelector("#ctn-operation-message"),error.message || "No se ha podido completar la operación.","error");
            }
        });

        state.root.addEventListener("submit", async event => {
            if (event.target.id === "ctn-filter-form") {
                event.preventDefault();
                const form = event.target;
                state.filters = {
                    q:clean(form.elements.q.value), provincia:clean(form.elements.provincia.value),
                    municipio:clean(form.elements.municipio.value), vc:clean(form.elements.vc.value)
                };
                await loadPage(1);
            } else if (event.target.id === "ctn-edit-form") {
                event.preventDefault();
                await saveEdit(event.target);
            }
        });
    }

    async function loadPage(page) {
        if (state.busy) return;
        state.busy = true;
        const body = state.root.querySelector("#ctn-table-body");
        const status = state.root.querySelector("#ctn-operation-message");
        body.innerHTML = '<tr><td colspan="9" class="ctn-empty">Cargando catálogo…</td></tr>';
        try {
            let query = db().from("ctn_notarios").select(
                "id,codigo,nombre,apellidos,nif,telefono,provincia,municipio,cp,direccion,vc,apoderado,apoderado_s,departamento_cancelaciones,departamento_copias,otros_departamentos,observacion",
                {count:"exact"}
            );
            const q = state.filters.q.replace(/[,%()\\]/g," ").replace(/[%_]/g,"").trim();
            if (q) query = query.or("codigo.ilike.%" + q + "%,nombre.ilike.%" + q + "%,apellidos.ilike.%" + q + "%,nif.ilike.%" + q + "%");
            if (state.filters.provincia) query = query.ilike("provincia","%" + state.filters.provincia + "%");
            if (state.filters.municipio) query = query.ilike("municipio","%" + state.filters.municipio + "%");
            if (state.filters.vc === "si") query = query.eq("vc","VideoConferencia");
            if (state.filters.vc === "no") query = query.eq("vc","Presencial");
            const from = (page-1)*PAGE_SIZE;
            const result = await query.order(state.sort.field,{ascending:state.sort.ascending,nullsFirst:false}).range(from,from+PAGE_SIZE-1);
            if (result.error) throw result.error;
            state.page = page;
            state.total = result.count || 0;
            renderRows(result.data || []);
            renderSummary();
            status.innerHTML = "";
        } catch (error) {
            body.innerHTML = '<tr><td colspan="9" class="ctn-empty">No se ha podido cargar el catálogo.</td></tr>';
            message(status,error.message || "Error al consultar Supabase.","error");
        } finally { state.busy = false; }
    }

    function renderRows(rows) {
        const body = state.root.querySelector("#ctn-table-body");
        if (!rows.length) { body.innerHTML = '<tr><td colspan="9" class="ctn-empty">No hay notarios que coincidan con los filtros.</td></tr>'; return; }
        body.innerHTML = rows.map(item =>
            '<tr><td>' + esc(item.codigo) + '</td><td><strong>' +
            esc([item.nombre,item.apellidos].filter(Boolean).join(" ")) + '</strong></td><td>' +
            esc(item.nif || "—") + '</td><td>' + esc(item.municipio || "—") + '</td><td>' +
            esc(item.provincia || "—") + '</td><td><span class="ctn-badge ' +
            (item.vc === "VideoConferencia" ? "is-vc" : "") + '">' +
            (item.vc === "VideoConferencia" ? "Videoconferencia" : "Presencial") +
            '</span></td><td>' + esc(item.apoderado || "—") + '</td><td>' +
            esc(item.telefono || "—") + '</td><td><button class="m-btn m-btn-soft m-btn-round ctn-small-btn" type="button" data-ctn-action="detail" data-id="' +
            item.id + '">Ver ficha</button></td></tr>'
        ).join("");
    }

    function renderSummary() {
        const pages = Math.max(1,Math.ceil(state.total/PAGE_SIZE));
        const from = state.total ? (state.page-1)*PAGE_SIZE+1 : 0;
        const to = Math.min(state.page*PAGE_SIZE,state.total);
        state.root.querySelector("#ctn-total").textContent = state.total.toLocaleString("es-ES");
        state.root.querySelector("#ctn-page-label").textContent = "Página " + state.page + " de " + pages;
        state.root.querySelector("#ctn-range").textContent = "Mostrando " + from + "–" + to + " de " + state.total.toLocaleString("es-ES");
        state.root.querySelector('[data-ctn-action="prev"]').disabled = state.page <= 1;
        state.root.querySelector('[data-ctn-action="first"]').disabled = state.page <= 1;
        state.root.querySelector('[data-ctn-action="next"]').disabled = state.page >= pages;
        state.root.querySelector('[data-ctn-action="last"]').disabled = state.page >= pages;
    }

    async function openDetail(id) {
        const result = await db().from("ctn_notarios").select("*").eq("id",id).single();
        if (result.error) throw result.error;
        state.selected = result.data;
        const links = await db().from("ctn_notarios_asociados").select("asociado_id").eq("notario_id",id);
        if (links.error) throw links.error;
        const ids = (links.data || []).map(row => row.asociado_id);
        let associated = [];
        if (ids.length) {
            const found = await db().from("ctn_notarios").select("id,nombre,apellidos,nif").in("id",ids).order("apellidos");
            if (found.error) throw found.error;
            associated = found.data || [];
        }
        const fields = [
            ["Código",result.data.codigo],["Nombre",result.data.nombre],["Apellidos",result.data.apellidos],
            ["NIF",result.data.nif],["Teléfono",result.data.telefono],["Provincia",result.data.provincia],
            ["Municipio",result.data.municipio],["CP",result.data.cp],["Dirección",result.data.direccion],
            ["Videoconferencia",result.data.vc],["Apoderado",result.data.apoderado],["Apoderado S",result.data.apoderado_s],
            ["Departamento cancelaciones",result.data.departamento_cancelaciones],
            ["Departamento copias",result.data.departamento_copias],["Otros departamentos",result.data.otros_departamentos],
            ["Observaciones",result.data.observacion]
        ];
        const modal = state.root.querySelector("#ctn-modal");
        modal.hidden = false;
        modal.innerHTML = '<div class="ctn-modal-card" role="dialog" aria-modal="true" aria-labelledby="ctn-modal-title">' +
            '<div class="ctn-modal-header"><div><p class="ctn-eyebrow">FICHA CTN · ID ' + result.data.id +
            '</p><h2 id="ctn-modal-title">' + esc([result.data.nombre,result.data.apellidos].filter(Boolean).join(" ")) +
            '</h2></div><button type="button" class="ctn-modal-close" data-ctn-action="close-modal" aria-label="Cerrar">×</button></div>' +
            '<div class="ctn-detail-grid">' + fields.map(pair =>
                '<div class="ctn-detail-field"><span>' + esc(pair[0]) + '</span><strong>' + esc(pair[1] || "—") + '</strong></div>'
            ).join("") + '</div><section class="ctn-associations"><h3>Notarios asociados</h3>' +
            (associated.length ? '<ul>' + associated.map(item => '<li>' +
                esc([item.nombre,item.apellidos].filter(Boolean).join(" ")) +
                (item.nif ? ' · ' + esc(item.nif) : '') + '</li>').join("") + '</ul>' :
                '<p class="ctn-muted">No hay asociaciones registradas.</p>') +
            '</section><div class="ctn-modal-actions"><button type="button" class="m-btn m-btn-soft m-btn-round" data-ctn-action="close-modal">Cerrar</button>' +
            '<button type="button" class="m-btn m-btn-primary m-btn-round" data-ctn-action="edit">Editar ficha</button></div></div>';
    }

    function closeModal() {
        const modal = state.root.querySelector("#ctn-modal");
        modal.hidden = true;
        modal.innerHTML = "";
        state.selected = null;
    }

    function openEdit(item) {
        state.selected = item || null;
        const values = item || {};
        const modal = state.root.querySelector("#ctn-modal");
        modal.hidden = false;
        const inputs = FIELDS.map(field => {
            const key = field[0], label = field[1], required = !!field[2];
            if (key === "vc") return '<label>' + label + '<select name="vc" class="m-input"><option value="Presencial" ' +
                (values.vc !== "VideoConferencia" ? "selected" : "") + '>Presencial</option><option value="VideoConferencia" ' +
                (values.vc === "VideoConferencia" ? "selected" : "") + '>Videoconferencia</option></select></label>';
            if (key === "observacion") return '<label class="ctn-edit-full">' + label + '<textarea name="' + key +
                '" class="m-input" rows="3">' + esc(values[key] || "") + '</textarea></label>';
            return '<label>' + label + (required ? " *" : "") + '<input name="' + key + '" class="m-input" value="' +
                esc(values[key] || "") + '"' + (required ? " required" : "") + (key === "codigo" ? ' maxlength="80"' : "") + '></label>';
        }).join("");
        modal.innerHTML = '<div class="ctn-modal-card ctn-modal-card-wide" role="dialog" aria-modal="true" aria-labelledby="ctn-edit-title">' +
            '<div class="ctn-modal-header"><div><p class="ctn-eyebrow">ADMINISTRACIÓN CTN</p><h2 id="ctn-edit-title">' +
            (item ? "Editar ficha notarial" : "Nuevo registro CTN") + '</h2></div>' +
            '<button type="button" class="ctn-modal-close" data-ctn-action="close-modal" aria-label="Cerrar">×</button></div>' +
            '<form id="ctn-edit-form"><div class="ctn-edit-grid">' + inputs + '</div>' +
            '<div id="ctn-edit-message" class="ctn-form-message" aria-live="polite"></div>' +
            '<div class="ctn-modal-actions"><button type="button" class="m-btn m-btn-soft m-btn-round" data-ctn-action="close-modal">Cancelar</button>' +
            '<button type="submit" class="m-btn m-btn-primary m-btn-round">Guardar ficha</button></div></form></div>';
    }

    async function saveEdit(form) {
        const button = form.querySelector('button[type="submit"]');
        const info = form.querySelector("#ctn-edit-message");
        button.disabled = true;
        info.textContent = "Guardando…";
        const payload = {};
        FIELDS.forEach(field => { payload[field[0]] = clean(form.elements[field[0]].value); });
        payload.vc = vc(payload.vc);
        if (!payload.codigo || !payload.nombre || !payload.apellidos) {
            info.textContent = "Código, nombre y apellidos son obligatorios.";
            button.disabled = false;
            return;
        }
        try {
            const result = state.selected && state.selected.id
                ? await db().from("ctn_notarios").update(payload).eq("id",state.selected.id).select("id").single()
                : await db().from("ctn_notarios").insert(payload).select("id").single();
            if (result.error) throw result.error;
            closeModal();
            await loadPage(state.page);
            message(state.root.querySelector("#ctn-operation-message"),"Ficha guardada correctamente.","success");
        } catch (error) { info.textContent = error.message || "No se ha podido guardar la ficha."; }
        finally { button.disabled = false; }
    }

    function toggleImport() {
        const panel = state.root.querySelector("#ctn-import-panel");
        panel.hidden = !panel.hidden;
        if (!panel.hidden) panel.scrollIntoView({behavior:"smooth",block:"nearest"});
    }

    async function previewImport() {
        const input = state.root.querySelector("#ctn-excel-file");
        const file = input.files && input.files[0];
        const box = state.root.querySelector("#ctn-import-result");
        if (!file) throw new Error("Selecciona un fichero Excel.");
        if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) throw new Error("El fichero debe ser Excel (.xlsx, .xlsm o .xls).");
        if (file.size > 15*1024*1024) throw new Error("El fichero supera el límite de 15 MB.");
        message(box,"Leyendo y validando el Excel…");
        const rows = await parseExcel(file);
        state.importFile = file;
        state.importRows = rows;
        const existing = await getExistingCodes();
        let updates = 0, inserts = 0;
        rows.forEach(row => { if (existing.has(norm(row.codigo))) updates++; else inserts++; });
        let preview = rows.slice(0,8).map(row => '<tr><td>' + esc(row.codigo) + '</td><td>' + esc(row.nombre) +
            '</td><td>' + esc(row.apellidos) + '</td><td>' + esc(row.provincia) + '</td><td>' + esc(row.vc) + '</td></tr>').join("");
        box.innerHTML = '<div class="ctn-import-summary"><div><span>Filas válidas</span><strong>' +
            rows.length.toLocaleString("es-ES") + '</strong></div><div><span>Nuevas</span><strong>' +
            inserts.toLocaleString("es-ES") + '</strong></div><div><span>Se actualizarán</span><strong>' +
            updates.toLocaleString("es-ES") + '</strong></div></div>' +
            '<p class="ctn-muted">La actualización se realiza por Código. No borrará registros ausentes ni modificará asociaciones.</p>' +
            '<div class="ctn-preview-scroll"><table class="table-premium"><thead><tr><th>Código</th><th>Nombre</th><th>Apellidos</th><th>Provincia</th><th>VC</th></tr></thead><tbody>' +
            preview + '</tbody></table></div>' + (rows.length > 8 ? '<p class="ctn-muted">Vista previa de 8 de ' + rows.length + ' filas.</p>' : "") +
            '<div class="ctn-import-actions"><button type="button" class="m-btn m-btn-soft m-btn-round" data-ctn-action="cancel-import">Cancelar</button>' +
            '<button type="button" class="m-btn m-btn-primary m-btn-round" data-ctn-action="confirm-import">Confirmar importación segura</button></div>';
    }

    async function parseExcel(file) {
        if (!window.XLSX) throw new Error("No está disponible el lector de Excel.");
        const workbook = XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw new Error("El libro Excel no contiene una hoja de datos.");
        const matrix = XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:false});
        const headerIndex = matrix.findIndex(row => row.some(cell => norm(cell) === "codigo"));
        if (headerIndex < 0) throw new Error("No se encuentra la cabecera «Código».");
        const headers = matrix[headerIndex].map(norm);
        const missing = ["codigo","nombre","apellidos"].filter(key => !headers.includes(key));
        if (missing.length) throw new Error("Faltan columnas obligatorias: " + missing.join(", ") + ".");
        const records = [], seen = new Set(), errors = [];
        for (let i=headerIndex+1;i<matrix.length;i++) {
            const row = matrix[i] || [];
            if (row.every(value => clean(value) === "")) continue;
            const record = {};
            headers.forEach((header,index) => { if (HEADER_MAP[header]) record[HEADER_MAP[header]] = clean(row[index]); });
            record.codigo = clean(record.codigo);
            if (!record.codigo) { errors.push("Fila " + (i+1) + ": falta el Código."); continue; }
            const key = norm(record.codigo);
            if (seen.has(key)) { errors.push("Fila " + (i+1) + ": código duplicado «" + record.codigo + "»."); continue; }
            seen.add(key);
            record.vc = vc(record.vc);
            records.push(record);
        }
        if (errors.length) throw new Error(errors.length + " incidencia(s). " + errors.slice(0,8).join(" ") +
            (errors.length > 8 ? " Revisa también el resto de filas." : ""));
        if (!records.length) throw new Error("No hay registros CTN válidos para importar.");
        return records;
    }

    async function getExistingCodes() {
        const codes = new Set(), chunk = 1000;
        for (let from=0;;from+=chunk) {
            const result = await db().from("ctn_notarios").select("codigo").order("id").range(from,from+chunk-1);
            if (result.error) throw result.error;
            (result.data || []).forEach(row => codes.add(norm(row.codigo)));
            if (!result.data || result.data.length < chunk) break;
        }
        return codes;
    }

    async function confirmImport() {
        if (!state.importRows || !state.importFile) throw new Error("Primero valida un fichero Excel.");
        const box = state.root.querySelector("#ctn-import-result");
        const button = state.root.querySelector('[data-ctn-action="confirm-import"]');
        if (button) button.disabled = true;
        message(box,"Importando en Supabase. No cierres esta ventana…");
        try {
            const result = await db().rpc("importar_ctn_excel",{
                p_nombre_fichero:state.importFile.name,p_registros:state.importRows
            });
            if (result.error) throw result.error;
            const summary = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
            box.innerHTML = '<div class="ctn-alert ctn-alert-success"><strong>Importación completada.</strong><span>' +
                Number(summary.leidos || 0).toLocaleString("es-ES") + ' registros leídos · ' +
                Number(summary.insertados || 0).toLocaleString("es-ES") + ' nuevos · ' +
                Number(summary.actualizados || 0).toLocaleString("es-ES") + ' actualizados.</span>' +
                '<span>Los registros ausentes en el Excel se han conservado.</span></div>' +
                '<button type="button" class="m-btn m-btn-primary m-btn-round" data-ctn-action="cancel-import">Cerrar resumen</button>';
            state.importRows = null;
            state.importFile = null;
            state.root.querySelector("#ctn-excel-file").value = "";
            await loadPage(1);
        } catch (error) { message(box,error.message || "No se ha podido importar el fichero.","error"); }
        finally {
            const current = state.root.querySelector('[data-ctn-action="confirm-import"]');
            if (current) current.disabled = false;
        }
    }

    function resetImport() {
        state.importRows = null;
        state.importFile = null;
        const input = state.root.querySelector("#ctn-excel-file");
        const box = state.root.querySelector("#ctn-import-result");
        if (input) input.value = "";
        if (box) box.innerHTML = "";
    }

    window.initCtnModule = initCtnModule;
})();
