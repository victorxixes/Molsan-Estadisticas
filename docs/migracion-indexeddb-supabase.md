# CTN en Supabase: interfaz e importación segura

## Estado de esta fase

- Catálogo de 2.647 registros y 6 asociaciones copiados desde Render.
- Acceso CTN limitado al usuario propietario mediante RLS (función estadisticas_private.es_usuario_unico()).
- Clave publicable de Supabase en el frontend; no se utiliza service_role.
- RPC public.importar_ctn_excel(text, jsonb) para importar en una transacción.
- La importación identifica registros por código normalizado, inserta nuevos y actualiza existentes.
- No borra registros que no aparezcan en el Excel.
- Las asociaciones existentes no se alteran al importar.

## Formato Excel aceptado

Cabeceras reconocidas: Código, Nombre, Apellidos, NIF, Teléfono, Departamento cancelaciones, Departamento copias, Otros departamentos, CP, Provincia, Municipio, Dirección, VC, Apoderado, Apoderado S y Observación.

Son obligatorias las columnas Código, Nombre y Apellidos. Se localiza la fila de cabeceras aunque no sea la primera hoja. Se rechazan códigos vacíos y duplicados antes de enviar datos a Supabase. VC se normaliza a VideoConferencia o Presencial.

## Interfaz

El módulo permite iniciar sesión, buscar y filtrar, paginar, consultar fichas y asociaciones, crear y editar registros, y previsualizar/importar Excel. Las credenciales se validan con Supabase Auth. La aplicación no incorpora claves privadas.

## Pendientes

1. Integrar la gestión visual de asociaciones recíprocas en la ficha.
2. Añadir pruebas automatizadas con Excel de ejemplo (incluyendo cabeceras desplazadas, códigos duplicados y celdas vacías).
3. Probar en navegador el flujo de login, CRUD e importación con el usuario propietario.
4. Completar la migración del resto de la aplicación: js/storage.js, importador general, listados, KPIs, backups y permisos aún contienen dependencias del almacenamiento IndexedDB/localStorage. No retirar IndexedDB de forma aislada hasta migrar todos esos consumidores a las tablas estadisticas_*.
5. Desplegar únicamente cuando se autorice y después de validar en preview.
