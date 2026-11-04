/* Supabase-first app: business data is never persisted in IndexedDB or localStorage. */
const SUPABASE_URL="https://agiagymgogwikxfounqd.supabase.co", SUPABASE_KEY="sb_publishable_yYgXI13ysOjotMc8ml67zQ_JJW-L7YW", OWNER="victor.tomas.c@gmail.com";
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,storage:sessionStorage,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const catalogs=[["estadisticas_apoderados","Apoderados"],["estadisticas_centros","Centros"],["estadisticas_circuitos","Circuitos"],["estadisticas_tipos_firma","Tipos de firma"],["estadisticas_oficinas","Oficinas"],["estadisticas_tipos_entidad","Tipos de entidad"],["estadisticas_tipos_gestion","Tipos de gestión"]];
const titles={dashboard:"Dashboard",expedientes:"Expedientes",notarios:"Notarios",importacion:"Importación mensual",informes:"Informes",evolucion:"Evolución",catalogos:"Catálogos",campos:"Campos calculados",reglas:"Reglas de negocio",ajustes:"Configuración","plantillas-informes":"Diseñador de informes"};let view="dashboard",catalog=catalogs[0][0],customCatalogId=null,notaryPage=0,notarySearch="";
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function msg(t){let e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),3000)}
function head(t,s,a=""){return `<div class="page-head"><div><h1>${t}</h1><p>${s}</p></div><div class="head-actions">${a}</div></div>`}
function kpi(i,n,v,d){return `<article class="card kpi-card hover"><div class="kpi-top"><span class="kpi-name">${n}</span><span class="kpi-icon">${i}</span></div><div class="kpi-value">${v}</div><div class="kpi-note">${d}</div></article>`}
function quick(i,n,d,v){return `<button class="quick-card" data-goto="${v}"><span class="quick-icon">${i}</span><span><strong>${n}</strong><small>${d}</small></span></button>`}
function wire(){ $$("[data-goto]").forEach(b=>b.onclick=()=>setView(b.dataset.goto));}
async function count(t){let {count,error}=await sb.from(t).select("*",{count:"exact",head:true});if(error)throw error;return count||0}
async function setView(v){view=v;$("#crumb-current").textContent=titles[v];$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===v));await render()}
async function render(){let h=$("#view-container");h.innerHTML='<div class="notice">Consultando Supabase…</div>';try{if(view==="dashboard")await dashboard(h);else if(view==="expedientes")await expedientes(h);else if(view==="notarios")await notarios(h);else if(view==="importacion")await importacion(h);else if(view==="catalogos")await catalogosView(h);else if(view==="campos")await campos(h);else if(view==="reglas")await reglas(h);else if(view==="ajustes")ajustes(h);else if(view==="plantillas-informes")await window.__reportModule.plantillas(h);else if(view==="informes")await window.__reportModule.informes(h);else if(view==="evolucion")await window.__reportModule.evolucion(h);else informes(h)}catch(e){h.innerHTML=head(titles[view],"No se pudo cargar esta sección.")+`<div class="notice">${esc(e.message)}</div>`}}
async function dashboard(h,selectedMonth=null,selectedYear=null){
  const fields="id,fecha_protocolo,fecha_alta,vc,tipo_firma,centro_encargo,nombre_apoderado,centro_firma,entidad,circuito_notarial,tipo_gestion,apoderado,oficina";
  let all=[],from=0,batch=1000;
  while(true){
    const {data,error}=await sb.from("estadisticas_registros").select(fields).not("fecha_protocolo","is",null).order("fecha_protocolo",{ascending:false}).range(from,from+batch-1);
    if(error)throw error;
    all=all.concat(data||[]);
    if(!data||data.length<batch)break;
    from+=batch;
  }
  const dateParts=r=>String(r.fecha_protocolo||"").slice(0,10).split("-").map(Number);
  const years=[...new Set(all.map(r=>dateParts(r)[0]).filter(Boolean))].sort((a,b)=>b-a);
  const latest=all.map(r=>dateParts(r)).find(p=>p.length===3&&p[0])||[new Date().getFullYear(),new Date().getMonth()+1,1];
  const year=Number(selectedYear)||latest[0],month=Number(selectedMonth)||latest[1];
  const startDate=new Date(Date.UTC(year,month-1,1)),prevDate=new Date(Date.UTC(year,month-2,1));
  const key=d=>d.toISOString().slice(0,7);
  const currentKey=key(startDate),previousKey=key(prevDate);
  const monthRows=all.filter(r=>String(r.fecha_protocolo||"").slice(0,7)===currentKey);
  const previousRows=all.filter(r=>String(r.fecha_protocolo||"").slice(0,7)===previousKey);
  const monthName=d=>new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric",timeZone:"UTC"}).format(d);
  const titleMonth=monthName(startDate),titlePrevious=monthName(prevDate);
  const pct=(n,total)=>total?Math.round(n/total*100):0;
  const grouped=(rows,getter,empty="Pendiente de clasificar")=>{
    const map={};rows.forEach(r=>{const raw=getter(r);const label=String(raw||"").trim()||empty;map[label]=(map[label]||0)+1});
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
  };
  const firma=r=>{
    const f=String(r.tipo_firma||"").trim().toLowerCase();
    if(f==="presencial")return "Presencial";
    if(f==="videoconferencia"||f==="videoconferencia")return "Videoconferencia";
    const vc=String(r.vc||"").trim().toUpperCase();
    if(vc==="S"||vc==="SI"||vc==="SÍ"||vc==="TRUE")return "Videoconferencia";
    if(vc==="N"||vc==="NO"||vc==="FALSE")return "Presencial";
    return "Pendiente de clasificar";
  };
  const list=(title,sub,items,total)=>{
    const max=Math.max(1,...items.map(x=>x.value));
    return `<section class="card dash-analysis-card"><div class="card-title"><div><h3>${title}</h3><p>${sub}</p></div><span class="pill">${total} expedientes</span></div>
      ${items.length?items.slice(0,8).map(x=>`<div class="dash-bar-row"><div class="dash-bar-label"><span>${esc(x.label)}</span><strong>${x.value} <small>${pct(x.value,total)}%</small></strong></div><div class="dash-bar-track"><i style="width:${Math.max(2,x.value/max*100)}%"></i></div></div>`).join(""):'<div class="dash-empty">No hay datos para este periodo.</div>'}
      </section>`;
  };
  const delta=monthRows.length-previousRows.length;
  const deltaText=previousRows.length?(delta>0?"+":"")+delta+" vs. mes anterior":"Sin datos del mes anterior";
  const monthOpts=Array.from({length:12},(_,i)=>i+1).map(m=>`<option value="${m}" ${m===month?"selected":""}>${new Intl.DateTimeFormat("es-ES",{month:"long"}).format(new Date(2020,m-1,1))}</option>`).join("");
  const yearOpts=(years.length?years:[year]).map(y=>`<option value="${y}" ${y===year?"selected":""}>${y}</option>`).join("");
  const firmaItems=grouped(monthRows,firma);
  const centroItems=grouped(monthRows,r=>r.centro_firma);
  const centroEncargoItems=grouped(monthRows,r=>r.centro_encargo);
  const entidadItems=grouped(monthRows,r=>r.entidad);
  const apoderadoItems=grouped(monthRows,r=>r.nombre_apoderado||r.apoderado);
  const oficinaItems=grouped(monthRows,r=>{const code=String(r.oficina??"").trim();return code?(code==="5316"?"Cancela":"Oficina"):"";});
  const circuitoItems=grouped(monthRows,r=>r.circuito_notarial);
  const tipoGestionItems=grouped(monthRows,r=>r.tipo_gestion);
  h.innerHTML=head("Dashboard","Actividad de expedientes, firmas y rendimiento por centro, apoderado y oficina.",'<button class="btn secondary small" id="dash-refresh">↻ Actualizar</button>')
    +`<section class="card dash-filter-card"><div><strong>Periodo de análisis</strong><small>Compara el mes seleccionado con el inmediatamente anterior</small></div><div class="dash-filters"><label>Mes<select id="dash-month">${monthOpts}</select></label><label>Año<select id="dash-year">${yearOpts}</select></label></div></section>`
    +`<div class="grid kpi-grid dash-kpis">${kpi("▤","Expedientes del mes",monthRows.length.toLocaleString("es-ES"),titleMonth)}${kpi("↗","Mes anterior",previousRows.length.toLocaleString("es-ES"),titlePrevious)}${kpi(delta>=0?"↑":"↓","Variación",previousRows.length?(delta>0?"+":"")+delta:"—",deltaText)}${kpi("✍","Apoderados activos",new Set(monthRows.map(r=>r.nombre_apoderado||r.apoderado).filter(Boolean)).size.toLocaleString("es-ES"),"Con expedientes en el periodo")}</div>`
    +`<div class="dash-section-heading"><div><h2>Actividad de firma</h2><p>Distribución de los expedientes del periodo seleccionado</p></div><span class="pill">${monthRows.length} registros</span></div>`
    +`<div class="grid dash-analysis-grid">${list("Tipo de firma","Videoconferencia y presencial",firmaItems,monthRows.length)}${list("Centro de encargo","Distribución por centro solicitante",centroEncargoItems,monthRows.length)}${list("Centro que firma","Distribución por centro firmante",centroItems,monthRows.length)}${list("Nombre del apoderado","Distribución por apoderado",apoderadoItems,monthRows.length)}${list("Entidad","Clasificación calculada mediante reglas activas",entidadItems,monthRows.length)}${list("Circuito notarial","Distribución entre Península y Canarias",circuitoItems,monthRows.length)}${list("Tipo de gestión","Distribución entre expedientes con y sin provisión",tipoGestionItems,monthRows.length)}${list("Clasificación por oficina","5316 = Cancela · cualquier otro código = Oficina",oficinaItems,monthRows.length)}</div>`
    +`<section class="card dash-comparison"><div class="card-title"><div><h3>Comparativa mensual</h3><p>${titleMonth} frente a ${titlePrevious}</p></div><span class="pill">${previousRows.length?"Comparación disponible":"Pendiente de histórico"}</span></div><div class="dash-compare-grid"><div><small>${titleMonth}</small><strong>${monthRows.length}</strong><span>Expedientes</span></div><div><small>${titlePrevious}</small><strong>${previousRows.length}</strong><span>Expedientes</span></div><div><small>Diferencia</small><strong class="${delta>0?"positive":delta<0?"negative":""}">${previousRows.length?(delta>0?"+":"")+delta:"—"}</strong><span>${previousRows.length?(delta>0?"Más expedientes":delta<0?"Menos expedientes":"Sin variación"):"No hay datos del mes anterior"}</span></div></div></section>`
    +`<div class="dash-footnote">El periodo se determina por la fecha de protocolo. Las columnas adicionales se completan exclusivamente mediante reglas configuradas; si no existe una regla aplicable, el valor queda pendiente de clasificar.</div>`;
  $("#dash-refresh").onclick=()=>dashboard(h,month,year);
  $("#dash-month").onchange=e=>dashboard(h,Number(e.target.value),year);
  $("#dash-year").onchange=e=>dashboard(h,month,Number(e.target.value));
  wire();
}
async function expedientes(h){  const originalColumns=[
    ["expediente","PROVISIÓN / EXPEDIENTE"],["oficina","OFICINA"],["fecha_alta","FECHA ALTA"],
    ["contrato","CONTRATO"],["tipo_provision","TIPO PROVISIÓN"],["notario","NOTARIO"],
    ["provincia","PROVINCIA"],["municipio","MUNICIPIO"],["comunidad","COMUNIDAD"],
    ["protocolo","PROTOCOLO"],["fecha_protocolo","FECHA PROTOCOLO"],["vc","V.C."],
    ["apoderado","APODERADO"],["envio_notario","ENVÍO NOTARIO"],["dias_excel","DÍAS"]
  ];
  const calculatedColumns=[
    ["centro_encargo","CENTRO DE ENCARGO"],["tipo_gestion","TIPO GESTIÓN"],["nombre_apoderado","NOMBRE DEL APODERADO"],
    ["centro_firma","CENTRO QUE FIRMA"],["entidad","ENTIDAD"],["circuito_notarial","CIRCUITO NOTARIAL"],["tipo_firma","TIPO DE FIRMA"]
  ];
  const columns=[...originalColumns,...calculatedColumns];
  const select=columns.map(c=>c[0]).join(",");
  const {data,error}=await sb.from("estadisticas_registros").select(select).order("fecha_alta",{ascending:false}).limit(500);
  if(error)throw error;
  const rows=(data||[]).map(r=>"<tr>"+columns.map((c,i)=>"<td>"+(i===0?"<strong>":"")+esc(r[c[0]]??"—")+(i===0?"</strong>":"")+"</td>").join("")+"</tr>").join("");
  h.innerHTML=head("Expedientes","Consulta las 15 columnas originales del Excel y las 7 columnas adicionales generadas por reglas de negocio.")
    +'<section class="card"><div class="toolbar"><input id="search-exp" class="search-input" placeholder="Buscar en cualquiera de las 22 columnas…"><span class="pill">'+(data?.length||0)+' registros recientes · 22 columnas</span></div><div class="table-wrap" style="overflow-x:auto"><table class="expedientes-table" style="min-width:2200px"><thead><tr><th colspan="15" class="table-group-heading">DATOS ORIGINALES DEL EXCEL · 15 COLUMNAS</th><th colspan="7" class="table-group-heading">COLUMNAS ADICIONALES · REGLAS DE NEGOCIO</th></tr><tr>'+columns.map(c=>"<th>"+c[1]+"</th>").join("")+'</tr></thead><tbody id="rows-exp">'+(rows||'<tr><td colspan="22" class="empty-row">Aún no hay expedientes. Importa tu primer Excel.</td></tr>')+'</tbody></table></div></section>';
  wire();
  $("#search-exp").oninput=e=>$$('#rows-exp tr').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(e.target.value.toLowerCase()));
}
async function notarios(h){
  const size=50,from=notaryPage*size,to=from+size-1;
  let q=sb.from("ctn_notarios").select("id,codigo,nombre,apellidos,nif,telefono,cp,provincia,municipio,vc,apoderado,apoderado_s,direccion,observacion",{count:"exact"});
  if(notarySearch){const term=notarySearch.replace(/[,%()]/g," ").trim();if(term)q=q.or(["codigo","nombre","apellidos","nif","municipio","provincia"].map(c=>c+".ilike.%"+term+"%").join(","))}
  const {data,error,count}=await q.order("apellidos").order("nombre").range(from,to);if(error)throw error;
  const rows=(data||[]).map(n=>"<tr><td><strong>"+esc(n.codigo||"—")+"</strong></td><td><strong>"+esc([n.nombre,n.apellidos].filter(Boolean).join(" ")||"—")+"</strong></td><td>"+esc(n.nif||"—")+"</td><td>"+esc(n.municipio||"—")+"</td><td>"+esc(n.provincia||"—")+"</td><td>"+esc(n.vc||"—")+"</td><td><button class='btn secondary small' data-notary-detail='"+n.id+"'>Ver ficha</button></td></tr>").join("");
  const total=count||0,pages=Math.max(1,Math.ceil(total/size));
  const {data:imports,error:ie}=await sb.from("ctn_importaciones").select("id,origen,nombre_fichero,registros_leidos,registros_importados,estado,importado_en").order("importado_en",{ascending:false}).limit(5);if(ie)throw ie;
  h.innerHTML=head("Notarios","Directorio notarial procedente de CTN, integrado en ESTADISTICAS-MOLSAN.","<button class='btn primary small' id='new-notary'>＋ Nuevo notario</button>")
  +"<section class='card'><div class='toolbar'><input id='notary-search' class='search-input' value='"+esc(notarySearch)+"' placeholder='Buscar código, nombre, NIF, municipio o provincia…'><button class='btn secondary small' id='notary-search-btn'>Buscar</button><span class='pill'>"+total.toLocaleString("es-ES")+" registros</span></div><div class='table-wrap'><table><thead><tr><th>CÓDIGO</th><th>NOTARIO / NOTARÍA</th><th>NIF</th><th>MUNICIPIO</th><th>PROVINCIA</th><th>V.C.</th><th>FICHA</th></tr></thead><tbody>"+(rows||"<tr><td colspan='7' class='empty-row'>No hay resultados.</td></tr>")+"</tbody></table></div><div class='toolbar' style='justify-content:space-between;margin-top:15px'><span class='muted'>Mostrando "+(total?from+1:0)+"–"+Math.min(to+1,total)+" de "+total+"</span><div class='row-actions'><button class='btn secondary small' id='notary-prev' "+(notaryPage===0?"disabled":"")+">← Anterior</button><span class='pill'>Página "+(notaryPage+1)+" / "+pages+"</span><button class='btn secondary small' id='notary-next' "+(notaryPage+1>=pages?"disabled":"")+">Siguiente →</button></div></div></section>"
  +"<section class='card' style='margin-top:16px'><div class='card-title'><div><h3>Histórico de importaciones CTN</h3><p>Registro de cargas del directorio</p></div></div><div class='table-wrap'><table><thead><tr><th>FECHA</th><th>ORIGEN</th><th>FICHERO</th><th>LEÍDOS</th><th>IMPORTADOS</th><th>ESTADO</th></tr></thead><tbody>"+((imports||[]).map(x=>"<tr><td>"+esc(x.importado_en?new Date(x.importado_en).toLocaleString("es-ES"):"—")+"</td><td>"+esc(x.origen||"—")+"</td><td>"+esc(x.nombre_fichero||"—")+"</td><td>"+(x.registros_leidos??"—")+"</td><td>"+(x.registros_importados??"—")+"</td><td>"+esc(x.estado||"—")+"</td></tr>").join("")||"<tr><td colspan='6' class='empty-row'>Sin importaciones registradas.</td></tr>")+"</tbody></table></div></section>";
  $("#new-notary").onclick=()=>notarioModal();
  $("#notary-search-btn").onclick=()=>{notarySearch=$("#notary-search").value.trim();notaryPage=0;notarios($("#view-container"))};
  $("#notary-search").onkeydown=e=>{if(e.key==="Enter")$("#notary-search-btn").click()};
  $("#notary-prev").onclick=()=>{notaryPage=Math.max(0,notaryPage-1);notarios($("#view-container"))};
  $("#notary-next").onclick=()=>{notaryPage++;notarios($("#view-container"))};
  $$("[data-notary-detail]").forEach(b=>b.onclick=()=>notarioFicha(Number(b.dataset.notaryDetail)));
}
async function notarioFicha(id){
  const {data:n,error}=await sb.from("ctn_notarios").select("*").eq("id",id).single();if(error)throw error;
  const {data:links,error:le}=await sb.from("ctn_notarios_asociados").select("notario_id,asociado_id").or("notario_id.eq."+id+",asociado_id.eq."+id);if(le)throw le;
  const ids=[...new Set((links||[]).flatMap(x=>[x.notario_id,x.asociado_id]).filter(x=>x!==id))];let related=[];
  if(ids.length){const {data,error:e}=await sb.from("ctn_notarios").select("id,codigo,nombre,apellidos").in("id",ids);if(e)throw e;related=data||[]}
  const fields=[["Código",n.codigo],["Nombre",n.nombre],["Apellidos",n.apellidos],["NIF",n.nif],["Teléfono",n.telefono],["Dirección",n.direccion],["Código postal",n.cp],["Municipio",n.municipio],["Provincia",n.provincia],["V.C.",n.vc],["Apoderado",n.apoderado],["Apoderado secundario",n.apoderado_s],["Departamento cancelaciones",n.departamento_cancelaciones],["Departamento copias",n.departamento_copias],["Otros departamentos",n.otros_departamentos],["Observaciones",n.observacion]];
  const back=document.createElement("div");back.className="modal-backdrop";
  back.innerHTML="<div class='modal-card notary-modal'><div class='modal-head'><div><span class='eyebrow'>FICHA NOTARIAL · "+esc(n.codigo||"")+"</span><h2>"+esc([n.nombre,n.apellidos].filter(Boolean).join(" "))+"</h2><p>"+esc([n.municipio,n.provincia].filter(Boolean).join(" · "))+"</p></div><button class='modal-close'>×</button></div><div class='notary-detail-grid'>"+fields.map(x=>"<div class='notary-detail-field'><small>"+x[0]+"</small><strong>"+esc(x[1]||"—")+"</strong></div>").join("")+"</div><div class='notary-associates'><div class='card-title'><div><h3>Notarios asociados</h3><p>Relaciones registradas en CTN</p></div><button class='btn secondary small' id='add-nt-assoc'>＋ Asociar</button></div>"+(related.length?related.map(x=>"<div class='status-line'><span>"+esc([x.nombre,x.apellidos].filter(Boolean).join(" "))+" · "+esc(x.codigo||"")+"</span><button class='btn danger small' data-remove-nt-assoc='"+x.id+"'>Quitar</button></div>").join(""):"<p class='muted'>No tiene asociaciones registradas.</p>")+"</div><div class='modal-actions'><button class='btn secondary' id='close-nt'>Cerrar</button><button class='btn primary' id='edit-nt'>Editar ficha</button></div></div>";
  document.body.appendChild(back);const close=()=>back.remove();back.querySelector(".modal-close").onclick=close;back.querySelector("#close-nt").onclick=close;back.onclick=e=>{if(e.target===back)close()};back.querySelector("#edit-nt").onclick=()=>{close();notarioModal(n)};
  back.querySelector("#add-nt-assoc").onclick=()=>{close();asociadoNotarioModal(n)};
  back.querySelectorAll("[data-remove-nt-assoc]").forEach(b=>b.onclick=async()=>{const other=Number(b.dataset.removeNtAssoc);const {error}=await sb.from("ctn_notarios_asociados").delete().or("and(notario_id.eq."+id+",asociado_id.eq."+other+"),and(notario_id.eq."+other+",asociado_id.eq."+id+")");if(error){msg("No se pudo quitar: "+error.message);return}close();msg("Asociación eliminada");notarioFicha(id)});
}
async function asociadoNotarioModal(n){
  const {data:choices,error}=await sb.from("ctn_notarios").select("id,codigo,nombre,apellidos").neq("id",n.id).order("apellidos").limit(1000);if(error)throw error;
  const back=document.createElement("div");back.className="modal-backdrop";
  back.innerHTML="<div class='modal-card'><div class='modal-head'><div><span class='eyebrow'>RELACIONES NOTARIALES</span><h2>Asociar notario</h2><p>Selecciona el registro que quieres vincular.</p></div><button class='modal-close'>×</button></div><div class='field'><label>Notario asociado</label><select id='nt-assoc-choice'><option value=''>Seleccionar…</option>"+(choices||[]).map(x=>"<option value='"+x.id+"'>"+esc([x.nombre,x.apellidos].filter(Boolean).join(" "))+" · "+esc(x.codigo||"")+"</option>").join("")+"</select></div><div class='modal-actions'><button class='btn secondary' id='cancel-nt-assoc'>Cancelar</button><button class='btn primary' id='save-nt-assoc'>Crear asociación</button></div></div>";
  document.body.appendChild(back);const close=()=>back.remove();back.querySelector(".modal-close").onclick=close;back.querySelector("#cancel-nt-assoc").onclick=close;
  back.querySelector("#save-nt-assoc").onclick=async()=>{const other=Number(back.querySelector("#nt-assoc-choice").value);if(!other){msg("Selecciona un notario");return}const {data:existing,error:check}=await sb.from("ctn_notarios_asociados").select("notario_id").or("and(notario_id.eq."+n.id+",asociado_id.eq."+other+"),and(notario_id.eq."+other+",asociado_id.eq."+n.id+")");if(check){msg(check.message);return}if(existing?.length){msg("La asociación ya existe");return}const {error}=await sb.from("ctn_notarios_asociados").insert({notario_id:n.id,asociado_id:other});if(error){msg("No se pudo asociar: "+error.message);return}close();msg("Notario asociado");notarioFicha(n.id)};
}
function notarioModal(n){
  const editing=!!n,back=document.createElement("div");back.className="modal-backdrop";
  const fields=[["codigo","Código"],["nombre","Nombre"],["apellidos","Apellidos"],["nif","NIF"],["telefono","Teléfono"],["direccion","Dirección"],["cp","Código postal"],["municipio","Municipio"],["provincia","Provincia"],["vc","V.C."],["apoderado","Apoderado"],["apoderado_s","Apoderado secundario"],["departamento_cancelaciones","Departamento cancelaciones"],["departamento_copias","Departamento copias"],["otros_departamentos","Otros departamentos"],["observacion","Observaciones"]];
  back.innerHTML="<div class='modal-card field-modal-card notary-modal'><div class='modal-head'><div><span class='eyebrow'>DIRECTORIO NOTARIAL</span><h2>"+(editing?"Editar ficha":"Nuevo notario / notaría")+"</h2><p>Los cambios se guardan en el directorio privado.</p></div><button class='modal-close'>×</button></div><div class='field-grid'>"+fields.map(x=>"<div class='field "+(["direccion","observacion","departamento_cancelaciones","departamento_copias","otros_departamentos"].includes(x[0])?"full-span":"")+"'><label>"+x[1]+"</label>"+(["observacion","departamento_cancelaciones","departamento_copias","otros_departamentos"].includes(x[0])?"<textarea id='nt-"+x[0]+"'>"+esc(n?.[x[0]]||"")+"</textarea>":"<input id='nt-"+x[0]+"' value='"+esc(n?.[x[0]]||"")+"'>")+"</div>").join("")+"</div><div class='modal-actions'><button class='btn secondary' id='cancel-nt'>Cancelar</button><button class='btn primary' id='save-nt'>Guardar ficha</button></div></div>";
  document.body.appendChild(back);const close=()=>back.remove();back.querySelector(".modal-close").onclick=close;back.querySelector("#cancel-nt").onclick=close;back.onclick=e=>{if(e.target===back)close()};
  back.querySelector("#save-nt").onclick=async e=>{const b=e.currentTarget;b.disabled=true;const payload={};fields.forEach(x=>payload[x[0]]=back.querySelector("#nt-"+x[0]).value.trim()||null);try{const result=editing?await sb.from("ctn_notarios").update(payload).eq("id",n.id):await sb.from("ctn_notarios").insert(payload);if(result.error)throw result.error;close();msg(editing?"Ficha actualizada":"Ficha creada");notarios($("#view-container"))}catch(err){msg("No se pudo guardar: "+err.message);b.disabled=false}};
}

async function importacion(h){
  const PAGE_SIZE=100;
  const MAX_SAFE_CONSOLIDATION_ROWS=10000;
  let reviewPage=0;
  const {data:batches,error:batchError}=await sb.from("estadisticas_importaciones")
    .select("id,periodo,nombre_archivo,estado,filas_leidas,filas_importadas,filas_rechazadas")
    .order("periodo",{ascending:false}).order("id",{ascending:false}).limit(10);
  if(batchError)throw batchError;
  const latest=batches?.[0]||null;
  let stagedCount=Number(latest?.filas_leidas||0),pendingCount=null,errorCount=null,importedCount=null;
  // Los recuentos exactos sobre cientos de miles de filas pueden agotar el timeout
  // de PostgREST. Solo verificamos recuentos completos en lotes pequeños.
  if(latest&&stagedCount<=MAX_SAFE_CONSOLIDATION_ROWS){
    const [allRows,pendingRows,errorRows,importedRows]=await Promise.all([
      sb.from("estadisticas_filas_importacion").select("numero_fila",{count:"exact",head:true}).eq("importacion_id",latest.id),
      sb.from("estadisticas_filas_importacion").select("numero_fila",{count:"exact",head:true}).eq("importacion_id",latest.id).in("estado",["pendiente","valida"]),
      sb.from("estadisticas_filas_importacion").select("numero_fila",{count:"exact",head:true}).eq("importacion_id",latest.id).eq("estado","con_errores"),
      sb.from("estadisticas_filas_importacion").select("numero_fila",{count:"exact",head:true}).eq("importacion_id",latest.id).eq("estado","importada")
    ]);
    for(const result of [allRows,pendingRows,errorRows,importedRows])if(result.error)throw result.error;
    stagedCount=allRows.count??stagedCount;pendingCount=pendingRows.count??0;errorCount=errorRows.count??0;importedCount=importedRows.count??0;
  }
  const batchRows=(batches||[]).map(b=>'<tr><td>'+esc(b.periodo)+'</td><td>'+esc(b.nombre_archivo||"—")+'</td><td>'+esc(b.estado)+'</td><td>'+Number(b.filas_importadas||0)+' / '+Number(b.filas_leidas||0)+'</td></tr>').join("");
  const canConsolidate=!!latest&&latest.estado==="pendiente"&&pendingCount>0&&pendingCount<=MAX_SAFE_CONSOLIDATION_ROWS&&errorCount===0&&stagedCount===Number(latest.filas_leidas||0)&&importedCount===0;
  h.innerHTML=head("Importación mensual","Carga el Excel, revisa las filas y confirma su incorporación al histórico.")
    +'<div class="notice"><strong>Proceso seguro:</strong> el fichero se prepara primero. Solo se incorpora al histórico al confirmar. La revisión se pagina y no descarga el lote completo en el navegador.</div>'
    +'<section class="card"><div class="field-grid"><div class="field"><label>Periodo de datos</label><input id="period" type="month" value="'+new Date().toISOString().slice(0,7)+'"></div><div class="field"><label>Archivo Excel</label><input id="file" type="file" accept=".xlsx,.xls,.csv"></div></div><div class="upload-zone"><div class="upload-icon">⇧</div><h3>Selecciona tu fichero mensual</h3><p>Formatos XLSX, XLS y CSV. Se conservarán las columnas originales.</p><div id="file-name" class="muted"></div></div><div class="form-actions"><button id="stage" class="btn primary" disabled>Preparar y validar filas →</button></div><div id="result" aria-live="polite"></div></section>'
    +'<div class="grid content-grid"><section class="card"><div class="card-title"><div><h3>Últimas importaciones</h3><p>Histórico de cargas mensuales</p></div></div><div class="table-wrap"><table><thead><tr><th>PERIODO</th><th>ARCHIVO</th><th>ESTADO</th><th>FILAS</th></tr></thead><tbody>'+(batchRows||'<tr><td colspan="4" class="empty-row">Todavía no hay importaciones.</td></tr>')+'</tbody></table></div></section><section class="card"><div class="card-title"><div><h3>Revisión del último lote</h3><p>'+(latest?esc(latest.periodo)+" · "+esc(latest.nombre_archivo||""):"Sin lotes")+'</p></div><span class="pill '+(latest?.estado==="importada"?"green":"")+'">'+(latest?esc(latest.estado):"Pendiente")+'</span></div><div class="status-line"><span>Filas leídas</span><b>'+(latest?.filas_leidas??0)+'</b></div><div class="status-line"><span>Filas preparadas</span><b>'+stagedCount+'</b></div><div class="status-line"><span>Filas pendientes de incorporar</span><b>'+(pendingCount===null?"Pendiente de verificación (lote grande)":pendingCount.toLocaleString("es-ES"))+'</b></div><div class="status-line"><span>Filas incorporadas</span><b>'+(latest?.filas_importadas??(importedCount===null?"—":importedCount))+'</b></div><div class="status-line"><span>Filas rechazadas</span><b>'+(latest?.filas_rechazadas??errorCount)+'</b></div><div id="batch-integrity" class="muted small">'+(latest&&stagedCount!==Number(latest.filas_leidas||0)?"Aviso: el número de filas preparadas no coincide con las filas leídas. No se permite consolidar.":latest&&errorCount?"Hay filas con errores. Deben revisarse antes de consolidar.":latest&&Number(latest.filas_leidas||0)>MAX_SAFE_CONSOLIDATION_ROWS?"Bloqueado por seguridad: el lote supera "+MAX_SAFE_CONSOLIDATION_ROWS.toLocaleString("es-ES")+" filas y el recuento exacto se omite para evitar una consulta pesada. No confirmes este lote hasta optimizar y probar la consolidación.":latest&&latest.estado==="validando"?"La preparación del lote no terminó correctamente.":latest&&Number(latest.filas_leidas||0)>MAX_SAFE_CONSOLIDATION_ROWS?"Lote grande: se muestran filas por páginas. La consolidación queda bloqueada hasta optimizar y verificar el proceso SQL.":latest&&latest.estado==="pendiente"?"El lote está preparado. La confirmación solo se habilita cuando todas las filas están presentes, válidas y dentro del umbral seguro.":"")+'</div><button id="confirm-import" class="btn primary full" '+(canConsolidate?"":"disabled")+'>'+(canConsolidate?"Confirmar e incorporar al histórico →":"Lote no validado para consolidación")+'</button><p class="muted small">Repetir la confirmación del mismo lote no duplica sus filas. Crear una nueva importación del mismo Excel sí genera otro lote.</p></section></div>'
    +'<section class="card"><div class="card-title"><div><h3>Detalle de filas</h3><p id="review-summary">'+stagedCount+' filas del último lote · Mostrando una página de '+PAGE_SIZE+' como máximo</p></div></div><div class="table-wrap"><table><thead><tr><th>FILA</th><th>EXPEDIENTE</th><th>OFICINA</th><th>FECHA ALTA</th><th>FECHA PROTOCOLO</th><th>ENVÍO NOTARIO</th><th>DÍAS EXCEL</th><th>ESTADO</th></tr></thead><tbody id="review-rows"><tr><td colspan="8" class="empty-row">Cargando página…</td></tr></tbody></table></div><div class="form-actions" style="align-items:center;justify-content:space-between"><button id="review-prev" class="btn secondary" disabled>← Anterior</button><span id="review-page-label" class="muted small">Página 1 de 1</span><button id="review-next" class="btn secondary" disabled>Siguiente →</button></div><div id="review-error" class="notice" hidden></div></section>';

  async function loadReviewPage(nextPage){
    if(!latest||!stagedCount){$("#review-rows").innerHTML='<tr><td colspan="8" class="empty-row">No hay filas para revisar.</td></tr>';$("#review-summary").textContent="0 filas del último lote";return}
    reviewPage=Math.max(0,Math.min(nextPage,Math.ceil(stagedCount/PAGE_SIZE)-1));
    const from=reviewPage*PAGE_SIZE,to=from+PAGE_SIZE-1;
    const {data,error}=await sb.from("estadisticas_filas_importacion")
      .select("numero_fila,datos_mapeados,estado,errores,registro_id")
      .eq("importacion_id",latest.id).order("numero_fila").range(from,to);
    if(error)throw error;
    const rows=data||[];
    const rowHtml=rows.map(r=>{
      const m=r.datos_mapeados||{};
      const errs=Array.isArray(r.errores)?r.errores.map(x=>x.mensaje||"").filter(Boolean).join("; "):"";
      return '<tr><td>'+r.numero_fila+'</td><td><strong>'+esc(m.expediente||"—")+'</strong></td><td>'+esc(m.oficina||"—")+'</td><td>'+esc(m.fecha_alta||"—")+'</td><td>'+esc(m.fecha_protocolo||"—")+'</td><td>'+esc(m.envio_notario||"—")+'</td><td>'+esc(m.dias_excel||"—")+'</td><td><span class="pill '+(r.estado==="importada"?"green":r.estado==="con_errores"?"red":"")+'">'+esc(r.estado)+'</span>'+(errs?'<small>'+esc(errs)+'</small>':"")+'</td></tr>';
    }).join("");
    $("#review-rows").innerHTML=rowHtml||'<tr><td colspan="8" class="empty-row">No hay filas para esta página.</td></tr>';
    const totalPages=Math.max(1,Math.ceil(stagedCount/PAGE_SIZE));
    $("#review-summary").textContent="Filas "+(from+1)+"–"+Math.min(to+1,stagedCount)+" de "+stagedCount+" · Expediente corresponde a «Provisión» del Excel";
    $("#review-page-label").textContent="Página "+(reviewPage+1)+" de "+totalPages;
    $("#review-prev").disabled=reviewPage===0;
    $("#review-next").disabled=reviewPage>=totalPages-1;
  }
  $("#review-prev").onclick=()=>loadReviewPage(reviewPage-1).catch(e=>{$("#review-error").hidden=false;$("#review-error").textContent="No se pudo cargar la página: "+e.message});
  $("#review-next").onclick=()=>loadReviewPage(reviewPage+1).catch(e=>{$("#review-error").hidden=false;$("#review-error").textContent="No se pudo cargar la página: "+e.message});
  try{await loadReviewPage(0)}catch(e){$("#review-error").hidden=false;$("#review-error").textContent="No se pudo cargar la primera página: "+e.message;$("#review-rows").innerHTML='<tr><td colspan="8" class="empty-row">Error al cargar las filas. El lote se conserva; puedes volver a intentarlo.</td></tr>'}

  const f=$("#file");
  f.onchange=()=>{$("#file-name").textContent=f.files[0]?.name||"";$("#stage").disabled=!f.files[0]};
  $("#stage").onclick=async()=>{
    const file=f.files[0],period=$("#period").value,b=$("#stage");
    if(!file||!period)return;
    b.disabled=true;b.textContent="Leyendo Excel…";
    let batchId=null,inserted=0,validationErrors=0;
    try{
      const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});
      const sheet=wb.Sheets[wb.SheetNames[0]];
      if(!sheet||!sheet["!ref"])throw Error("La primera hoja del Excel está vacía.");
      const bounds=XLSX.utils.decode_range(sheet["!ref"]);
      const headerRow=bounds.s.r;
      const headerValues=XLSX.utils.sheet_to_json(sheet,{header:1,range:{s:{r:headerRow,c:bounds.s.c},e:{r:headerRow,c:bounds.e.c}},defval:"",raw:false,blankrows:true})[0]||[];
      const excelHeaders=headerValues.map((v,i)=>String(v??"").trim()||("COLUMNA_"+(i+1)));
      const requiredExcelColumns=[
        {name:"Provisión",aliases:["Provisión","Provision","Expediente"]},{name:"Oficina",aliases:["Oficina"]},
        {name:"Fecha Alta",aliases:["Fecha Alta"]},{name:"Contrato",aliases:["Contrato"]},
        {name:"Tipo Provisión",aliases:["Tipo Provisión","Tipo Provision"]},{name:"Notario",aliases:["Notario"]},
        {name:"Provincia",aliases:["Provincia"]},{name:"Municipio",aliases:["Municipio"]},{name:"Comunidad",aliases:["Comunidad"]},
        {name:"Protocolo",aliases:["Protocolo"]},{name:"Fecha Protocolo",aliases:["Fecha Protocolo"]},
        {name:"V.C.",aliases:["V.C.","VC"]},{name:"Apoderado",aliases:["Apoderado"]},
        {name:"Envio Notario",aliases:["Envio Notario","Envío Notario"]},{name:"Días",aliases:["Días","Dias"]}
      ];
      const normalizedHeaders=excelHeaders.map(norm);
      const missingHeaders=requiredExcelColumns.filter(col=>!col.aliases.some(alias=>normalizedHeaders.includes(norm(alias)))).map(col=>col.name);
      if(missingHeaders.length)throw Error("El Excel no contiene todas las columnas obligatorias. Faltan: "+missingHeaders.join(", ")+". Debe incluir las 15 columnas del modelo mensual.");
      if(bounds.e.r<=headerRow)throw Error("El Excel no contiene filas de datos.");
      const {data:batch,error:batchCreateError}=await sb.from("estadisticas_importaciones").insert({
        periodo:period+"-01",nombre_archivo:file.name,estado:"validando",filas_leidas:0,
        mapeo_columnas:{columnas:excelHeaders,columnas_obligatorias:requiredExcelColumns.map(c=>c.name)}
      }).select("id").single();
      if(batchCreateError)throw batchCreateError;
      batchId=batch.id;
      const toDbDate=value=>{
        if(value===null||value===undefined||String(value).trim()==="")return null;
        if(value instanceof Date&&!Number.isNaN(value.getTime()))return [String(value.getDate()).padStart(2,"0"),String(value.getMonth()+1).padStart(2,"0"),value.getFullYear()].join("-");
        let s=String(value).trim().split(" ")[0],m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
        if(m){const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]),check=new Date(y,mo-1,d);return check.getFullYear()===y&&check.getMonth()===mo-1&&check.getDate()===d?[String(d).padStart(2,"0"),String(mo).padStart(2,"0"),y].join("-"):null}
        m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if(m){const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]),check=new Date(y,mo-1,d);return check.getFullYear()===y&&check.getMonth()===mo-1&&check.getDate()===d?[String(d).padStart(2,"0"),String(mo).padStart(2,"0"),y].join("-"):null}
        return null;
      };
      const CHUNK=500,totalSheetRows=bounds.e.r-headerRow;
      let bad=0;
      for(let startRow=headerRow+1;startRow<=bounds.e.r;startRow+=CHUNK){
        const endRow=Math.min(startRow+CHUNK-1,bounds.e.r);
        const values=XLSX.utils.sheet_to_json(sheet,{header:1,range:{s:{r:startRow,c:bounds.s.c},e:{r:endRow,c:bounds.e.c}},defval:"",raw:false,blankrows:true});
        const stagedRows=[];
        for(let j=0;j<values.length;j++){
          const cells=values[j]||[];
          if(!cells.some(v=>String(v??"").trim()!==""))continue;
          const r={};excelHeaders.forEach((header,index)=>r[header]=cells[index]??"");
          const m=mapRow(r),errs=[];
          m.fecha_alta=toDbDate(m.fecha_alta);
          m.fecha_protocolo=toDbDate(m.fecha_protocolo);
          m.envio_notario=toDbDate(m.envio_notario);
          if(!m.expediente)errs.push("Falta Expediente");
          if(!m.oficina)errs.push("Falta Oficina");
          if(!m.fecha_alta)errs.push("Fecha Alta ausente o no válida (dd-mm-aaaa)");
          if(!m.fecha_protocolo)errs.push("Fecha Protocolo ausente o no válida (dd-mm-aaaa)");
          if(!m.envio_notario)errs.push("Envío Notario ausente o no válido (dd-mm-aaaa)");
          if(m.dias_excel===null||String(m.dias_excel).trim()===""||!Number.isInteger(Number(m.dias_excel)))errs.push("Días ausente o no numérico");
          else m.dias_excel=String(Number(m.dias_excel));
          if(errs.length)bad++;
          stagedRows.push({importacion_id:batchId,numero_fila:startRow+j+1,datos_originales:r,datos_mapeados:m,estado:errs.length?"con_errores":"pendiente",errores:errs.map(mensaje=>({mensaje})),advertencias:[]});
        }
        if(stagedRows.length){
          validationErrors=bad;
          const {error:insertError}=await sb.from("estadisticas_filas_importacion").insert(stagedRows);
          if(insertError)throw insertError;
          inserted+=stagedRows.length;
        }
        b.textContent="Preparando "+inserted.toLocaleString("es-ES")+" filas · tramo "+Math.min(endRow-headerRow,totalSheetRows).toLocaleString("es-ES")+" / "+totalSheetRows.toLocaleString("es-ES")+"…";
      }
      if(!inserted)throw Error("No se han encontrado filas de datos no vacías en el Excel.");
      const {error:updateError}=await sb.from("estadisticas_importaciones").update({
        estado:bad?"importada_con_errores":"pendiente",filas_leidas:inserted,filas_rechazadas:bad,
        resumen_validacion:{filas:inserted,preparadas:inserted,con_errores:bad}
      }).eq("id",batchId);
      if(updateError)throw updateError;
      $("#result").innerHTML='<div class="notice">Preparación finalizada: '+inserted.toLocaleString("es-ES")+' filas preparadas y '+bad.toLocaleString("es-ES")+' con errores. No se ha incorporado nada al histórico.</div>';
      msg("Excel preparado para revisión");
      await render();
    }catch(e){
      if(batchId){
        await sb.from("estadisticas_importaciones").update({
          estado:"error_preparacion",filas_leidas:inserted,filas_rechazadas:validationErrors,
          resumen_validacion:{filas_preparadas:inserted,filas_con_errores:validationErrors,error:e.message}
        }).eq("id",batchId);
      }
      $("#result").innerHTML='<div class="notice">La preparación se ha detenido. Filas guardadas en preparación: '+inserted.toLocaleString("es-ES")+'. Detalle: '+esc(e.message)+'. El lote parcial se conserva y no se ha consolidado.</div>';
      msg("No se pudo completar la preparación");
      b.disabled=false;b.textContent="Reintentar preparación con otro lote";
    }
  };
  const confirm=$("#confirm-import");
  if(confirm)confirm.onclick=async()=>{
    confirm.disabled=true;confirm.textContent="Incorporando…";
    try{
      const {data,error}=await sb.rpc("consolidar_importacion",{p_importacion_id:latest.id});
      if(error)throw error;
      msg("Importación completada: "+Number(data?.importadas||0).toLocaleString("es-ES")+" expedientes");
      await render();
    }catch(e){
      $("#batch-integrity").textContent="No se ha confirmado la incorporación: "+e.message;
      confirm.disabled=false;confirm.textContent="Reintentar incorporación →";
    }
  };
}
function norm(s){return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"")}
function mapRow(r){let get=(...names)=>{let k=Object.keys(r).find(k=>names.some(n=>norm(k)===norm(n)));return k?r[k]:null};return{expediente:get("Expediente","Provisión"),oficina:get("Oficina"),fecha_alta:get("Fecha Alta"),contrato:get("Contrato"),tipo_provision:get("Tipo Provisión"),notario:get("Notario"),provincia:get("Provincia"),municipio:get("Municipio"),comunidad:get("Comunidad"),protocolo:get("Protocolo"),fecha_protocolo:get("Fecha Protocolo"),vc:get("V.C."),apoderado:get("Apoderado"),envio_notario:get("Envio Notario","Envío Notario"),dias_excel:get("Días")}}
const catalogUsage={estadisticas_apoderados:["apoderado_id"],estadisticas_centros:["centro_id"],estadisticas_circuitos:["circuito_id"],estadisticas_tipos_firma:["tipo_firma_id"],estadisticas_oficinas:["oficina_id","oficina_origen_id"],estadisticas_tipos_entidad:["tipo_entidad_id"],estadisticas_tipos_gestion:["tipo_gestion_id"]};
function closeCatalogModal(){const m=$("#catalog-modal");if(m)m.remove()}
function catalogModal(row=null){
  closeCatalogModal();
  const editing=!!row;
  const modal=document.createElement("div");modal.id="catalog-modal";modal.className="modal-backdrop";
  modal.innerHTML=`<section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="catalog-modal-title">
    <div class="modal-head"><div><span class="eyebrow">ADMINISTRACIÓN DE CATÁLOGOS</span><h2 id="catalog-modal-title">${editing?"Editar valor":"Nuevo valor"}</h2><p>Completa los datos y guarda los cambios.</p></div><button type="button" class="modal-close" id="catalog-modal-close" aria-label="Cerrar">×</button></div>
    <form id="catalog-form"><div class="field-grid">
      <div class="field"><label for="cat-name">Nombre *</label><input id="cat-name" required maxlength="180" value="${esc(row?.nombre||"")}" placeholder="Nombre del elemento"></div>
      <div class="field"><label for="cat-code">Código</label><input id="cat-code" maxlength="100" value="${esc(row?.codigo||"")}" placeholder="Código opcional"></div>
      <div class="field full-span"><label for="cat-alias">Alias de Excel</label><input id="cat-alias" value="${esc((row?.alias_excel||[]).join(", "))}" placeholder="Separados por comas"></div>
      <div class="field"><label for="cat-order">Orden</label><input id="cat-order" type="number" step="1" value="${Number(row?.orden||0)}"></div>
      <div class="field"><label for="cat-active">Estado</label><select id="cat-active"><option value="true" ${row?.activo!==false?"selected":""}>Activo</option><option value="false" ${row?.activo===false?"selected":""}>Inactivo</option></select></div>
    </div><div class="modal-actions"><button type="button" class="btn secondary" id="catalog-cancel">Cancelar</button><button type="submit" class="btn primary" id="catalog-save">${editing?"Guardar cambios":"Crear valor"}</button></div></form>
  </section>`;
  document.body.append(modal);
  $("#catalog-modal-close").onclick=closeCatalogModal;$("#catalog-cancel").onclick=closeCatalogModal;
  modal.addEventListener("click",e=>{if(e.target===modal)closeCatalogModal()});
  $("#catalog-form").onsubmit=async e=>{
    e.preventDefault();const save=$("#catalog-save");save.disabled=true;save.textContent="Guardando…";
    const payload={nombre:$("#cat-name").value.trim(),codigo:$("#cat-code").value.trim()||null,alias_excel:$("#cat-alias").value.split(",").map(x=>x.trim()).filter(Boolean),orden:Number($("#cat-order").value)||0,activo:$("#cat-active").value==="true",actualizado_en:new Date().toISOString()};
    try{
      let result=editing?await sb.from(catalog).update(payload).eq("id",row.id):await sb.from(catalog).insert(payload);
      if(result.error)throw result.error;
      closeCatalogModal();msg(editing?"Cambios guardados":"Valor creado");await catalogosView($("#view-container"));
    }catch(err){msg("No se pudo guardar: "+err.message);save.disabled=false;save.textContent=editing?"Guardar cambios":"Crear valor"}
  };
  $("#cat-name").focus();
}
async function deleteCatalogValue(row){
  const usageColumns=catalogUsage[catalog]||[];
  let used=0;
  for(const column of usageColumns){const {count,error}=await sb.from("estadisticas_registros").select("id",{count:"exact",head:true}).eq(column,row.id);if(error)throw error;used+=count||0}
  if(used>0){
    if(!confirm("Este valor está utilizado en "+used+" referencia(s). Se desactivará para conservar el histórico. ¿Continuar?"))return;
    const {error}=await sb.from(catalog).update({activo:false,actualizado_en:new Date().toISOString()}).eq("id",row.id);if(error)throw error;
    msg("Valor desactivado; se conserva el histórico");
  }else{
    if(!confirm("Este valor no está vinculado a expedientes. ¿Eliminarlo definitivamente?"))return;
    const {error}=await sb.from(catalog).delete().eq("id",row.id);if(error)throw error;
    msg("Valor eliminado");
  }
  await catalogosView($("#view-container"));
}

async function customCatalogModal(row=null){
  const editing=!!row, modal=document.createElement("div");modal.id="catalog-modal";modal.className="modal-backdrop";
  modal.innerHTML=`<section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="custom-catalog-title">
    <div class="modal-head"><div><span class="eyebrow">ADMINISTRACIÓN DE CATÁLOGOS</span><h2 id="custom-catalog-title">${editing?"Editar catálogo":"Crear nuevo catálogo"}</h2><p>Define una categoría que podrás mantener desde esta pantalla.</p></div><button type="button" class="modal-close" id="custom-cat-close" aria-label="Cerrar">×</button></div>
    <form id="custom-cat-form"><div class="field-grid">
      <div class="field full-span"><label for="custom-cat-name">Nombre del catálogo *</label><input id="custom-cat-name" required maxlength="100" value="${esc(row?.nombre||"")}" placeholder="Ej. Tipo de documento"></div>
      <div class="field full-span"><label for="custom-cat-desc">Descripción</label><textarea id="custom-cat-desc" maxlength="500" placeholder="Para qué se utilizará este catálogo">${esc(row?.descripcion||"")}</textarea></div>
      <div class="field"><label for="custom-cat-active">Estado</label><select id="custom-cat-active"><option value="true" ${row?.activo!==false?"selected":""}>Activo</option><option value="false" ${row?.activo===false?"selected":""}>Inactivo</option></select></div>
    </div><div class="modal-actions"><button type="button" class="btn secondary" id="custom-cat-cancel">Cancelar</button><button type="submit" class="btn primary" id="custom-cat-save">${editing?"Guardar cambios":"Crear catálogo"}</button></div></form></section>`;
  document.body.append(modal);
  const close=()=>modal.remove();$("#custom-cat-close").onclick=close;$("#custom-cat-cancel").onclick=close;modal.addEventListener("click",e=>{if(e.target===modal)close()});
  $("#custom-cat-form").onsubmit=async e=>{
    e.preventDefault();const b=$("#custom-cat-save");b.disabled=true;b.textContent="Guardando…";
    const nombre=$("#custom-cat-name").value.trim(),payload={nombre,descripcion:$("#custom-cat-desc").value.trim()||null,activo:$("#custom-cat-active").value==="true",actualizado_en:new Date().toISOString()};
    if(!nombre){b.disabled=false;return}
    try{
      let result;
      if(editing) result=await sb.from("estadisticas_catalogos_personalizados").update(payload).eq("id",row.id);
      else {const clave=norm(nombre).replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,60);result=await sb.from("estadisticas_catalogos_personalizados").insert({...payload,clave:clave.length<2?"catalogo_"+Date.now():clave});}
      if(result.error)throw result.error;
      close();msg(editing?"Catálogo actualizado":"Catálogo creado");await catalogosView($("#view-container"));
    }catch(err){msg("No se pudo guardar: "+err.message);b.disabled=false;b.textContent=editing?"Guardar cambios":"Crear catálogo"}
  };
  $("#custom-cat-name").focus();
}
async function customValueModal(row=null){
  const editing=!!row,modal=document.createElement("div");modal.id="catalog-modal";modal.className="modal-backdrop";
  modal.innerHTML=`<section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="custom-value-title">
    <div class="modal-head"><div><span class="eyebrow">CATÁLOGO PERSONALIZADO</span><h2 id="custom-value-title">${editing?"Editar valor":"Nuevo valor"}</h2><p>Añade un elemento a este catálogo.</p></div><button type="button" class="modal-close" id="custom-value-close" aria-label="Cerrar">×</button></div>
    <form id="custom-value-form"><div class="field-grid">
      <div class="field"><label for="custom-value-name">Nombre *</label><input id="custom-value-name" required maxlength="180" value="${esc(row?.nombre||"")}"></div>
      <div class="field"><label for="custom-value-code">Código</label><input id="custom-value-code" maxlength="100" value="${esc(row?.codigo||"")}"></div>
      <div class="field full-span"><label for="custom-value-alias">Alias de Excel</label><input id="custom-value-alias" value="${esc((row?.alias_excel||[]).join(", "))}" placeholder="Separados por comas"></div>
      <div class="field"><label for="custom-value-order">Orden</label><input id="custom-value-order" type="number" value="${Number(row?.orden||0)}"></div>
      <div class="field"><label for="custom-value-active">Estado</label><select id="custom-value-active"><option value="true" ${row?.activo!==false?"selected":""}>Activo</option><option value="false" ${row?.activo===false?"selected":""}>Inactivo</option></select></div>
    </div><div class="modal-actions"><button type="button" class="btn secondary" id="custom-value-cancel">Cancelar</button><button type="submit" class="btn primary" id="custom-value-save">${editing?"Guardar cambios":"Crear valor"}</button></div></form></section>`;
  document.body.append(modal);const close=()=>modal.remove();$("#custom-value-close").onclick=close;$("#custom-value-cancel").onclick=close;modal.addEventListener("click",e=>{if(e.target===modal)close()});
  $("#custom-value-form").onsubmit=async e=>{
    e.preventDefault();const b=$("#custom-value-save");b.disabled=true;b.textContent="Guardando…";
    const payload={catalogo_id:customCatalogId,nombre:$("#custom-value-name").value.trim(),codigo:$("#custom-value-code").value.trim()||null,alias_excel:$("#custom-value-alias").value.split(",").map(x=>x.trim()).filter(Boolean),orden:Number($("#custom-value-order").value)||0,activo:$("#custom-value-active").value==="true",actualizado_en:new Date().toISOString()};
    try{let result=editing?await sb.from("estadisticas_valores_catalogos_personalizados").update(payload).eq("id",row.id):await sb.from("estadisticas_valores_catalogos_personalizados").insert(payload);if(result.error)throw result.error;close();msg(editing?"Valor actualizado":"Valor creado");await catalogosView($("#view-container"))}
    catch(err){msg("No se pudo guardar: "+err.message);b.disabled=false;b.textContent=editing?"Guardar cambios":"Crear valor"}
  };
  $("#custom-value-name").focus();
}
async function deleteCustomCatalogValue(row){
  if(!confirm("¿Eliminar definitivamente el valor «"+row.nombre+"»?"))return;
  const {error}=await sb.from("estadisticas_valores_catalogos_personalizados").delete().eq("id",row.id);if(error)throw error;
  msg("Valor eliminado");await catalogosView($("#view-container"));
}
async function deleteCustomCatalog(row){
  const {count,error}=await sb.from("estadisticas_valores_catalogos_personalizados").select("id",{count:"exact",head:true}).eq("catalogo_id",row.id);
  if(error)throw error;
  if(count){if(!confirm("Este catálogo contiene "+count+" valores. Se desactivará para conservarlos. ¿Continuar?"))return;const {error:e}=await sb.from("estadisticas_catalogos_personalizados").update({activo:false,actualizado_en:new Date().toISOString()}).eq("id",row.id);if(e)throw e;msg("Catálogo desactivado; se conservan sus valores")}
  else{if(!confirm("Este catálogo está vacío. ¿Eliminarlo definitivamente?"))return;const {error:e}=await sb.from("estadisticas_catalogos_personalizados").delete().eq("id",row.id);if(e)throw e;msg("Catálogo eliminado")}
  if(customCatalogId===row.id)customCatalogId=null;await catalogosView($("#view-container"));
}
async function baseCatalogModal(row){
  if(!row)return;
  const modal=document.createElement("div");modal.id="catalog-modal";modal.className="modal-backdrop";
  modal.innerHTML=`<section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="base-cat-title"><div class="modal-head"><div><span class="eyebrow">ADMINISTRACIÓN DE CATÁLOGOS</span><h2 id="base-cat-title">Editar catálogo</h2><p>Cambia el nombre visible y su descripción.</p></div><button type="button" class="modal-close" id="base-cat-close" aria-label="Cerrar">×</button></div><form id="base-cat-form"><div class="field-grid"><div class="field full-span"><label for="base-cat-name">Nombre *</label><input id="base-cat-name" required maxlength="120" value="${esc(row.nombre)}"></div><div class="field full-span"><label for="base-cat-desc">Descripción</label><textarea id="base-cat-desc" maxlength="500">${esc(row.descripcion||"")}</textarea></div></div><div class="modal-actions"><button type="button" class="btn secondary" id="base-cat-cancel">Cancelar</button><button type="submit" class="btn primary" id="base-cat-save">Guardar cambios</button></div></form></section>`;
  document.body.append(modal);const close=()=>modal.remove();$("#base-cat-close").onclick=close;$("#base-cat-cancel").onclick=close;
  $("#base-cat-form").onsubmit=async e=>{e.preventDefault();const b=$("#base-cat-save");b.disabled=true;try{const {error}=await sb.from("estadisticas_catalogos_configuracion").update({nombre:$("#base-cat-name").value.trim(),descripcion:$("#base-cat-desc").value.trim()||null,actualizado_en:new Date().toISOString()}).eq("id",row.id);if(error)throw error;close();msg("Catálogo actualizado");await catalogosView($("#view-container"))}catch(err){msg("No se pudo guardar: "+err.message);b.disabled=false}};
}
async function catalogosView(h){
  const {data:catalogConfigs,error:configError}=await sb.from("estadisticas_catalogos_configuracion").select("*").order("orden").order("nombre");if(configError)throw configError;
  const activeConfigs=catalogConfigs||[];

  const {data:customs,error:customError}=await sb.from("estadisticas_catalogos_personalizados").select("*").order("orden").order("nombre");if(customError)throw customError;
  const selectedCustom=(customs||[]).find(x=>x.id===customCatalogId)||null;
  if(selectedCustom){
    const {data,error}=await sb.from("estadisticas_valores_catalogos_personalizados").select("*").eq("catalogo_id",selectedCustom.id).order("orden").order("nombre");if(error)throw error;
    h.innerHTML=head("Catálogos","Crea y administra categorías y valores sin depender de cambios de programación.")
    +`<div class="catalog-layout"><section class="card"><div class="card-title"><h3>Catálogos disponibles</h3></div><button class="catalog-choice" data-back-catalogs="1">← Catálogos estándar</button><div class="catalog-subtitle">CATÁLOGOS PERSONALIZADOS</div>${(customs||[]).map(x=>`<div class="catalog-choice-row" style="display:flex;align-items:center;gap:8px;margin:5px 0"><button class="catalog-choice ${x.id===selectedCustom.id?"active":""}" style="flex:1;text-align:left" data-custom-cat="${x.id}">${esc(x.nombre)} ${x.activo?"":"· Inactivo"}</button><button class="btn secondary small" data-custom-catalog-edit="${x.id}">Editar</button><button class="btn danger small" data-custom-catalog-delete="${x.id}">Eliminar</button></div>`).join("")}<button class="btn secondary small full" id="add-custom-catalog-side">＋ Nuevo catálogo</button></section>
    <section class="card"><div class="card-title"><div><h3>${esc(selectedCustom.nombre)}</h3><p>${esc(selectedCustom.descripcion||"Catálogo personalizado")} · ${data.length} valores · ${data.filter(x=>x.activo).length} activos</p></div><div class="row-actions"><button class="btn secondary small" id="edit-custom-catalog">Editar catálogo</button><button class="btn danger small" id="delete-custom-catalog">Eliminar</button><button class="btn primary small" id="add-custom-value">＋ Nuevo valor</button></div></div>
    <div class="table-wrap"><table><thead><tr><th>CÓDIGO</th><th>NOMBRE</th><th>ALIAS EXCEL</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>${data.length?data.map(x=>`<tr><td>${esc(x.codigo||"—")}</td><td><strong>${esc(x.nombre)}</strong></td><td>${esc((x.alias_excel||[]).join(", ")||"—")}</td><td><span class="pill ${x.activo?"green":""}">${x.activo?"Activo":"Inactivo"}</span></td><td><div class="row-actions"><button class="btn secondary small" data-custom-edit="${x.id}">Editar</button><button class="btn danger small" data-custom-delete="${x.id}">Eliminar</button></div></td></tr>`).join(""):'<tr><td colspan="5" class="empty-row">Este catálogo está vacío. Crea el primer valor.</td></tr>'}</tbody></table></div>
    <p class="muted small catalog-footnote">Las categorías personalizadas quedan guardadas en Supabase y preparadas para incorporarse a los campos de importación, expedientes e informes mediante su configuración de correspondencias.</p></section></div>`;
    $$("[data-back-catalogs]").forEach(b=>b.onclick=()=>{customCatalogId=null;catalogosView($("#view-container"))});
    $$("[data-custom-cat]").forEach(b=>b.onclick=()=>{customCatalogId=b.dataset.customCat;catalogosView($("#view-container"))});
    $$("[data-custom-catalog-edit]").forEach(b=>b.onclick=()=>customCatalogModal((customs||[]).find(x=>x.id===b.dataset.customCatalogEdit)));
    $$("[data-custom-catalog-delete]").forEach(b=>b.onclick=async()=>{try{await deleteCustomCatalog((customs||[]).find(x=>x.id===b.dataset.customCatalogDelete))}catch(e){msg("No se pudo eliminar: "+e.message)}});
    $("#add-custom-catalog-side").onclick=()=>customCatalogModal();$("#edit-custom-catalog").onclick=()=>customCatalogModal(selectedCustom);$("#delete-custom-catalog").onclick=async()=>{try{await deleteCustomCatalog(selectedCustom)}catch(e){msg(e.message)}};
    $("#add-custom-value").onclick=()=>customValueModal();
    $$("[data-custom-edit]").forEach(b=>b.onclick=()=>customValueModal(data.find(x=>x.id===b.dataset.customEdit)));
    $$("[data-custom-delete]").forEach(b=>b.onclick=async()=>{try{await deleteCustomCatalogValue(data.find(x=>x.id===b.dataset.customDelete))}catch(e){msg(e.message)}});
    return;
  }
  let c=catalogs.find(x=>x[0]===catalog)||catalogs[0];catalog=c[0];
  const {data,error}=await sb.from(c[0]).select("*").order("orden").order("nombre");if(error)throw error;
  h.innerHTML=head("Catálogos","Administra los siete catálogos base y crea nuevas categorías cuando las necesites.",'<button class="btn primary small" id="add-custom-catalog">＋ Crear catálogo</button>')
  +`<div class="catalog-layout"><section class="card"><div class="card-title"><h3>Catálogos disponibles</h3></div><div class="catalog-list">${activeConfigs.filter(cfg=>cfg.activo).map(cfg=>{const x=catalogs.find(z=>z[0]===cfg.clave);return x?`<div class="catalog-choice-row" style="display:flex;align-items:center;gap:6px;margin:5px 0"><button class="catalog-choice ${x[0]===c[0]?"active":""}" style="flex:1;text-align:left" data-cat="${x[0]}">${esc(cfg.nombre)}</button><button class="btn secondary small" data-base-cat-edit="${cfg.id}">Editar</button><button class="btn danger small" data-base-cat-delete="${cfg.id}">Eliminar</button></div>`:""}).join("")}</div><div class="catalog-subtitle">CATÁLOGOS PERSONALIZADOS</div><div class="catalog-list">${(customs||[]).map(x=>`<div class="catalog-choice-row" style="display:flex;align-items:center;gap:8px;margin:5px 0"><button class="catalog-choice" style="flex:1;text-align:left" data-custom-cat="${x.id}">${esc(x.nombre)} ${x.activo?"":"· Inactivo"}</button><button class="btn secondary small" data-custom-catalog-edit="${x.id}">Editar</button><button class="btn danger small" data-custom-catalog-delete="${x.id}">Eliminar</button></div>`).join("")||'<p class="muted small">Todavía no has creado categorías personalizadas.</p>'}</div><button class="btn secondary small full" id="add-custom-catalog-side">＋ Crear catálogo</button></section>
  <section class="card"><div class="card-title"><div><h3>${c[1]}</h3><p>${data.length} valores · ${data.filter(x=>x.activo).length} activos</p></div><button class="btn primary small" id="add-cat">＋ Nuevo valor</button></div>
  <div class="table-wrap"><table><thead><tr><th>CÓDIGO</th><th>NOMBRE</th><th>ALIAS EXCEL</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>${data.length?data.map(x=>`<tr><td>${esc(x.codigo||"—")}</td><td><strong>${esc(x.nombre)}</strong></td><td>${esc((x.alias_excel||[]).join(", ")||"—")}</td><td><span class="pill ${x.activo?"green":""}">${x.activo?"Activo":"Inactivo"}</span></td><td><div class="row-actions"><button class="btn secondary small" data-edit="${x.id}">Editar</button><button class="btn danger small" data-delete="${x.id}">Eliminar</button></div></td></tr>`).join(""):'<tr><td colspan="5" class="empty-row">Este catálogo todavía está vacío. Puedes crear el primer valor.</td></tr>'}</tbody></table></div></section></div>`;
  $$("[data-cat]").forEach(b=>b.onclick=()=>{catalog=b.dataset.cat;customCatalogId=null;catalogosView($("#view-container"))});
  $$("[data-base-cat-edit]").forEach(b=>b.onclick=()=>baseCatalogModal(activeConfigs.find(x=>x.id===b.dataset.baseCatEdit)));
  $$("[data-base-cat-delete]").forEach(b=>b.onclick=async()=>{const row=activeConfigs.find(x=>x.id===b.dataset.baseCatDelete);if(!row)return;if(!confirm("Se ocultará el catálogo \""+row.nombre+"\" de la lista. Sus valores y referencias históricas se conservarán. ¿Continuar?"))return;try{const {error}=await sb.from("estadisticas_catalogos_configuracion").update({activo:false,actualizado_en:new Date().toISOString()}).eq("id",row.id);if(error)throw error;if(catalog===row.clave)catalog=(activeConfigs.find(x=>x.activo&&x.id!==row.id)?.clave)||"estadisticas_apoderados";msg("Catálogo ocultado; se conserva el histórico");await catalogosView($("#view-container"))}catch(err){msg("No se pudo ocultar: "+err.message)}});

  $$("[data-custom-cat]").forEach(b=>b.onclick=()=>{customCatalogId=b.dataset.customCat;catalogosView($("#view-container"))});
  $("#add-custom-catalog").onclick=()=>customCatalogModal();$("#add-custom-catalog-side").onclick=()=>customCatalogModal();
  $("#add-cat").onclick=()=>catalogModal();
  $$("[data-edit]").forEach(b=>b.onclick=()=>catalogModal(data.find(x=>x.id===b.dataset.edit)));
  $$("[data-delete]").forEach(b=>b.onclick=async()=>{try{await deleteCatalogValue(data.find(x=>x.id===b.dataset.delete))}catch(err){msg("No se pudo eliminar: "+err.message)}});
}

async function campoCalculadoModal(field=null){
  const editing=!!field;
  let activeRule=null, nextVersion=1;
  if(editing){
    const {data,error}=await sb.from("estadisticas_reglas_calculo").select("*").eq("campo_id",field.id).order("version",{ascending:false}).limit(1);
    if(error)throw error;activeRule=data?.[0]||null;nextVersion=(activeRule?.version||0)+1;
  }
  const definition=activeRule?.definicion?JSON.stringify(activeRule.definicion,null,2):"";
  const modal=document.createElement("div");modal.id="field-modal";modal.className="modal-backdrop";
  modal.innerHTML=`<section class="modal-card field-modal-card" role="dialog" aria-modal="true" aria-labelledby="field-modal-title">
    <div class="modal-head"><div><span class="eyebrow">DICCIONARIO DE MÉTRICAS</span><h2 id="field-modal-title">${editing?"Editar campo calculado":"Crear campo calculado"}</h2><p>Define la métrica y documenta su regla de cálculo.</p></div><button type="button" class="modal-close" id="field-modal-close" aria-label="Cerrar">×</button></div>
    <form id="field-modal-form"><div class="field-grid">
      <div class="field"><label for="field-name">Nombre visible *</label><input id="field-name" required maxlength="120" value="${esc(field?.nombre||"")}" placeholder="Ej. Días hasta protocolo"></div>
      <div class="field"><label for="field-code">Código técnico *</label><input id="field-code" required maxlength="100" pattern="[a-z][a-z0-9_]*" value="${esc(field?.codigo||"")}" placeholder="dias_hasta_protocolo" ${editing?"readonly":""}></div>
      <div class="field"><label for="field-type">Tipo de dato</label><select id="field-type">${["texto","numero","decimal","fecha","booleano","json"].map(x=>`<option value="${x}" ${(field?.tipo_dato||"numero")===x?"selected":""}>${x}</option>`).join("")}</select></div>
      <div class="field"><label for="field-order">Orden de visualización</label><input id="field-order" type="number" value="${Number(field?.orden||0)}"></div>
      <div class="field full-span"><label for="field-description">Descripción</label><textarea id="field-description" maxlength="1000" placeholder="Qué mide este campo y para qué se utilizará">${esc(field?.descripcion||"")}</textarea></div>
      <div class="field"><label for="field-active">Estado del campo</label><select id="field-active"><option value="true" ${field?.activo!==false?"selected":""}>Activo</option><option value="false" ${field?.activo===false?"selected":""}>Inactivo</option></select></div>
      <div class="field"><label>Versión de regla</label><input value="${activeRule?"v"+activeRule.version+" · nueva versión v"+nextVersion:"Primera versión"}" disabled></div>
      <div class="field full-span"><label for="field-rule">Definición de regla (JSON)</label><textarea id="field-rule" class="rule-editor" spellcheck="false" placeholder="{&quot;operacion&quot;:&quot;...&quot;,&quot;campos&quot;:[]}">${esc(definition)}</textarea><small class="field-help">La definición se guarda versionada. Las reglas activas se ejecutan al consolidar nuevas importaciones y guardan el resultado junto con su versión.</small></div>
      <div class="field full-span"><label for="field-rule-notes">Notas de la regla</label><textarea id="field-rule-notes" maxlength="2000" placeholder="Origen de los datos, condiciones, excepciones y criterios de validación…">${esc(activeRule?.notas||"")}</textarea></div>
    </div><div class="modal-actions"><button type="button" class="btn secondary" id="field-modal-cancel">Cancelar</button><button type="submit" class="btn primary" id="field-modal-save">${editing?"Guardar cambios":"Crear campo"}</button></div></form>
  </section>`;
  document.body.append(modal);const close=()=>modal.remove();$("#field-modal-close").onclick=close;$("#field-modal-cancel").onclick=close;modal.addEventListener("click",e=>{if(e.target===modal)close()});
  $("#field-name").addEventListener("input",()=>{if(!editing)$("#field-code").value=norm($("#field-name").value).replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")});
  $("#field-modal-form").onsubmit=async e=>{
    e.preventDefault();const b=$("#field-modal-save");b.disabled=true;b.textContent="Guardando…";
    let definitionValue=null,ruleText=$("#field-rule").value.trim();
    if(ruleText){try{definitionValue=JSON.parse(ruleText)}catch(err){msg("La definición JSON no es válida: "+err.message);b.disabled=false;b.textContent=editing?"Guardar cambios":"Crear campo";return}}
    const payload={nombre:$("#field-name").value.trim(),codigo:$("#field-code").value.trim(),tipo_dato:$("#field-type").value,descripcion:$("#field-description").value.trim()||null,orden:Number($("#field-order").value)||0,activo:$("#field-active").value==="true",actualizado_en:new Date().toISOString()};
    try{
      let fieldId=field?.id;
      if(editing){const {error}=await sb.from("estadisticas_campos_calculados").update(payload).eq("id",fieldId);if(error)throw error}
      else{const {data,error}=await sb.from("estadisticas_campos_calculados").insert(payload).select("id").single();if(error)throw error;fieldId=data.id}
      if(definitionValue!==null){
        const {data:rules,error:rulesError}=await sb.from("estadisticas_reglas_calculo").select("id,version,activa,definicion,notas").eq("campo_id",fieldId).order("version",{ascending:false});
        if(rulesError)throw rulesError;
        const current=rules?.[0]||null;
        if(!current||JSON.stringify(current.definicion)!==JSON.stringify(definitionValue)||current.notas!==($("#field-rule-notes").value.trim()||null)){
          const version=(current?.version||0)+1;
          const {data:newRule,error:insertError}=await sb.from("estadisticas_reglas_calculo").insert({campo_id:fieldId,version,definicion:definitionValue,activa:false,motor:"expresion_v1",notas:$("#field-rule-notes").value.trim()||null}).select("id").single();
          if(insertError)throw insertError;
          const {error:deactivateError}=await sb.from("estadisticas_reglas_calculo").update({activa:false,vigente_hasta:new Date().toISOString()}).eq("campo_id",fieldId).eq("activa",true);
          if(deactivateError)throw deactivateError;
          const {error:activateError}=await sb.from("estadisticas_reglas_calculo").update({activa:true}).eq("id",newRule.id);
          if(activateError)throw activateError;
        }
      }
      close();msg(editing?"Campo actualizado":"Campo creado");await campos($("#view-container"));
    }catch(err){msg("No se pudo guardar: "+err.message);b.disabled=false;b.textContent=editing?"Guardar cambios":"Crear campo"}
  };
  $("#field-name").focus();
}
async function campos(h){
  const {data,error}=await sb.from("estadisticas_campos_calculados").select("*").order("orden").order("nombre");if(error)throw error;
  const {data:rules,error:rulesError}=await sb.from("estadisticas_reglas_calculo").select("campo_id,version,activa");if(rulesError)throw rulesError;
  const ruleMap=new Map();(rules||[]).forEach(r=>{const old=ruleMap.get(r.campo_id)||{version:0,active:false};old.version=Math.max(old.version,r.version);old.active=old.active||r.activa;ruleMap.set(r.campo_id,old)});
  h.innerHTML=head("Campos calculados","Define métricas adicionales, documenta sus reglas y conserva su histórico de versiones.")
  +`<div class="notice">Las reglas activas se evalúan durante la consolidación del Excel. Cada resultado conserva el campo de destino, la regla y su versión; los históricos anteriores no se recalculan al cambiar una regla.</div>
  <section class="card"><div class="card-title"><div><h3>Diccionario de campos</h3><p>${data.length} campos definidos · ${data.filter(x=>x.activo).length} activos</p></div><button id="new-field" class="btn primary small">＋ Nuevo campo</button></div>
  <div class="table-wrap"><table><thead><tr><th>CÓDIGO</th><th>NOMBRE</th><th>TIPO</th><th>REGLA</th><th>DESCRIPCIÓN</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>${data.length?data.map(x=>{const r=ruleMap.get(x.id);return `<tr><td>${esc(x.codigo)}</td><td><strong>${esc(x.nombre)}</strong></td><td>${esc(x.tipo_dato)}</td><td>${r?"v"+r.version+(r.active?" · Activa":" · Inactiva"):"Sin regla"}</td><td>${esc(x.descripcion||"—")}</td><td><span class="pill ${x.activo?"green":""}">${x.activo?"Activo":"Inactivo"}</span></td><td><div class="row-actions"><button class="btn secondary small" data-field-values="${x.id}">Resultados</button><button class="btn secondary small" data-edit-field="${x.id}">Editar</button></div></td></tr>`}).join(""):'<tr><td colspan="7" class="empty-row">Todavía no hay campos calculados. Crea el primero.</td></tr>'}</tbody></table></div></section>`;
  $("#new-field").onclick=()=>campoCalculadoModal();
  $$("[data-edit-field]").forEach(b=>b.onclick=()=>campoCalculadoModal(data.find(x=>x.id===b.dataset.editField)));
  $$("[data-field-values]").forEach(b=>b.onclick=()=>campoValores(data.find(x=>x.id===b.dataset.fieldValues)));
}
async function campoValores(field){
  if(!field)return;
  const {data:values,error}=await sb.from("estadisticas_valores_calculados").select("id,registro_id,regla_id,valor,calculado_en").eq("campo_id",field.id).order("calculado_en",{ascending:false}).limit(500);
  if(error)throw error;
  const recordIds=[...new Set((values||[]).map(x=>x.registro_id))],ruleIds=[...new Set((values||[]).map(x=>x.regla_id))];
  let records=[],rules=[];
  if(recordIds.length){const r=await sb.from("estadisticas_registros").select("id,expediente,contrato,apoderado").in("id",recordIds);if(r.error)throw r.error;records=r.data||[]}
  if(ruleIds.length){const r=await sb.from("estadisticas_reglas_calculo").select("id,version").in("id",ruleIds);if(r.error)throw r.error;rules=r.data||[]}
  const recordMap=new Map(records.map(x=>[x.id,x])),ruleMap=new Map(rules.map(x=>[x.id,x.version]));
  const rows=(values||[]).map(v=>{const r=recordMap.get(v.registro_id)||{};return '<tr><td>'+esc(r.expediente||"—")+'</td><td>'+esc(r.contrato||"—")+'</td><td>'+esc(r.apoderado||"—")+'</td><td><strong>'+esc(typeof v.valor==="string"?v.valor:JSON.stringify(v.valor))+'</strong></td><td>v'+esc(ruleMap.get(v.regla_id)??"—")+'</td><td>'+esc(v.calculado_en?new Date(v.calculado_en).toLocaleString("es-ES"):"—")+'</td></tr>'}).join("");
  const modal=document.createElement("div");modal.className="modal-backdrop";
  modal.innerHTML='<section class="modal-card rules-modal-card" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="eyebrow">HISTÓRICO DE RESULTADOS</span><h2>'+esc(field.nombre)+'</h2><p>'+values.length+' valores calculados · máximo 500 resultados recientes</p></div><button class="modal-close" type="button" aria-label="Cerrar">×</button></div><div class="table-wrap"><table><thead><tr><th>EXPEDIENTE</th><th>CONTRATO</th><th>APODERADO</th><th>RESULTADO</th><th>REGLA</th><th>CALCULADO</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="empty-row">Todavía no hay resultados calculados para este campo.</td></tr>')+'</tbody></table></div><div class="modal-actions"><button class="btn secondary" type="button" id="field-values-close">Cerrar</button></div></section>';
  document.body.append(modal);const close=()=>modal.remove();modal.querySelector(".modal-close").onclick=close;modal.querySelector("#field-values-close").onclick=close;modal.onclick=e=>{if(e.target===modal)close()};
}

const ruleSourceFields=[
  ["expediente","Expediente"],["oficina","Oficina"],["fecha_alta","Fecha alta"],["contrato","Contrato"],
  ["tipo_provision","Tipo provisión"],["notario","Notario"],["provincia","Provincia"],["municipio","Municipio"],
  ["comunidad","Comunidad"],["protocolo","Protocolo"],["fecha_protocolo","Fecha protocolo"],["vc","V.C."],
  ["apoderado","Apoderado"],["envio_notario","Envío notario"],["dias_excel","Días"]
];
const ruleTargetFields=[
  ["centro_encargo","Centro de encargo"],["tipo_gestion","Tipo Gestión"],["nombre_apoderado","Nombre del apoderado"],
  ["centro_firma","Centro que firma"],["entidad","Entidad"],["circuito_notarial","Circuito notarial"],["tipo_firma","Tipo de firma"]
];
function defaultEntityRule(){
  return {schema:1,logica:"AND",destino:{tipo:"registro",campo:"entidad"},condiciones:[
    {campo:"contrato",operador:"starts_with",valores:["9272","9320","9620"],resultado:"Caixabank"},
    {campo:"apoderado",operador:"in",valores:["Yolanda Vives Solsona","Pedro Pérez Sola","ALBERTO LOPEZ RODRIGUEZ","GASTON BEGUIRISTAIN AMORIN","Carlos Barbera García","Ferran Badia Caralps","Ana Cartagena Puerta","Víctor Tomás Castellsagué","GESTCANARIAS","GESGALICIA","YARZA GESTION","JULIO CUESTA","CASTILLO 11","GESTORIA MAS"],resultado:"Caixabank"}
  ],por_defecto:"Otra entidad"};
}
function ruleConditionMatches(record,c){
  const raw=record?.[c.campo],value=norm(raw??""),values=(c.valores||[]).map(v=>norm(v));
  if(c.operador==="empty")return !value;
  if(c.operador==="not_empty")return !!value;
  if(c.operador==="in")return values.includes(value);
  if(c.operador==="starts_with")return values.some(v=>v&&value.startsWith(v));
  if(c.operador==="lookup_notary_circuit")return !!record?.__lookup_circuito_notarial;
  if(c.operador==="equals")return value===values[0];
  if(c.operador==="not_equals")return value!==values[0];
  if(c.operador==="contains")return values[0]?value.includes(values[0]):false;
  if(c.operador==="greater_than")return Number(raw)>Number(c.valores?.[0]);
  if(c.operador==="less_than")return Number(raw)<Number(c.valores?.[0]);
  return false;
}
function evaluateRuleDefinition(record,definition){
  const conditions=definition?.condiciones||[];
  if(!conditions.length)return definition?.por_defecto??null;
  const matches=conditions.filter(c=>ruleConditionMatches(record,c));
  const passed=definition.logica==="AND"?matches.length===conditions.length:matches.length>0;
  return passed?(matches[0]?.resultado==="$origen"?String(record?.[matches[0]?.campo]??""):matches[0]?.resultado==="$lookup_circuito_notarial"?(record?.__lookup_circuito_notarial??definition.por_defecto??null):(matches[0]?.resultado??definition.por_defecto??null)):(definition.por_defecto??null);
}
async function ensureEntityRule(){
  const {data:fields,error}=await sb.from("estadisticas_campos_calculados").select("*").eq("codigo","entidad").limit(1);
  if(error)throw error;
  const field=fields?.[0];
  if(!field)throw new Error("No está configurado el campo de destino Entidad. Comprueba la migración de columnas adicionales.");
  return field;
}
async function reglas(h){
  await ensureEntityRule();
  const {data:fields,error}=await sb.from("estadisticas_campos_calculados").select("*").order("orden").order("nombre");
  if(error)throw error;
  const {data:rules,error:ruleError}=await sb.from("estadisticas_reglas_calculo").select("*").order("version",{ascending:false});
  if(ruleError)throw ruleError;
  const byField=new Map();
  (rules||[]).forEach(r=>{if(!byField.has(r.campo_id))byField.set(r.campo_id,[]);byField.get(r.campo_id).push(r)});
  const activeFields=(fields||[]).filter(f=>f.activo!==false);
  h.innerHTML=head("Reglas de negocio","Administra las condiciones que clasifican y calculan información sin modificar el Excel original.",'<button class="btn secondary small" data-goto="campos">ƒ Campos calculados</button>')
    +'<div class="notice"><strong>Reglas versionadas.</strong> Cada cambio crea una nueva versión y conserva las anteriores. Puedes probar una regla con expedientes reales antes de activarla. La previsualización no modifica expedientes ni históricos.</div>'
    +'<section class="card"><div class="card-title"><div><h3>Reglas por campo calculado</h3><p>'+activeFields.length+' campos · '+(rules||[]).length+' versiones guardadas</p></div></div>'
    +(activeFields.length?activeFields.map(f=>{
      const history=byField.get(f.id)||[],active=history.find(x=>x.activa)||history[0],version=active?.version||0;
      return '<article class="rule-card"><div class="rule-card-main"><div><span class="eyebrow">'+esc(f.codigo)+'</span><h3>'+esc(f.nombre)+'</h3><p>'+esc(f.descripcion||"Sin descripción")+'</p></div><span class="pill '+(active?.activa?"green":"")+'">'+(active?"Versión "+version+(active.activa?" · Activa":" · Inactiva"):"Sin regla")+'</span></div><div class="rule-card-actions"><span class="muted small">'+history.length+' versión(es) guardadas</span><div class="row-actions"><button class="btn secondary small" data-rule-preview="'+f.id+'" '+(!active?"disabled":"")+'>Probar regla</button><button class="btn primary small" data-rule-edit="'+f.id+'">'+(active?"Editar / nueva versión":"Crear regla")+'</button></div></div></article>';
    }).join(""):'<div class="empty-row">Todavía no hay campos calculados.</div>')
    +'</section><div id="rule-preview-output"></div>';
  wire();
  $$("[data-rule-edit]").forEach(b=>b.onclick=()=>reglaModal(activeFields.find(f=>f.id===b.dataset.ruleEdit),byField.get(b.dataset.ruleEdit)?.find(x=>x.activa)||byField.get(b.dataset.ruleEdit)?.[0]||null));
  $$("[data-rule-preview]").forEach(b=>b.onclick=async()=>{
    const field=activeFields.find(f=>f.id===b.dataset.rulePreview),rule=byField.get(field.id)?.find(x=>x.activa)||byField.get(field.id)?.[0];
    if(!rule)return;
    await previewRule(field,rule.definicion,$("#rule-preview-output"));
  });
}
function ruleConditionRow(condition,index){
  const operators=[["in","Es uno de"],["starts_with","Empieza por"],["lookup_notary_circuit","Buscar circuito en catálogo notarial"],["equals","Es igual a"],["not_equals","Es distinto de"],["contains","Contiene"],["empty","Está vacío"],["not_empty","No está vacío"],["greater_than","Mayor que"],["less_than","Menor que"]];
  const fields=ruleSourceFields.map(f=>'<option value="'+f[0]+'" '+(condition.campo===f[0]?"selected":"")+'>'+f[1]+'</option>').join("");
  const ops=operators.map(o=>'<option value="'+o[0]+'" '+((condition.operador||"in")===o[0]?"selected":"")+'>'+o[1]+'</option>').join("");
  const sourceMode=condition.resultado==="$origen",lookupMode=condition.resultado==="$lookup_circuito_notarial";
  return '<div class="rule-condition" data-rule-condition="'+index+'"><div class="field"><label>Columna original del Excel</label><select data-rule-field>'+fields+'</select></div><div class="field"><label>Condición</label><select data-rule-operator>'+ops+'</select></div><div class="field rule-values-field"><label>Valor(es)</label><input data-rule-values value="'+esc((condition.valores||[]).join(", "))+'" placeholder="Separar varios valores con comas"></div><div class="field"><label>Resultado</label><select data-rule-result-mode><option value="fixed" '+(!sourceMode?"selected":"")+'>Valor fijo</option><option value="source" '+(sourceMode?"selected":"")+'>Copiar valor de origen</option><option value="lookup" '+(lookupMode?"selected":"")+'>Circuito del catálogo de notarios</option></select><input data-rule-result value="'+esc(sourceMode||lookupMode?"":condition.resultado||"")+'" placeholder="Resultado" '+(sourceMode||lookupMode?"disabled":"")+'></div><button type="button" class="btn danger small rule-remove" data-rule-remove="'+index+'" title="Eliminar condición">×</button></div>';
}
function collectRuleDefinition(){
  const conditions=$$(".rule-condition").map(row=>{
    const op=row.querySelector("[data-rule-operator]").value;
    const raw=row.querySelector("[data-rule-values]").value.trim();
    const values=["empty","not_empty","lookup_notary_circuit"].includes(op)?[]:(["in","starts_with"].includes(op)?raw.split(",").map(x=>x.trim()).filter(Boolean):(raw?[raw]:[]));
    const mode=row.querySelector("[data-rule-result-mode]")?.value||"fixed";
    return {campo:row.querySelector("[data-rule-field]").value,operador:op,valores:values,resultado:mode==="source"?"$origen":mode==="lookup"?"$lookup_circuito_notarial":row.querySelector("[data-rule-result]").value.trim()};
  });
  const [targetType,targetId]=($("#rule-target").value||"").split(":");
  const destino=targetType==="registro"?{tipo:"registro",campo:targetId}:{tipo:"calculado",campo_id:targetId};
  return {schema:1,logica:$("#rule-logic").value,destino,prioridad:Number($("#rule-priority").value)||100,condiciones:conditions,por_defecto:$("#rule-default").value.trim()};
}
async function reglaModal(field,currentRule=null){
  if(!field)return;
  const {data:history,error}=await sb.from("estadisticas_reglas_calculo").select("*").eq("campo_id",field.id).order("version",{ascending:false});
  if(error)throw error;
  const {data:calculatedFields,error:fieldsError}=await sb.from("estadisticas_campos_calculados").select("id,codigo,nombre").eq("activo",true).order("orden").order("nombre");
  if(fieldsError)throw fieldsError;
  const current=history?.find(x=>x.activa)||currentRule||history?.[0]||null;
  const definition=current?.definicion||{schema:1,logica:"OR",condiciones:[],por_defecto:""};
  const fixedTargets=ruleTargetFields.map(([code,label])=>'<option value="registro:'+code+'">'+esc(label)+' · columna de expediente</option>').join("");
  const fixedCodes=new Set(ruleTargetFields.map(x=>x[0]));
  const calculatedTargets=(calculatedFields||[]).filter(x=>!fixedCodes.has(x.codigo)).map(x=>'<option value="calculado:'+x.id+'">'+esc(x.nombre)+' · campo calculado</option>').join("");
  const defaultTarget=ruleTargetFields.some(x=>x[0]===field.codigo)?"registro:"+field.codigo:"calculado:"+field.id;
  const targetValue=definition.destino?.tipo==="registro"?"registro:"+definition.destino.campo:definition.destino?.tipo==="calculado"?"calculado:"+definition.destino.campo_id:defaultTarget;
  const modal=document.createElement("div");modal.id="rules-modal";modal.className="modal-backdrop";
  modal.innerHTML='<section class="modal-card rules-modal-card" role="dialog" aria-modal="true" aria-labelledby="rules-modal-title"><div class="modal-head"><div><span class="eyebrow">MOTOR DE REGLAS · '+esc(field.codigo)+'</span><h2 id="rules-modal-title">'+esc(field.nombre)+'</h2><p>Elige dónde se guardará el resultado y define las condiciones que lo generan.</p></div><button type="button" class="modal-close" id="rules-close" aria-label="Cerrar">×</button></div><form id="rules-form"><div class="field-grid"><div class="field full-span"><label for="rule-target">Columna de destino del resultado *</label><select id="rule-target" required>'+fixedTargets+calculatedTargets+'</select><small class="field-help">Las columnas de expediente actualizan el registro. Los campos calculados guardan el resultado con trazabilidad de regla y versión.</small></div><div class="field"><label for="rule-logic">Aplicar condiciones con</label><select id="rule-logic"><option value="OR" '+(definition.logica!=="AND"?"selected":"")+'>Cualquiera (O)</option><option value="AND" '+(definition.logica==="AND"?"selected":"")+'>Todas (Y)</option></select></div><div class="field"><label for="rule-default">Resultado si ninguna coincide</label><input id="rule-default" maxlength="180" value="'+esc(definition.por_defecto||"")+'" placeholder="Ej. Otra entidad"></div><div class="field"><label for="rule-priority">Prioridad</label><input id="rule-priority" type="number" min="1" max="9999" value="'+Number(current?.prioridad||definition.prioridad||100)+'"><small class="field-help">Si varias reglas escriben en el mismo destino, la prioridad menor se aplica primero.</small></div></div><div class="rule-editor-heading"><div><h3>Condiciones</h3><p>Se evalúan según el operador Y / O seleccionado.</p></div><button type="button" class="btn secondary small" id="rule-add-condition">＋ Añadir condición</button></div><div id="rule-condition-list">'+(definition.condiciones||[]).map((c,i)=>ruleConditionRow(c,i)).join("")+'</div><div id="rule-modal-preview" class="rule-preview-inline"></div><div class="modal-actions"><span class="muted small">Se creará una nueva versión para el destino seleccionado</span><button type="button" class="btn secondary" id="rule-test">Probar antes de guardar</button><button type="button" class="btn secondary" id="rules-cancel">Cancelar</button><button type="submit" class="btn primary" id="rules-save">Guardar y activar versión</button></div></form></section>';
  document.body.append(modal);
  $("#rule-target").value=targetValue;
  const close=()=>modal.remove();$("#rules-close").onclick=close;$("#rules-cancel").onclick=close;modal.addEventListener("click",e=>{if(e.target===modal)close()});
  const bindRows=()=>{
    $$("[data-rule-remove]").forEach(b=>b.onclick=()=>{b.closest(".rule-condition").remove()});
    $$("[data-rule-operator]").forEach(s=>{const sync=()=>{const v=s.closest(".rule-condition").querySelector("[data-rule-values]");v.disabled=["empty","not_empty","lookup_notary_circuit"].includes(s.value)};s.onchange=sync;sync()});
    $$("[data-rule-result-mode]").forEach(s=>{const sync=()=>{const v=s.closest(".rule-condition").querySelector("[data-rule-result]");v.disabled=s.value!=="fixed"};s.onchange=sync;sync()});
  };
  const addCondition=(c={campo:"contrato",operador:"in",valores:[],resultado:""})=>{
    const list=$("#rule-condition-list"),index=list.querySelectorAll(".rule-condition").length,wrap=document.createElement("div");wrap.innerHTML=ruleConditionRow(c,index);list.append(wrap.firstElementChild);bindRows();
  };
  bindRows();$("#rule-add-condition").onclick=()=>addCondition();
  $("#rule-test").onclick=async()=>{
    const d=collectRuleDefinition(),out=$("#rule-modal-preview");out.innerHTML='<span class="muted small">Probando con expedientes...</span>';
    try{await previewRule(field,d,out)}catch(e){out.innerHTML='<div class="notice">No se pudo probar: '+esc(e.message)+'</div>'}
  };
  $("#rules-form").onsubmit=async e=>{
    e.preventDefault();const save=$("#rules-save");save.disabled=true;save.textContent="Guardando…";
    const d=collectRuleDefinition();
    if(!d.destino.campo&&!d.destino.campo_id){msg("Selecciona una columna de destino.");save.disabled=false;save.textContent="Guardar y activar versión";return}
    if(!d.condiciones.length||d.condiciones.some(c=>!c.campo||(!c.resultado&&c.resultado!=="$origen"&&c.resultado!=="$lookup_circuito_notarial")||(!["empty","not_empty","lookup_notary_circuit"].includes(c.operador)&&!c.valores.length))){msg("Completa todas las condiciones y sus resultados.");save.disabled=false;save.textContent="Guardar y activar versión";return}
    const now=new Date().toISOString();
    try{
      const [destinationType,destinationId]=($("#rule-target").value||"").split(":");
      const destinationFieldId=destinationType==="registro"?(calculatedFields||[]).find(x=>x.codigo===destinationId)?.id:null;
      const targetFieldId=destinationType==="calculado"?destinationId:destinationFieldId;
      if(!targetFieldId)throw new Error("No se ha encontrado el campo asociado al destino seleccionado.");
      const {data:targetHistory,error:targetHistoryError}=await sb.from("estadisticas_reglas_calculo").select("version").eq("campo_id",targetFieldId);
      if(targetHistoryError)throw targetHistoryError;
      const version=(targetHistory||[]).reduce((m,r)=>Math.max(m,r.version||0),0)+1;
      const {data:newRule,error:insertError}=await sb.from("estadisticas_reglas_calculo").insert({campo_id:targetFieldId,version,prioridad:d.prioridad,definicion:d,activa:false,motor:"expresion_v1",notas:"Regla configurada desde el módulo Reglas de negocio."}).select("id").single();
      if(insertError)throw insertError;
      const {error:deactivateError}=await sb.from("estadisticas_reglas_calculo").update({activa:false,vigente_hasta:now}).eq("campo_id",targetFieldId).eq("activa",true);
      if(deactivateError)throw deactivateError;
      const {error:activateError}=await sb.from("estadisticas_reglas_calculo").update({activa:true,vigente_desde:now,vigente_hasta:null}).eq("id",newRule.id);
      if(activateError)throw activateError;
      close();msg("Regla v"+version+" guardada y activada");await reglas($("#view-container"));
    }catch(err){msg("No se pudo guardar: "+err.message);save.disabled=false;save.textContent="Guardar y activar versión"}
  };
}
async function previewRule(field,definition,target){
  const columns=ruleSourceFields.map(x=>x[0]).join(",");
  const {data,error}=await sb.from("estadisticas_registros").select("id,"+columns).limit(5000);
  if(error)throw error;
  const rows=data||[],counts={};
  if((definition.condiciones||[]).some(c=>c.operador==="lookup_notary_circuit")){
    let notaries=[],from=0;
    while(true){const q=await sb.from("ctn_notarios").select("nombre,apellidos,provincia").range(from,from+999);if(q.error)throw q.error;notaries=notaries.concat(q.data||[]);if(!q.data||q.data.length<1000)break;from+=1000}
    const circuits=new Map(notaries.map(n=>[norm([n.nombre,n.apellidos].filter(Boolean).join(" ")),["las palmas de gran canaria","santa cruz de tenerife"].includes(norm(n.provincia))?"Canarias":"Península"]));
    rows.forEach(r=>{r.__lookup_circuito_notarial=circuits.get(norm(r.notario))||null});
  }
  const results=rows.map(r=>{const value=evaluateRuleDefinition(r,definition);const label=String(value??"Sin resultado");counts[label]=(counts[label]||0)+1;return {...r,_rule_value:label}});
  const samples=results.slice(0,8).map(r=>'<tr><td>'+esc(r.expediente||"—")+'</td><td>'+esc(r.contrato||"—")+'</td><td>'+esc(r.apoderado||"—")+'</td><td><strong>'+esc(r._rule_value)+'</strong></td></tr>').join("");
  const destinationLabel=definition.destino?.tipo==="registro"?(ruleTargetFields.find(x=>x[0]===definition.destino.campo)?.[1]||definition.destino.campo):"Campo calculado";
  target.innerHTML='<section class="card rule-preview-card"><div class="card-title"><div><h3>Previsualización · '+esc(destinationLabel)+'</h3><p>'+rows.length+' expedientes revisados · sin cambios en los datos</p></div><span class="pill green">Solo simulación</span></div><div class="rule-result-stats">'+Object.entries(counts).map(([k,v])=>'<div><small>'+esc(k)+'</small><strong>'+v+'</strong></div>').join("")+'</div><div class="table-wrap"><table><thead><tr><th>EXPEDIENTE</th><th>CONTRATO</th><th>APODERADO</th><th>RESULTADO PREVISTO</th></tr></thead><tbody>'+(samples||'<tr><td colspan="4" class="empty-row">No hay expedientes para probar.</td></tr>')+'</tbody></table></div><p class="field-help">La prueba es solo una simulación y no modifica datos. Las reglas activas se aplican automáticamente a cada nuevo expediente al consolidar la importación, conservando la versión utilizada. Los expedientes ya importados no se modifican.</p></section>';
}

function informes(h){h.innerHTML=head(titles[view],view==="evolucion"?"Consulta la evolución mensual, anual y comparativa.":"Los informes se alimentarán del histórico validado.")+`<div class="grid quick-grid">${quick("▥","Actividad por oficina","Volumen y distribución","expedientes")}${quick("⌁","Tiempos de firma","Días entre hitos","expedientes")}${quick("▧","Centro y circuito","Distribución de actividad","catalogos")}</div><section class="card" style="margin-top:17px"><div class="empty-chart"><div><strong>Informes preparados</strong>Se activarán con el primer periodo validado.</div></div></section>`;wire()}
function ajustes(h){h.innerHTML=head("Configuración","Preferencias generales y seguridad del espacio de trabajo.")+`<div class="grid content-grid"><section class="card"><div class="card-title"><h3>Acceso y seguridad</h3><span class="pill green">Activo</span></div><div class="status-line"><span>Usuario autorizado</span><b>${OWNER}</b></div><div class="status-line"><span>Proveedor de identidad</span><b>Supabase Auth OTP</b></div><div class="status-line"><span>Persistencia de datos</span><b>Supabase PostgreSQL</b></div><div class="status-line"><span>Almacenamiento de negocio local</span><b class="ok">Desactivado</b></div></section><section class="card"><div class="card-title"><h3>Plataforma</h3></div><div class="status-line"><span>Región</span><b>EU · Irlanda</b></div><div class="status-line"><span>Zona horaria</span><b>Europe/Madrid</b></div><div class="status-line"><span>Histórico mensual</span><b>Preparado</b></div></section></div>`}
async function boot(){let {data:{session}}=await sb.auth.getSession();if(session?.user?.email?.toLowerCase()===OWNER)showApp();else if(session){await sb.auth.signOut();$("#auth-screen").classList.remove("hidden")}}
function showApp(){$("#auth-screen").classList.add("hidden");$("#app").classList.remove("hidden");setView("dashboard")}
$("#login-form").onsubmit=async e=>{e.preventDefault();let email=$("#login-email").value.trim().toLowerCase();if(email!==OWNER){$("#auth-message").textContent="Este correo no está autorizado.";return}$("#auth-message").textContent="Enviando enlace seguro…";let {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:window.location.origin}});if(error){$("#auth-message").textContent=error.message;return}$("#auth-message").textContent="Enlace de acceso enviado. Ábrelo desde este mismo navegador para entrar."};
$("#logout").onclick=async()=>{await sb.auth.signOut();$("#app").classList.add("hidden");$("#auth-screen").classList.remove("hidden");$("#login-form").classList.remove("hidden");$("#otp-form").classList.add("hidden")};
$("#main-nav").onclick=e=>{let b=e.target.closest("[data-view]");if(b)setView(b.dataset.view)};
$("#sidebar-collapse").onclick=()=>document.body.classList.toggle("collapsed");
sb.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT"){$("#app").classList.add("hidden");$("#auth-screen").classList.remove("hidden")}});
boot();