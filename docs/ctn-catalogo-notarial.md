# Catálogo notarial CTN en ESTADISTICAS-MOLSAN

## Origen y datos copiados

Copia inicial de solo lectura desde el proyecto Render Molsan, base BBDD_Molsan, tablas public.ctn_notarios y public.ctn_notarios_asociados.

- 2.647 registros CTN.
- 6 asociaciones entre notarios.
- Se conservan los identificadores originales.
- Se copiaron campos profesionales: código, nombre, apellidos, NIF, teléfono, departamentos, CP, provincia, municipio, dirección, VC, apoderado, observaciones y coordenadas disponibles.
- Se excluyeron IBAN, hashes, contraseñas y credenciales de portales.

## Seguridad aplicada

- RLS activo en las tres tablas CTN.
- El acceso de lectura y escritura se limita al usuario propietario mediante estadisticas_private.es_usuario_unico().
- Se sustituyeron las políticas de lectura genéricas por políticas de propietario.
- El frontend usa una clave publicable de Supabase; nunca incorpora service_role.
- La función de importación es SECURITY INVOKER y comprueba el usuario propietario.

## Interfaz añadida en esta rama

- Nuevo módulo Catálogo notarial en el menú.
- Inicio de sesión con Supabase Auth.
- Listado paginado, búsqueda por código/nombre/apellidos/NIF, filtros de provincia, municipio y VC, y ordenación.
- Ficha de detalle con datos profesionales y asociaciones existentes.
- Alta y edición de fichas CTN.

## Importador Excel seguro

Se añadió public.importar_ctn_excel(text, jsonb), con una única transacción:

1. Localiza las cabeceras aunque no estén en la primera fila.
2. Exige Código, Nombre y Apellidos como cabeceras.
3. Rechaza códigos vacíos y duplicados antes de modificar el catálogo.
4. Normaliza VC a VideoConferencia o Presencial.
5. Inserta nuevos registros y actualiza los existentes por código normalizado.
6. Conserva el ID, las coordenadas y el apoderado_id legado cuando el Excel no aporta esos datos.
7. No borra registros ausentes ni modifica las asociaciones existentes.
8. Registra la importación y el resumen de altas/actualizaciones en ctn_importaciones.

Cabeceras reconocidas: Código, Nombre, Apellidos, NIF, Teléfono, Departamento cancelaciones, Departamento copias, Otros departamentos, CP, Provincia, Municipio, Dirección, VC, Apoderado, Apoderado S y Observación.

## Pendiente de validar

1. Probar en navegador el inicio de sesión, filtros, detalle, alta y edición.
2. Probar el importador con una copia de Excel CTN: cabeceras desplazadas, códigos duplicados, vacíos y mezcla de altas/actualizaciones.
3. Añadir edición visual de asociaciones recíprocas.
4. Añadir pruebas automatizadas y mostrar historial de importaciones.
5. No desplegar hasta que el usuario revise la rama y autorice el despliegue.

## Migración del almacenamiento local

La aplicación antigua todavía tiene consumidores de IndexedDB/localStorage en storage.js, importador general, listados, KPIs, backups y permisos. El módulo CTN nuevo usa Supabase, pero no se debe declarar eliminada IndexedDB hasta migrar y probar esos consumidores contra las tablas estadisticas_*.
