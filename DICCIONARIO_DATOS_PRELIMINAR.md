# Diccionario de datos — Molsan Estadísticas

**Versión:** 1.0 — reglas de negocio acordadas con el usuario el 03/11/2026.  
**Origen técnico:** aplicación legacy de `main`, commit base `d3df6bccef9fb6cf095d66904f9880487a3b3e0e`.  
**Rama de trabajo:** `rebuild/molsan-control-platform`.  
**Estado:** reglas principales definidas a partir de la estructura y muestra de Excel facilitadas por el usuario. Pendiente de contraste con el fichero completo y los informes históricos.  
**Alcance:** especificación de datos y reglas; no implica despliegue, migración ni modificación de producción.

## 1. Principios de conservación

1. Los 15 campos de origen se conservarán sin sobrescribir sus valores originales.
2. Se conservará también cada fila original completa (incluidas columnas adicionales que no estén en el diccionario), junto con hoja y número de fila de origen cuando estén disponibles.
3. Los valores normalizados y calculados se almacenarán por separado de los valores de origen.
4. Las reglas y catálogos serán versionables. Cada importación y cada clasificación calculada debe poder relacionarse con la versión de reglas utilizada.
5. Un cambio posterior en un catálogo no debe reescribir silenciosamente el resultado histórico de informes ya guardados. Los informes guardados utilizarán una instantánea de sus datos y criterios.
6. No se deduplicarán ni fusionarán expedientes automáticamente hasta acordar una clave de negocio y revisar los posibles duplicados.
7. Las importaciones se harán mediante staging, vista previa, validación y confirmación transaccional. Nunca se borrará el histórico antes de comprobar que la nueva importación es válida.

## 2. Campos de origen: 15 columnas fijas

| Encabezado Excel | Campo interno propuesto | Tratamiento |
|---|---|---|
| Expediente | `expediente` | Conservar como texto para no perder formato ni ceros iniciales. |
| Oficina | `oficina` | Conservar como texto; se usa para calcular Centro. |
| Fecha Alta | `fecha_alta` | Conservar valor original y normalizar a fecha cuando sea válida. |
| Contrato | `contrato_original` | Conservar íntegro como texto; se usa para calcular la entidad contractual. |
| Tipo Provisión | `tipo_provision_original` | Conservar texto original; se usa para calcular Tipo Gestión. |
| Notario | `notario_original` | Conservar texto original; se usa para consultar el catálogo de circuitos. |
| Provincia | `provincia` | Conservar texto original. |
| Municipio | `municipio` | Conservar texto original. |
| Comunidad | `comunidad` | Conservar texto original. |
| Protocolo | `protocolo` | Conservar como texto. |
| Fecha Protocolo | `fecha_protocolo` | Conservar valor original y normalizar a fecha; es la fecha de firma para los análisis temporales acordados. |
| V.C. | `vc_original` | Conservar valor original; se usa para calcular Tipo de firma. |
| Apoderado | `apoderado_original` | Conservar texto original; se usa para calcular Nombre y Centro que firma. |
| Envio Notario | `envio_notario` | Conservar valor original y normalizar a fecha cuando sea válida. |
| Días | `dias_original` | Conservar el valor del Excel para reconciliación; la métrica operativa se calculará automáticamente según la regla de la sección 3. |

**Importante:** el sistema conservará el contenido completo de cada fila de origen, incluso si una versión futura del Excel incorpora nuevas columnas. No se descartarán columnas desconocidas.

## 3. Campos derivados y reglas confirmadas

### 3.1 Mes y Año

No serán columnas que el usuario tenga que importar o mantener manualmente. Se derivarán de `Fecha Protocolo`:

- `mes_numero`: 1–12.
- `mes_nombre`: nombre del mes en español.
- `anio`: año de la fecha de protocolo.

La fecha de protocolo representa la fecha de firma para esta finalidad. Los filtros por mes, año, trimestre y periodo se construirán a partir de esa fecha. Si la fecha no es válida o está vacía, el registro quedará sin periodo y se mostrará como incidencia de calidad de datos; no se inventará una fecha.

### 3.2 Centro (según Oficina)

Regla confirmada:

| Valor de Oficina | Centro |
|---|---|
| `5316` | `Cancela` |
| Cualquier otro valor | `Oficina` |

Se comparará el código como texto normalizado, eliminando espacios exteriores. Se conservará siempre el código original. Un valor vacío no debe convertirse silenciosamente en Oficina: quedará pendiente de revisar.

### 3.3 Centro que firma (según Apoderado)

Es un campo distinto de Centro. Se calcula exclusivamente a partir de `Apoderado`, mediante esta correspondencia confirmada:

| Apoderado | Centro que firma |
|---|---|
| ALBERTO LOPEZ RODRIGUEZ | Molsan |
| Ana Cartagena Puerta | Molsan |
| Carlos Barbera García | Molsan |
| CASTILLO 11 | Colaboradores |
| Ferran Badia Caralps | Molsan |
| GASTON BEGUIRISTAIN AMORIN | Molsan |
| GESGALICIA | Colaboradores |
| GESTCANARIAS | Colaboradores |
| GESTORIA MAS | Colaboradores |
| JULIO CUESTA | Colaboradores |
| Oficina CaixaBank | Oficina CBK |
| Oficina Otra entidad | Oficina OE |
| Pedro Pérez Sola | Molsan |
| Víctor Tomás Castellsagué | Molsan |
| YARZA GESTION | Colaboradores |
| Yolanda Vives Solsona | Molsan |

Los nombres se compararán tras normalizar mayúsculas/minúsculas, espacios repetidos y diferencias de acentuación, sin alterar el texto original. No se utilizará coincidencia difusa para asignar centros. Los apoderados no incluidos quedarán como **Pendiente de clasificar**.

### 3.4 Tipo Gestión (según Tipo Provisión)

Reglas confirmadas:

| Tipo Provisión de origen | Tipo Gestión resultante |
|---|---|
| CANCELACIÓN | Cancelación con provisión |
| CANCELACIÓN SIN PROVISIÓN | Cancelación sin provisión |
| Cancelación con provisión | Cancelación con provisión |
| Novación | Cancelación con provisión |
| Subrogación | Cancelación con provisión |
| Constitución | Cancelación con provisión |
| Cancelacion sin provision | Cancelación sin provisión |
| Cancelacion con provision | Cancelación con provisión |

La comparación ignorará diferencias de mayúsculas/minúsculas, acentos y espacios exteriores/repetidos. Se conservará el valor de origen. Variantes equivalentes podrán normalizarse a la misma regla. Cualquier valor no contemplado quedará **Pendiente de clasificar**, no se inferirá una categoría.

### 3.5 Nombre (alias derivado de Apoderado)

Se elimina el campo calculado **Apellidos**. Se mantiene **Nombre** como etiqueta/alias derivado del apoderado, usando la siguiente tabla:

| Apoderado | Nombre |
|---|---|
| Carlos Barbera García | Carlos |
| YARZA GESTION | J.E. Yarza-Valencia |
| ALBERTO LOPEZ RODRIGUEZ | Alberto |
| GASTON BEGUIRISTAIN AMORIN | Gaston |
| Colaborador Galicia Solo Firma | M. Suarez-Galicia |
| GESTCANARIAS | G.Prieto-Canarias |
| GESTORIA MAS | Gest.Mas-Baleares |
| CASTILLO 11 | I.Larriu-Navarra |
| JULIO CUESTA | J.J.Cuesta-Murcia |
| Yolanda Vives Solsona | Yolanda |
| Pedro Pérez Sola | Pedro |
| Víctor Tomás Castellsagué | Victor |
| GESGALICIA | M.Suarez-Galicia |
| Oficina Otra entidad | Oficina OE |
| Oficina CaixaBank | Oficina CBK |
| Colaborador | Colaborador |
| Ferran Badia Caralps | Ferran |
| Ana Cartagena Puerta | Ana |

La normalización de comparación tolerará mayúsculas/minúsculas, acentos y espacios; el alias se devolverá exactamente como está escrito en la tabla. Si no hay correspondencia, Nombre quedará **Pendiente de asignar**. Se preservará Apoderado original.

**Excepciones por resolver:** `Colaborador Galicia Solo Firma` y `Colaborador` aparecen en la fórmula de Nombre, pero no están en el catálogo confirmado de Centro que firma. No se les asignará centro por su alias; se deberán clasificar en el catálogo de apoderados cuando el usuario indique su centro.

### 3.6 Contrato (clasificación de entidad)

Se conserva el contrato original y se calcula un campo separado, por ejemplo `entidad_contrato`, a partir de sus cuatro primeros caracteres:

| Prefijo | Clasificación |
|---|---|
| 9620 | CaixaBank |
| 9300 | CaixaBank |
| 9340 | CaixaBank |
| 9320 | CaixaBank |
| 9272 | CaixaBank |
| Cualquier otro prefijo | Externa |

Los prefijos se tratarán como texto. La fórmula Excel facilitada contenía un separador duplicado (`;;`); la regla funcional acordada es la lista de cinco prefijos anterior. Si el contrato está vacío o no permite obtener cuatro caracteres, se marcará como **Pendiente de clasificar** en vez de asignar Externa automáticamente.

### 3.7 Circuito notarial

Se elimina la segunda columna calculada llamada `Notario` (la que estaba situada entre Contrato y Circuito notarial). Se conserva el campo de origen `Notario`.

Se creará un catálogo administrable de notarios con, como mínimo:

- Nombre reconocido del notario.
- Variantes/alias de escritura para identificar el mismo notario.
- Circuito: `Notarios Península` o `Notarios Canarias`.
- Estado activo/inactivo.
- Historial de cambios.

Regla de clasificación:

| Coincidencia en catálogo | Circuito notarial |
|---|---|
| Notario registrado en Península | Notarios Península |
| Notario registrado en Canarias | Notarios Canarias |
| Notario no registrado o ambiguo | Pendiente de clasificar |

El usuario podrá dar de alta y mantener los notarios en una sección de administración. No se utilizará fuzzy matching para asignar un circuito automáticamente. Los registros pendientes aparecerán en una bandeja de revisión. Desactivar un notario no borrará ni alterará su histórico.

### 3.8 Tipo de firma (según V.C.)

Regla confirmada:

| V.C. original | Tipo de firma |
|---|---|
| N | Presencial |
| S | Videoconferencia |
| Vacío u otro valor | Pendiente de revisar |

Se conservará el valor original de V.C. La comparación ignorará espacios exteriores y diferencias de mayúsculas/minúsculas.

### 3.9 Días

El usuario ha confirmado el cálculo automático:

**Días calculados = Fecha Protocolo − Envio Notario**, expresado en días naturales.

Ejemplo facilitado: Envio Notario 26/02/2018 y Fecha Protocolo 21/01/2020 → 694 días.

Se conservará por separado el valor histórico de la columna `Días` del Excel y se calculará `dias_calculados`. Durante la importación se compararán ambos valores y se mostrarán discrepancias para revisión. Si falta una fecha o no es válida, no se calculará el resultado. No se sustituirá silenciosamente el dato histórico. La regla de cálculo usa fechas normalizadas, sin depender de la zona horaria del navegador.

## 4. Catálogos administrables

### 4.1 Catálogo de apoderados

Debe permitir mantener:
- Nombre original/reconocido del apoderado.
- Variantes de escritura.
- Nombre (alias de presentación).
- Centro que firma: Molsan, Colaboradores, Oficina CBK u Oficina OE.
- Estado activo/inactivo.
- Historial de cambios.

El catálogo inicial de Centro que firma es la tabla de la sección 3.3. Los valores de la sección 3.5 que no tienen centro asociado se deben completar con el usuario.

### 4.2 Catálogo de notarios

Debe permitir mantener:
- Nombre reconocido.
- Alias/variantes.
- Circuito Península o Canarias.
- Estado activo/inactivo.
- Historial de cambios.

Los no reconocidos o ambiguos deben permanecer pendientes, no clasificarse como Fuera del circuito por defecto.

## 5. Campos calculados que se retiran

| Campo anterior | Decisión |
|---|---|
| Mes | No se importa; se deriva de Fecha Protocolo. |
| Año | No se importa; se deriva de Fecha Protocolo. |
| Apellidos | Eliminar como campo calculado. |
| Segunda columna Notario | Eliminar; el circuito se resuelve con catálogo a partir del Notario original. |

**Se mantienen como dimensiones separadas**:
- Centro (derivado de Oficina: Cancela/Oficina).
- Centro que firma (derivado de Apoderado: Molsan/Colaboradores/Oficina CBK/Oficina OE).

No deben confundirse ni fusionarse en los informes.

## 6. Incidencias y estados pendientes

La aplicación debe permitir filtrar y revisar:
- Apoderados sin correspondencia para Nombre.
- Apoderados sin Centro que firma asignado.
- Notarios sin circuito asignado o con coincidencias ambiguas.
- Tipo Provisión desconocido.
- V.C. vacío o distinto de N/S.
- Oficina vacía o código no válido.
- Contrato vacío o prefijo no interpretable.
- Fechas ausentes, imposibles o ambiguas.
- Diferencias entre Días original y Días calculados.

Las incidencias no bloquearán la conservación del registro original. La importación debe presentar el resumen y permitir corregir los catálogos antes de confirmar, según las reglas de validación que se definan.

## 7. Decisiones todavía pendientes de contraste

Estas cuestiones no deben inventarse ni darse por cerradas sin el Excel completo, los informes de referencia o confirmación del usuario:

1. **Muestra y tipos reales:** validar formatos, campos vacíos, variantes y volumen con el Excel completo.
2. **Días:** comprobar todos los valores históricos frente al cálculo Fecha Protocolo menos Envio Notario y resolver discrepancias antes de reemplazar el valor usado en informes.
3. **Catálogo de apoderados:** asignar Centro que firma a `Colaborador Galicia Solo Firma` y `Colaborador`; comprobar si existen más apoderados en los datos reales.
4. **Catálogo de notarios:** el usuario debe proporcionar los notarios de Península y Canarias y sus variantes. Hasta entonces, los no registrados estarán pendientes.
5. **Clave de expediente y duplicados:** determinar si Expediente es único y cómo tratar varias filas del mismo expediente, rectificaciones o reimportaciones.
6. **Métricas e informes:** validar definición de total de firmas, SLA medio, tratamiento de días cero/negativos, porcentajes, comparativas interanuales y periodos equivalentes.
7. **Fecha y periodo:** confirmar el tratamiento de Fecha Protocolo vacía o corregida y el calendario de corte de informes.
8. **Columnas adicionales:** identificar si el Excel real contiene más campos que deban convertirse en campos normalizados; mientras tanto, se conservarán dentro de la fila original.

## 8. Criterios de aceptación antes de migrar

- Cada una de las 15 columnas originales se conserva y puede consultarse.
- Las columnas adicionales de la fuente no se pierden.
- Las reglas confirmadas producen resultados reproducibles.
- Los valores desconocidos se muestran como pendientes, sin clasificaciones inventadas.
- Centro y Centro que firma permanecen separados.
- Los valores originales nunca son sobrescritos por valores calculados.
- Días original y calculado se comparan y las discrepancias se reportan.
- La importación de prueba no elimina datos existentes y puede revertirse antes de confirmar.
- Los informes guardados conservan una instantánea inmutable de los datos y criterios con los que se generaron.
- Los totales y métricas se reconcilian con el Excel y los informes históricos antes de cualquier migración definitiva.

---

**Nota de alcance:** este documento consolida reglas facilitadas por el usuario y hallazgos estáticos del código legacy. No equivale a una validación con el Excel completo, no certifica las cifras históricas y no autoriza por sí mismo ninguna migración o despliegue.
