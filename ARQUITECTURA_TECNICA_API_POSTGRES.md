# Arquitectura técnica propuesta — Molsan Estadísticas

**Estado:** diseño previo a implementación.  
**Rama:** `rebuild/molsan-control-platform`  
**Principio:** reconstrucción independiente; el frontend y los datos actuales permanecen intactos hasta completar pruebas y aceptación.

## 1. Decisiones técnicas

| Capa | Decisión | Motivo |
|---|---|---|
| Frontend | Static Site independiente, HTML/CSS/JS modular | Mantener despliegue ligero y separar la interfaz del servidor |
| API | Node.js LTS + TypeScript + Fastify | Tipado, validación de contratos y API mantenible |
| Persistencia | PostgreSQL administrado | Fuente central de verdad, transacciones, índices y backups |
| Validación | Zod o JSON Schema compartido | Validar entradas en cada endpoint |
| Consultas | SQL parametrizado mediante `pg` | Control explícito de consultas y transacciones |
| Sesión | Cookie HttpOnly + Secure + SameSite; sesiones persistidas en DB | Una cuenta autorizada sin guardar tokens en localStorage |
| Contraseñas | Argon2id | Hash robusto; nunca almacenar contraseña en claro |
| Pruebas | Vitest + pruebas de integración API/DB | Regresión de reglas, métricas, importaciones y permisos |

Las versiones exactas se fijarán al crear el proyecto y se bloquearán en el lockfile. Ningún secreto, credencial, hash de contraseña o cadena de conexión se incorporará al frontend ni al repositorio.

## 2. Despliegue objetivo en Render

1. **Static Site**: sirve únicamente los activos del frontend.
2. **Web Service de API**: expone HTTPS con autenticación obligatoria. El frontend del navegador no puede llamar directamente a una Private Service de Render; por eso la API tendrá un punto HTTPS público controlado. Todas las rutas privadas requieren sesión y validación.
3. **PostgreSQL**: accesible desde el backend por red privada; sin conexión directa desde el navegador.
4. **Secretos**: variables protegidas en Render, nunca en archivos versionados.
5. **Entornos**: Preview/validación aislado y producción separada. No se conectará el Preview a la base productiva.
6. **Backups**: backups automáticos de PostgreSQL más exportaciones verificadas de aplicación; restauración probada periódicamente.

No se cambiarán los servicios existentes ni se creará/modificará infraestructura Render hasta aprobar el diseño y tener una implementación comprobable.

## 3. Estructura de proyecto propuesta

```
/
  frontend/
    index.html
    assets/
    src/
      app/
      components/
      modules/
      services/
      styles/
  backend/
    src/
      app.ts
      server.ts
      config/
      plugins/
      modules/
        auth/
        dashboard/
        signatures/
        imports/
        reports/
        meetings/
        backups/
      shared/
    test/
    package.json
    tsconfig.json
  database/
    migrations/
    seeds/
  docs/
    AUDITORIA_FUNCIONAL_Y_ARQUITECTURA.md
    ARQUITECTURA_TECNICA_API_POSTGRES.md
```

La reorganización se hará dentro de la rama de reconstrucción. No se moverán ni borrarán los ficheros originales hasta que cada función tenga sustituto y exista comparación de resultados.

## 4. Modelo de datos lógico inicial

### Seguridad
- `app_user`: única cuenta autorizada; identificador, hash Argon2id, estado y fechas.
- `app_session`: hash del identificador de sesión, usuario, expiración, revocación y metadatos mínimos.
- `audit_event`: actor, acción, recurso, resultado, fecha y metadatos no sensibles.

### Firmas e importaciones
- `signature`: columnas de negocio normalizadas, fechas ISO, valores derivados y referencia a la importación de origen.
- `signature_source`: datos originales de la fila (JSONB) para preservar las columnas originales y permitir reprocesar reglas.
- `import_job`: nombre original, hash SHA-256, tamaño, estado, fecha, contadores y versión de reglas.
- `import_row`: número de fila, datos originales, resultado de validación, errores/avisos, firma propuesta y huella de fila.
- `classification_rule_version`: versión inmutable del conjunto de reglas.
- `classification_rule`: regla, campo, patrón/valor, clasificación resultante, prioridad, vigencia y estado.
- `dimension_value`: catálogo de oficinas, apoderados, notarios, circuitos, centros, tipos de firma y tipos de provisión/gestión, con alias y vigencia cuando proceda.

No se fijará una restricción única de expediente hasta comprobar el Excel real. La deduplicación inicial debe detectar y presentar candidatos, no descartar filas automáticamente. Se conservarán tanto el valor fuente como el valor normalizado y la regla que lo produjo.

### Informes y actas
- `saved_report`: título, tipo, periodo, estado, propietario y fechas.
- `report_revision`: contenido enriquecido, versión, snapshot JSON de filtros/datos/KPIs, versión de reglas y fecha de generación. Un informe publicado o guardado no se recalculará al cambiar las firmas.
- `meeting_minute`: datos de reunión, estado y versión.
- `meeting_attendee`: asistente y cargo.
- `meeting_agenda_item`: orden y texto del punto.
- `meeting_decision`: acuerdo, responsable, fecha objetivo y estado.
- `action_item`: tarea vinculada al acta o informe, responsable, vencimiento y estado.

### Operaciones y recuperación
- `backup_record`: tipo, fecha, hash, tamaño, ubicación/identificador externo y resultado de verificación.
- `migration_run`: origen, versión de esquema, recuentos antes/después, diferencias y resultado.

El modelo físico y las restricciones definitivas se concretarán al perfilar una copia del Excel y de un backup JSON. No se eliminarán campos originales por considerarlos redundantes hasta verificar su uso.

## 5. Contrato API inicial

Todas las rutas, salvo login, están autenticadas. Los endpoints de escritura validan entrada, registran auditoría y responden con errores estructurados.

### Sesión
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

No habrá registro público ni administración de usuarios múltiples.

### Dashboard y firmas
- `GET /api/v1/dashboard/summary?from=&to=&compare=`
- `GET /api/v1/signatures?year=&month=&office=&agent=&notary=&circuit=&signatureType=&provisionType=&page=&pageSize=&sort=`
- `GET /api/v1/signatures/:id`
- `GET /api/v1/signatures/facets`

Paginación y ordenación se ejecutan en servidor. Los nombres de campos ordenables se validan mediante una lista permitida; nunca se interpolan directamente desde la petición.

### Importación
- `POST /api/v1/imports` — recibe el fichero y crea una importación en staging.
- `GET /api/v1/imports/:id` — estado, contadores, avisos y errores.
- `GET /api/v1/imports/:id/preview` — muestra filas y cambios propuestos.
- `POST /api/v1/imports/:id/validate` — valida de nuevo con versión de reglas indicada.
- `POST /api/v1/imports/:id/commit` — confirma y promueve de forma atómica.
- `POST /api/v1/imports/:id/cancel` — cancela sin tocar datos activos.

No se ejecutará un borrado masivo antes de importar. La política por defecto será añadir y señalar posibles duplicados; cualquier sustitución total requerirá un flujo separado, una copia de seguridad y confirmación expresa.

### Informes
- `GET /api/v1/reports`
- `POST /api/v1/reports`
- `GET /api/v1/reports/:id`
- `PUT /api/v1/reports/:id`
- `POST /api/v1/reports/:id/revisions`
- `POST /api/v1/reports/:id/export/pdf`

### Actas y tareas
- `GET /api/v1/meetings`
- `POST /api/v1/meetings`
- `GET /api/v1/meetings/:id`
- `PUT /api/v1/meetings/:id`
- `POST /api/v1/meetings/:id/finalize`
- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `PUT /api/v1/tasks/:id`

### Backups y reglas
- `POST /api/v1/backups`
- `GET /api/v1/backups`
- `POST /api/v1/backups/:id/verify`
- `POST /api/v1/backups/:id/restore`
- `GET /api/v1/rules`
- `POST /api/v1/rules/versions`
- `POST /api/v1/rules/versions/:id/activate`

La restauración y activación de reglas serán operaciones administrativas explícitas, auditadas y con posibilidad de vuelta atrás.

## 6. Reglas de integridad y negocio

1. Los datos fuente no se sobrescriben al normalizar; se almacenan ambos.
2. Cada importación tiene hash del fichero, versión de reglas, contadores y estado.
3. Las filas ambiguas no se clasifican silenciosamente como una categoría definitiva.
4. Las métricas se definen una sola vez, con nombre, fórmula, unidad, filtros, exclusiones y tratamiento de nulos.
5. Los paneles y los informes consumen los mismos servicios de métricas.
6. Los informes guardados conservan un snapshot de datos y reglas; no cambian al actualizar el histórico.
7. Los borradores se guardan automáticamente; las versiones finalizadas son inmutables, con revisiones nuevas si hay correcciones.
8. Importaciones, restauraciones y cambios de reglas se ejecutan con transacciones y registro de auditoría.
9. Toda operación de exportación y restauración comprueba el usuario autenticado y el permiso de servidor.
10. La API limita tamaño de ficheros, tipos permitidos, frecuencia y tiempo de ejecución.

## 7. Diseño visual

Se aplicarán los colores corporativos aprobados:
- Fondo `#FFFFFF`
- Superficies secundarias `#F2F7FB`
- Cabeceras de tabla `#EAF2F8`
- Bordes `#D8E4EC`
- Azul corporativo `#064675`
- Texto secundario `#617789`

Componentes previstos: navegación lateral, cabeceras de página, tarjetas KPI, filtros, tablas con estado vacío y paginación, gráficos, modales, notificaciones, formularios y editor documental. Iconos SVG consistentes, estados accesibles, foco de teclado, contraste y responsive. Se evitarán emojis como iconos funcionales y las capas Glass serán sutiles.

## 8. Criterios de aceptación antes de producción

- El total de registros importados coincide con el total validado y las diferencias están explicadas.
- Reconciliación por año/mes y por dimensiones de negocio aprobada.
- Importar dos veces el mismo fichero no duplica registros inadvertidamente.
- Un error durante importación/restauración no deja datos parcialmente promovidos.
- Los informes guardados mantienen su snapshot tras nuevas importaciones.
- Los cálculos de SLA, videoconferencia, provisión, oficina, apoderado y circuito tienen pruebas de referencia.
- No hay rutas de datos accesibles sin sesión; los permisos se verifican en backend.
- Pruebas de XSS, CSRF, sesión, límites de fichero, errores y recuperación superadas.
- Backup y restauración ensayados en base de pruebas.
- Preview aislado aceptado por el usuario y rollback documentado.
