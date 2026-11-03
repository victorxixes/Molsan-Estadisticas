# Auditoría funcional y propuesta de reconstrucción — Molsan Estadísticas

**Fecha:** 3 de noviembre de 2026  
**Repositorio:** `victorxixes/Molsan-Estadisticas`  
**Rama de trabajo:** `rebuild/molsan-control-platform`  
**Rama de referencia:** `main`  
**Alcance de esta entrega:** inventario completo del árbol versionado y auditoría estática de la aplicación, sus módulos, persistencia, importación/restauración, permisos, reglas, informes, paneles y estilos.

> Esta revisión se basa en el código fuente disponible en GitHub. No se han ejecutado todavía pruebas funcionales con un Excel real, datos de producción ni navegador automatizado. Por tanto, los defectos descritos como confirmados se deducen directamente del código; los resultados de ejecución y la calidad real de los históricos quedan pendientes de pruebas controladas.

## 1. Inventario

El árbol de la rama principal contiene **72 entradas: 68 archivos y 4 directorios**.

| Área | Contenido inventariado | Función |
|---|---:|---|
| HTML | `index.html` y 8 plantillas bajo `modules/` | Shell, navegación y vistas |
| JavaScript | 38 archivos bajo `js/` | Persistencia, reglas, importación, informes y paneles |
| CSS | 19 archivos bajo `css/` | Tema, layout, componentes, tablas y módulos |
| Imagen | 1 SVG | Logotipo |
| Documentación/configuración | `README.md`, `.gitignore` | Descripción y exclusiones |

La aplicación actual es una SPA construida con HTML, CSS y JavaScript sin framework ni proceso de compilación. El `index.html` carga Chart.js y SheetJS desde CDN. El CSS principal importa 15 hojas; algunas hojas existentes no están incluidas en ese agregador.

## 2. Funcionalidades existentes que deben conservarse

1. Dashboard con comparación anual, KPIs, evolución mensual, máximos/mínimos y tablas comparativas.
2. Listado de firmas con filtros, ordenación, paginación y ficha de detalle.
3. Importación de Excel con normalización de campos y cálculo de atributos derivados.
4. Informes: general, anual, mensual, apoderados, oficinas, circuito, tipo de firma, centro que firma y tiempos.
5. Paneles especializados: anual, mensual, apoderados, tipo de firma, tipo de gestión, oficinas, circuito, centro que firma y SLA.
6. Informe evolutivo histórico.
7. Generación e impresión de actas de reunión.
8. Exportación/backup JSON y restauración.
9. Configuración de reglas y permisos, aunque su implementación actual es incompleta y no debe trasladarse sin rediseño.

Estas funciones constituyen el inventario funcional de partida. No se propone eliminar ninguna categoría útil; se propone consolidarlas donde haya duplicidad y mantener trazabilidad de las métricas.

## 3. Hallazgos confirmados por código

### Críticos — integridad y seguridad

**A. Importación destructiva sin transacción global**
- `js/importador.js` ejecuta `borrarFirmas()` antes de guardar el Excel.
- Si el fichero está incompleto, mal mapeado o falla una escritura posterior, los registros anteriores ya se han eliminado y puede quedar una importación parcial.
- No hay vista previa de diferencias, política de duplicados, validación integral ni rollback.
- El mapeo crea un objeto con un conjunto fijo de columnas; cualquier columna adicional del Excel no queda preservada en el registro normalizado.
- **Acción:** sustituir por zona de staging, validación, resumen de altas/cambios/duplicados/errores y confirmación explícita; escritura transaccional y posibilidad de revertir.

**B. La base de datos actual es local al navegador**
- `js/storage.js` abre IndexedDB con nombre `molsanDB` y almacén `firmas`.
- Los datos y KPIs viven en el navegador del equipo. No hay API ni base central compartida entre dispositivos.
- El almacén se crea sin índices de búsqueda y las consultas usan `getAll()`, filtrando después en memoria.
- **Acción:** PostgreSQL como fuente central de verdad y API autenticada; mantener exportación íntegra para migración y contingencia.

**C. Permisos no constituyen seguridad**
- `js/permisos.js` guarda permisos en `localStorage` y bloquea controles de interfaz.
- Un usuario puede modificar ese almacenamiento o invocar directamente funciones desde la consola. No existe autenticación ni autorización en servidor.
- El estado inicial vacío permite continuar sin una identidad verificada.
- **Acción:** autenticación real de cuenta única y autorización en backend para cada operación; el control visual será solo UX.

**D. Riesgo de inyección HTML (XSS) desde datos importados**
- `js/listado.js` construye filas y el detalle con `innerHTML` interpolando campos del Excel, por ejemplo expediente, oficina, notario, municipio y apoderado.
- `js/restore.js` inserta valores del JSON restaurado en celdas HTML mediante `innerHTML`.
- Varios informes y paneles generan HTML dinámico a partir de valores de los registros.
- **Acción:** renderizado con `textContent`/nodos DOM o escape contextual centralizado; sanitización específica solo para contenido enriquecido del editor.

### Altos — comportamiento funcional y cálculos

**E. Restauración no es segura ante errores**
- `js/restore.js` borra primero el almacén y luego inserta lotes de 500.
- Si un lote falla, no recupera automáticamente los datos previos.
- La validación comprueba únicamente que haya `datos`, `kpis` y `total_registros`; no valida versión, esquema, tipos, límites ni coherencia del número de registros.
- El backup conserva los KPIs locales, pero no existe catálogo de copias, retención ni comprobación de integridad.
- **Acción:** validar versión y esquema, calcular checksum, restaurar en staging y promover de forma atómica; conservar copia previa.

**F. Clasificación automática puede ocultar casos desconocidos**
- `js/reglas.js` asigna por defecto `Con provisión` cuando el texto no coincide con las opciones reconocidas.
- Los notarios no reconocidos se convierten en `FALSO` y después en `Circuito Externo`; se pierde la distinción entre un externo real y un dato pendiente de clasificar.
- El fuzzy matching con distancia Levenshtein de hasta 3 puede asignar un circuito sin confirmación humana.
- El tipo de firma solo se reconoce si el campo VC es exactamente `N` o `S`.
- **Acción:** reglas versionadas, resultados `clasificado / pendiente / ambiguo`, cola de revisión y registro de la regla que produjo cada valor.

**G. Inconsistencias de campos y fórmulas**
- En `aplicarReglas()`, `obtenerApellidos()` se ejecuta antes de clasificar `f.contrato`; recibe el valor original del Excel aunque su lógica compara con las etiquetas ya clasificadas `CaixaBank` y `Externa`.
- `js/informes-general.js` separa el SLA buscando “caixa” en `tipo_gestion`, aunque la regla de ese campo devuelve principalmente “Con provisión / Sin provisión”; esa segmentación no representa de forma fiable la entidad.
- `js/informes-tiempos.js` decide CaixaBank/Otra entidad a partir de un texto concreto en `apoderado`, no del campo de contrato o una dimensión de entidad normalizada.
- `js/informes-evolutivo.js` usa una ventana fija 2020–2026 y calcula porcentajes como `(actual - anterior) / actual`, mientras el gráfico de porcentaje usa `(actual - anterior) / anterior`. Las cifras de tabla y gráfico pueden discrepar; además, el denominador de la tabla no es la fórmula habitual de variación interanual.
- **Acción:** diccionario único de métricas y dimensiones; cálculos compartidos en servicios de dominio y pruebas con casos de referencia antes de validar cifras históricas.

**H. Identificadores y fechas requieren normalización**
- `storage.js` usa un ID autoincremental local, sin una clave de negocio ni una restricción de unicidad.
- `reglas.js` convierte fechas y seriales Excel con lógica propia; deben probarse seriales, fechas ambiguas, celdas vacías y valores de texto.
- **Acción:** preservar valores originales, normalizar fechas a ISO y definir una clave de importación tras analizar el Excel real. No se debe asumir que el número de expediente es único.

**G.1. El Dashboard y varios KPIs interpretan el mes con un tipo incorrecto**
- `reglas.js` guarda `mes` como texto (`enero`, `febrero`, etc.).
- `dashboard.js` convierte repetidamente `f.mes` con `Number()`; `kpis.js` hace lo mismo en `kpi_mesMasFuerte()` y `kpi_detalleMensual()`. Para nombres de mes, el resultado es `NaN`, por lo que los meses fuertes, comparativas mensuales y algunos filtros temporales no se calculan correctamente.
- **Acción:** almacenar `mes_numero` como dimensión numérica derivada y `mes_nombre` como etiqueta; usar una función común de conversión y pruebas por cada mes.

**G.2. Filtros auxiliares no respetan el contrato de datos**
- `js/filtros.js` compara `fila.anio !== filtros.anio` sin normalizar tipos; los años del formulario suelen ser texto y los registros importados guardan el año como número.
- El filtro de apoderado compara `fila.nombre` con el argumento, aunque el campo visible/origen de apoderado es `fila.apoderado`.
- **Acción:** normalizar tipos y acordar los campos de búsqueda con el diccionario de datos; cubrir cada filtro con pruebas.

### Medios — módulos, integración y mantenimiento

**I. Módulos duplicados o desconectados**
- Hay plantillas bajo `modules/` que duplican vistas integradas en `index.html`.
- Las plantillas externas `modules/backup.html` y `modules/restore.html` no están integradas en el `index.html`. Sin embargo, la configuración contiene botones que llaman a `cargarModulo('backup')` y `cargarModulo('restore')`; como no existen `tpl-backup` ni `tpl-restore` en el DOM, esas rutas no pueden cargar su vista.
- La plantilla externa de backup usa `crearBackup()`, mientras la lógica expone `generarBackup()`; además, la lógica busca `btnHacerBackup`, que no existe en esa plantilla.
- La plantilla externa de restauración usa `restorePreview`, mientras la lógica busca `previewContainer`, `previewFecha`, `previewTotal`, `previewTabla`, etc. El contrato entre HTML y JS no coincide.
- `panel-tipo-mensual.js` está cargado, pero no existe plantilla `tpl-panel-mensual`, entrada de navegación ni caso de inicialización correspondiente en `main.js`; el panel queda huérfano.
- Los HTML de `modules/` son copias/plantillas independientes y no se cargan automáticamente desde el shell; la fuente efectiva de vistas es el conjunto de plantillas integrado en `index.html`.
- `main.js` inicializa algunos módulos por claves concretas; el listado de navegación y plantillas debe mantenerse como un único registro para evitar vistas inaccesibles.
- **Acción:** inventario único de rutas/módulos, componentes y contratos de vista; retirar duplicados solo después de comprobar que ninguna ruta los utiliza.

**J. Configuración y permisos duplicados**
- `configuracion.js` se limita a aplicar permisos, pese a que la plantilla externa de configuración ofrece mapas editables.
- Las reglas de normalización están hardcodeadas en `reglas.js`; no hay lectura/escritura efectiva de esos mapas desde la pantalla.
- `configuracion.js` y `permisos.js` declaran funciones globales con el mismo nombre `guardarPermisos()`; el orden de carga puede sobrescribir una implementación con otra.
- La plantilla de permisos integrada contiene `permVerTodo`, pero no se ha confirmado que el resto de controles coincidan con la implementación en todas las plantillas.
- **Acción:** catálogo de reglas editable, con validación y auditoría; eliminar funciones globales duplicadas.

**K. Errores de mantenimiento**
- `main.js` abre `molsanDB` pero la función de reinicio intenta borrar `molsan_db`; no es la misma base.
- `backup.html` invoca un nombre de función que no existe en la lógica actual.
- Algunos informes usan `chartActual` fuera del registro compartido `charts`; `resetChart()` solo destruye los elementos del array, de modo que los gráficos creados por esas funciones no quedan gestionados por el mismo ciclo de vida y pueden acumular instancias al regenerarse.
- **Acción:** módulos con ámbito explícito, registro único de gráficos y pruebas de carga de todos los módulos.

**L. Actas**
- `panel-acta-reunion.js` genera el documento en memoria y permite imprimirlo mediante una ventana nueva.
- Al salir del módulo, `initActaReunion()` reinicia los puntos y vacía el acta; no existe persistencia de borradores, historial, recuperación ni edición posterior del documento generado.
- **Acción:** convertirlo en editor documental con borradores persistentes, snapshots inmutables al guardar, plantillas, asistentes, agenda, acuerdos, responsables, fechas y tareas.

## 4. Revisión visual y CSS

- La paleta actual no coincide con la corporativa aprobada: el tema usa `#F7F9FC`, azul primario `#4DB5FF`, texto `#0A3A67` y bordes `#D9E2EC`. La nueva identidad debe usar `#FFFFFF`, `#F2F7FB`, `#EAF2F8`, `#D8E4EC`, `#064675` y `#617789`.
- El agregador `css/molsan.css` importa dos hojas de layout con reglas coincidentes (`layout-engine.css` y `layout-molsan-2027.css`).
- Existen hojas `tablas-excel.css` y `reports.css` que no aparecen en los imports del agregador, por lo que sus reglas no se aplican desde esa entrada.
- Las reglas de estilos están repartidas por módulos; varios estilos de actas se inyectan también desde JavaScript.
- El sidebar contiene iconos emoji en vez de un sistema consistente de iconos SVG.
- **Acción:** tokens y componentes únicos, sin CSS duplicado; cabecera y espaciado compartidos, tablas accesibles, iconografía SVG, responsive y contraste comprobado.

## 5. Arquitectura objetivo

### Frontend
Static Site independiente, sin secretos ni conexión directa a PostgreSQL. Interfaz modular, autenticación de sesión, llamadas a API por HTTPS, gestión de estados de carga/error y editor de documentos.

### API
Servicio web de backend separado. Toda lectura/escritura pasa por endpoints autenticados. La API valida esquemas, aplica permisos, ejecuta reglas de negocio, registra operaciones y protege las importaciones. No confiar en permisos del navegador.

### Base de datos
PostgreSQL administrado. Propuesta inicial de dominios:
- `firmas`: registro normalizado actual.
- `importaciones` y `importacion_filas`: fichero, fecha, usuario, hash, resultados y errores.
- `reglas_clasificacion` y `reglas_versiones`: diccionario configurable y trazabilidad.
- `dimensiones`: oficinas, apoderados, notarios, circuitos, centros, tipos de firma y gestión.
- `informes` y `informe_versiones`: contenido guardado y snapshot de datos/indicadores usado para generarlo.
- `actas`, `acta_asistentes`, `acta_puntos`, `acta_acuerdos` y `tareas`.
- `backups` y `audit_log`: historial de operaciones relevantes.

El esquema final y la clave de negocio se decidirán tras perfilar el Excel real y comparar los registros existentes. Se conservará el dato original importado junto con los valores normalizados y la versión de reglas aplicada.

### Acceso de cuenta única
Una única identidad autorizada, con contraseña almacenada solo como hash robusto, sesiones seguras en cookies HttpOnly/Secure/SameSite, protección CSRF, limitación de intentos, cierre de sesión y recuperación controlada. No se construirá un sistema multiusuario/RBAC innecesario.

**Nota de red Render:** un Static Site no puede consumir directamente una Private Service de Render desde el navegador. Para una SPA, la API tendrá que exponer HTTPS de forma controlada y exigir autenticación; la base PostgreSQL sí permanecerá accesible solo desde backend/red privada. No se expondrá la cadena de conexión en frontend.

## 6. Migración segura

1. Obtener un backup original sin modificar el navegador o base de datos fuente.
2. Verificar el JSON y el Excel de origen; contar filas, columnas, vacíos, duplicados, fechas y valores no clasificados.
3. Definir el diccionario de datos y reglas con ejemplos reales revisados.
4. Importar primero a staging, sin tocar la tabla productiva.
5. Comparar recuentos y totales por año, mes, oficina, apoderado, circuito, tipo de firma y provisión.
6. Resolver diferencias y obtener aprobación de los resultados.
7. Promover mediante transacción; conservar copia anterior y registro de migración.
8. Ejecutar pruebas de regresión de informes y actas.
9. Solo después, validar despliegue Preview y plan de vuelta atrás. La web actual seguirá operativa hasta la aceptación.

## 7. Plan de trabajo

- **Fase 1 — Auditoría y diccionario:** cerrar el inventario, resolver contradicciones de métricas y documentar contratos de importación.
- **Fase 2 — Diseño:** arquitectura API/DB, modelo de datos, autenticación, navegación y sistema visual.
- **Fase 3 — Base técnica:** frontend nuevo, API, PostgreSQL, migraciones versionadas, logging y backups.
- **Fase 4 — Funciones:** dashboard, listado, paneles, informes, editor de informes y editor de actas.
- **Fase 5 — Migración y pruebas:** staging, comparación de históricos, seguridad, permisos, responsive, exportación y recuperación.
- **Fase 6 — Preview y aceptación:** despliegue separado, validación por el usuario y plan de rollback antes de cualquier sustitución.

## 8. Límites y estado de esta auditoría

- **Inventario del árbol:** completado para el commit de `main` identificado por el SHA `d3df6bccef9fb6cf095d66904f9880487a3b3e0e`.
- **Lectura estática:** revisados los ficheros HTML, CSS y JavaScript del árbol y sus referencias cruzadas principales.
- **Pruebas de ejecución:** pendientes; no se han ejecutado imports reales, consultas con el histórico ni pruebas en navegador.
- **Datos reales:** no se han descargado, alterado ni migrado datos.
- **Render:** no se han modificado servicios, variables, dominios, despliegues ni bases de datos.
- **Producción:** sin cambios.
- **Trabajo añadido a la rama:** informe de auditoría, arquitectura técnica, diccionario preliminar, scaffold de API Node.js/TypeScript y primera migración SQL propuesta. El scaffold solo incluye health checks y conexión PostgreSQL; aún no tiene autenticación ni endpoints de negocio.
- **Siguiente hito:** perfilar una copia del Excel/backup, cerrar las reglas y métricas con datos reales, instalar dependencias y ejecutar typecheck/pruebas de API, y validar la migración en PostgreSQL aislado.
