# PostgreSQL migrations

Las migraciones de este directorio describen el esquema inicial previsto para Molsan Estadísticas.

## Reglas
- Ejecutar únicamente en una base de desarrollo/preview aislada.
- No ejecutar sobre la base actual ni sobre producción.
- Antes de importar históricos, perfilar un Excel y un backup reales, cerrar el diccionario de campos y revisar restricciones.
- Guardar el SHA-256 y el resultado de cada ejecución.
- Hacer backup antes de cualquier migración y probar restauración.
- Las migraciones aplicadas no se editan en entornos compartidos; los cambios posteriores se añaden como nuevas migraciones.

## Estado
- `001_initial_schema.sql`: primera propuesta lógica para autenticación de cuenta única, sesiones, reglas versionadas, staging de importaciones, firmas, snapshots de informes, actas, tareas, backups y auditoría.

Todavía no existe un ejecutor de migraciones ni se ha ejecutado este SQL contra PostgreSQL. La primera ejecución será en una base de pruebas creada expresamente para validar el esquema.
