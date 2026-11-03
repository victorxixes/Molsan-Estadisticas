# Catálogo notarial CTN en ESTADISTICAS-MOLSAN

## Origen y alcance
Copia inicial de solo lectura del catálogo del proyecto Render `Molsan`, base `BBDD_Molsan`, tablas `public.ctn_notarios` y `public.ctn_notarios_asociados`.

## Datos copiados
- 2.647 registros de notarías/notarios.
- 6 relaciones de notarios asociados.
- Campos profesionales: código, nombre, apellidos, NIF, teléfono, departamentos, CP, provincia, municipio, dirección, VC, apoderado, observaciones y coordenadas disponibles.

## Datos excluidos deliberadamente
No se copian IBAN, hashes ni contraseñas cifradas/provisionales de NotarGest u otros portales, ni historial de acceso. No son necesarios para análisis estadístico.

## Seguridad actual
- RLS habilitado en las tres tablas.
- Lectura únicamente para usuarios autenticados.
- No hay políticas anónimas.
- La aplicación estática actual aún no integra autenticación Supabase ni operaciones de escritura para este catálogo.

## Pendiente antes de dar el módulo por terminado
1. Crear autenticación de usuarios y roles administrativos en ESTADISTICAS.
2. Crear interfaz de catálogo: búsqueda, filtros, ficha, edición y relaciones de asociados.
3. Adaptar el importador Excel CTN con validación previa y modo de actualización seguro (sin borrar catálogo completo).
4. Registrar cada importación en `ctn_importaciones`.
5. Añadir sincronización opcional desde CTN Render sin dependencia en tiempo real.
6. Relacionar el catálogo con el circuito notarial y con las filas de firmas importadas.

La base estadística conserva identificadores CTN de origen para permitir cruces reproducibles. No se ha modificado el proyecto CTN de Render.
