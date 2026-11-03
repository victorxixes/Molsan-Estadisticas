/* ============================================================
   MOLSAN ERP — GLASS LUXE 2027
   MOTOR PRINCIPAL DE MÓDULOS + Motion 2027 + UX Premium
============================================================ */

async function cargarModulo(nombre) {

    /* ============================================================
       🔒 BLOQUEO ANTI-RECURSIVIDAD
    ============================================================ */
    if (window.__MODULO_CARGANDO__) {
        console.warn("⛔ cargarModulo() ignorado: ya está ejecutándose.");
        return;
    }
    window.__MODULO_CARGANDO__ = true;

    /* ============================================================
       1. MARCAR ITEM ACTIVO EN SIDEBAR
    ============================================================ */
    document.querySelectorAll(".menu-item").forEach(i => i.classList.remove("active"));

    const item = [...document.querySelectorAll(".menu-item")]
        .find(i => i.getAttribute("onclick")?.includes(nombre));

    if (item) item.classList.add("active");


    /* ============================================================
       2. OBTENER PLANTILLA Y CONTENEDOR
    ============================================================ */
    const tpl   = document.getElementById(`tpl-${nombre}`);
    const cont  = document.getElementById("module-container");
    const title = document.getElementById("module-title");

    if (!tpl || !cont) {
        console.error("❌ No se encontró el módulo:", nombre);
        window.__MODULO_CARGANDO__ = false; // 🔓 desbloqueo
        return;
    }


    /* ============================================================
       3. EFECTO DE TRANSICIÓN (Motion 2027)
    ============================================================ */
    cont.classList.remove("fadeUp");
    cont.style.opacity = 0;

    // Insertamos la plantilla SIN meter la lógica en otro setTimeout
    cont.innerHTML = "";
    cont.appendChild(tpl.content.cloneNode(true));
    cont.classList.add("fadeUp");
    cont.style.opacity = 1;


    /* ============================================================
       4. TÍTULOS BONITOS — GLASS LUXE 2027
    ============================================================ */
    if (title) {
        const nombresBonitos = {

            /* CORE */
            "dashboard-premium": "Dashboard Premium",
            "listado":            "Listado de Firmas",
            "ctn":                "Catálogo notarial CTN",
            "uploader":           "Importación de Excel",
            "permisos":           "Permisos del Sistema",
            "backup":             "Backup de Datos",
            "restore":            "Restauración de Backups",
            "informes-premium":   "Informes Premium",
            "informe-evolutivo":  "Informe Evolutivo",
            "acta-reunion":       "Acta de reunión",

            /* PANELES PREMIUM */
            "panel-anual":        "Panel Anual",
            "panel-mensual":      "Panel Mensual",
            "panel-apoderados":   "Panel Apoderados",
            "panel-tipo-firma":   "Panel Tipo de Firma",
            "panel-tipo-gestion": "Panel Tipo de Gestión",
            "panel-oficinas":     "Panel Oficinas",
            "panel-circuito":     "Panel Circuito Notarial",
            "panel-tipo-centroquefirma": "Panel Centro que Firma",
            "panel-sla":          "Panel SLA / Tiempos"
        };

        title.textContent = nombresBonitos[nombre] || nombre;
    }


    /* ============================================================
       5. INICIALIZAR MÓDULO (DESPUÉS DE INSERTAR HTML)
    ============================================================ */
    try {

        switch (nombre) {

            /* ============================
               CORE
            ============================ */

case "dashboard": {
    await initDashboard();   // ← tu nuevo dashboard
    break;
}
            case "listado":
                await initListado();
                break;

            case "ctn":
                await initCtnModule();
                break;

            case "acta-reunion":
                await initActaReunion();
                break;

            case "uploader":
                initUploader();
                break;

            case "permisos":
                initPermisos();
                break;

            case "backup":
                await initBackup();
                break;

            case "restore":
                await initRestore();
                break;

            case "informes-premium":
                await initInformesPremium();
                break;

case "informe-evolutivo":
    await initInformeEvolutivo();
    break;

            /* ============================
               PANELES PREMIUM
            ============================ */

            case "panel-anual":
                await initPanelAnual();
                break;


            case "panel-apoderados":
                await initPanelApoderados();
                break;

            case "panel-tipo-firma":
                await initPanelTipoFirma();
                break;

            case "panel-tipo-gestion":
                await initPanelTipoGestion();
                break;

            case "panel-oficinas":
                await initPanelOficinas();
                break;

            case "panel-circuito":
                await initPanelCircuito();
                break;

            case "panel-tipo-centroquefirma":
                await initPanelTipoCentroQueFirma();
                break;

            case "panel-sla":
                await initPanelSLA();
                break;
        }

    } catch (err) {
        console.error("❌ Error cargando el módulo:", nombre, err);
        cont.innerHTML = `
            <div class="card-glass error-box fadeUp">
                <h3>Error cargando el módulo</h3>
                <p>${err.message}</p>
            </div>
        `;
    } finally {
        // 🔓 desbloqueo final del módulo SIEMPRE fuera de cualquier setTimeout
        window.__MODULO_CARGANDO__ = false;
    }


    /* ============================================================
       6. APLICAR PERMISOS
    ============================================================ */
    aplicarPermisos();
}


/* ============================================================
   INICIALIZACIÓN GLOBAL — GLASS LUXE 2027
============================================================ */
window.addEventListener("DOMContentLoaded", async () => {

    await initDB();

    const estado = localStorage.getItem("molsan_sidebar") === "collapsed";
    aplicarEstadoSidebar(estado);

    // ✔ Cargar Dashboard Premium por defecto
    cargarModulo("dashboard");
});


/* ============================================================
   RESET COMPLETO DEL SISTEMA — BORRAR INDEXEDDB
============================================================ */

function molsan_resetDB() {

    const confirmar = confirm(
        "⚠️ ATENCIÓN\n\n" +
        "Esto borrará TODOS los datos del ERP:\n" +
        "• Firmas\n" +
        "• Informes\n" +
        "• Evolutivo\n" +
        "• Paneles premium\n\n" +
        "¿Seguro que quieres continuar?"
    );

    if (!confirmar) return;

    indexedDB.deleteDatabase("molsan_db");

    alert("🧹 Sistema reiniciado correctamente.\n\nEl ERP está limpio y listo para importar nuevos datos.");

    location.reload();
}
