# Diccionario de datos preliminar — Molsan Estadísticas

**Origen revisado:** `js/importador.js` y `js/reglas.js` de `main`, commit `d3df6bccef9fb6cf095d66904f9880487a3b3e0e`.  
**Estado:** preliminar; debe contrastarse con una copia real del Excel antes de cerrar tipos, obligatoriedad, claves y reglas.

## 1. Columnas que lee actualmente el importador

El importador toma la primera hoja del libro y convierte sus filas con SheetJS. El mapeo actual reconoce exactamente estos encabezados:

| Encabezado Excel | Campo interno | Tratamiento actual |
|---|---|---|
| Expediente | `expediente` | Texto, valor original |
| Oficina | `oficina` | Texto, valor original |
| Fecha Alta | `fecha_alta` | Normalizada a DD/MM/AAAA |
| Contrato | `contrato` | Después se sustituye por CaixaBank/Externa |
| Tipo Provisión | `tipo_provision` | Texto original; se usa para derivar tipo_gestion |
| Notario | `notario` | Texto original |
| Provincia | `provincia` | Texto original |
| Municipio | `municipio` | Texto original |
| Comunidad | `comunidad` | Texto original |
| Protocolo | `protocolo` | Texto original |
| Fecha Protocolo | `fecha_protocolo` | Normalizada; determina mes y año |
| V.C. | `vc` | Texto original; N/S determina tipo_firma |
| Apoderado | `apoderado` | Texto original; se usa para derivar nombre y apellidos |
| Envio Notario | `envio_notario` | Normalizada a DD/MM/AAAA |
| Días | `dias` | Conversión numérica con valor por defecto 0 |

**Riesgo confirmado:** el objeto se construye con esas columnas fijas. Las columnas adicionales, si existen en el Excel real, no se conservan actualmente. La reconstrucción conservará la fila original completa además de los campos normalizados.

## 2. Campos derivados por reglas

| Campo | Regla actual | Observación para rediseño |
|---|---|---|
| `mes` | Nombre de mes obtenido de Fecha Protocolo | Añadir `mes_numero` 1–12 y mantener etiqueta |
| `anio` | Año de Fecha Protocolo | Entero; actualmente puede ser null |
| `centro` | Oficina exactamente igual a `5316` → Cancela; resto → Oficina | Confirmar si existen más códigos |
| `tipo_gestion` | Derivado de Tipo Provisión; Con provisión/Sin provisión | No confundir con entidad bancaria |
| `nombre` | Diccionario de apoderados | Mantener alias y valor fuente |
| `apellidos` | Diccionario según nombre; reglas fallback | Corregir orden de clasificación del contrato |
| `centro_que_firma` | Mapa de nombres → Molsan/Colaboradores/Oficinas | Convertir en regla editable y versionada |
| `contrato` | Prefijos 9620, 9300, 9340, 9320, 9272 → CaixaBank; resto → Externa | Preservar también contrato original; validar prefijos |
| `notario2` | Coincidencia exacta/fuzzy de notario → Circuito Península/Canarias; resto FALSO | El nombre sugiere notario normalizado, pero contiene una clasificación de circuito |
| `circuito` | Península/Canarias/FALSO → Península/Canarias/Externo | Diferenciar Externo confirmado de Pendiente/No reconocido |
| `tipo_firma` | V.C. = N → Presencial; S → VideoConferencia; resto vacío | Crear estado Desconocido/Pendiente, no vacío silencioso |

El mapeo inicial también crea `contrato2`, pero no se ha encontrado un uso efectivo en las reglas revisadas. Se debe comprobar su uso en el resto de módulos antes de retirarlo.

## 3. Reglas de fechas

El código actual admite:
- DD-MM-AAAA
- DD/MM/AAAA
- AAAA-MM-DD
- número serial de Excel
- otros textos que el constructor Date del navegador pueda interpretar.

La nueva capa debe almacenar:
- `fecha_alta` como DATE nullable.
- `fecha_protocolo` como DATE nullable.
- `envio_notario` como DATE nullable.
- `mes_numero` y `anio` derivados de fecha_protocolo, nunca de la fecha local del navegador.

La importación debe señalar fechas ambiguas o imposibles. No se debe convertir una fecha inválida en cadena vacía sin mostrar advertencia.

## 4. Dimensiones que aparecen en informes y paneles

- Año y mes.
- Oficina / centro (Cancela u Oficina).
- Apoderado, nombre y apellidos.
- Notario y circuito notarial.
- Contrato / entidad clasificada.
- Tipo de provisión y tipo de gestión.
- Tipo de firma (Presencial / VideoConferencia).
- Centro que firma.
- Días (métrica temporal).

Se debe acordar un diccionario único para distinguir claramente:
- **Entidad/contrato:** CaixaBank u Otra entidad.
- **Tipo de provisión:** Con provisión / Sin provisión.
- **Tipo de gestión:** concepto de negocio independiente, si el Excel lo contiene; no asumir que es sinónimo de provisión.
- **Oficina/centro:** código fuente y categoría normalizada.
- **Circuito notarial:** Península / Canarias / Externo / Pendiente de clasificación.

## 5. Definiciones de métricas que requieren validación

| Métrica | Cálculo observado | Decisión pendiente |
|---|---|---|
| Total firmas | Recuento de filas | Confirmar si todas las filas son una firma válida y si se excluyen anuladas |
| SLA medio | Media de `dias` positivos | Confirmar qué intervalos mide Días y si deben excluirse ceros/negativos |
| % videoconferencia | Firmas VC / total | Confirmar tratamiento de VC vacío/desconocido |
| Distribución por provisión | Recuento por Tipo Provisión | Confirmar catálogo oficial y textos históricos |
| SLA con/sin provisión | Media de Días según Tipo Provisión | Confirmar que Tipo Provisión es el segmento correcto |
| Variación interanual | (año actual - año anterior) / año anterior | Fijar fórmula única y comparación de periodos equivalentes |
| Mes más fuerte | Máximo recuento mensual | Corregir incompatibilidad actual entre mes texto y conversiones numéricas |

No se fijan cifras ni reglas definitivas sin una copia real del Excel y una revisión de negocio. Los informes antiguos deben contrastarse con totales aprobados antes de sustituirlos.

## 6. Reglas de conservación

1. Guardar cada fila original completa, incluidos encabezados desconocidos.
2. Guardar los valores normalizados por separado.
3. Guardar versión de reglas, fecha de importación y número de fila de origen.
4. No deduplicar ni fusionar automáticamente hasta acordar la clave de negocio.
5. No borrar datos por una importación posterior; usar staging, diff y confirmación.
6. Permitir corregir una clasificación sin alterar el valor original y conservar el historial de cambios.
