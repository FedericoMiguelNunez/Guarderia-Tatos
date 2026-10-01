# Integración real local — 2026-09-29
> El bloqueo descrito aquí corresponde a la primera ejecución. La corrección y los resultados posteriores están en [correccion-duplicados-sheets-2026-09-29.md](correccion-duplicados-sheets-2026-09-29.md).


Se continuó la prueba autorizada sin repetir las 29 pruebas anteriores.

- El ajuste `LEAD_BLOBS_STORE_NAME` quedó guardado. El valor predeterminado de producción sigue siendo `tatos-lead-operations`. La comprobación dirigida `node scripts/check-blobs-isolation.mjs` pasó contra el servidor local oficial.
- Sheets real: autenticación con la cuenta de servicio esperada, lectura y escritura correctas únicamente en la copia `17UZOjIkLGw8ykFsJRmiGlqIGwf91u8eurTZIU3fv5gc`, pestaña `Leads Google Ads`.
- Se agregaron 15 encabezados faltantes después de las columnas ocupadas. Solo se escribieron valores de encabezado; no se reconstruyó la pestaña ni se modificaron formatos o validaciones. La comparación posterior confirmó los valores y fórmulas previos.
- La credencial se leyó desde el archivo externo en Downloads y se cargó únicamente en el proceso. No se creó un archivo de secretos en el proyecto.
- Blobs: SDK y servidor oficial local, con nombre, site ID y directorio temporal exclusivos. No se probó el servicio remoto de Netlify Blobs ni se cargaron variables remotas.
- El formulario se ejecutó en Chromium headless; todas las solicitudes externas se bloquearon. La navegación a WhatsApp se interceptó con 204; no se envió ningún mensaje ni conversión.

## Resultado leído directamente desde Sheets

Datos ficticios comunes: nombre `PRUEBA AUDITORÍA`, gato `Michifuz Ficticio`, teléfono reservado ficticio `+12025550123`, página `/`, consentimiento `No`.

Atribución: source `google`, medium `cpc`, campaña `PRUEBA_AUDITORIA`, term `guarderia_ficticia`, content `formulario_local`, GCLID `PRUEBA_AUDITORIA_NO_CONVERSION`, campaign ID `TEST_CAMPAIGN`, adgroup ID `TEST_ADGROUP`, keyword `gato_ficticio`. Captura: `2026-09-29T20:20:39.395Z`.

| Fila | ID de consulta | Fecha UTC |
| --- | --- | --- |
| 2 | cbb6af17-d529-4b78-b7b4-a2f20049d1ca | 2026-09-29T20:20:40.059Z |
| 3 | 2b6cc3d7-7e50-48fb-9efa-874eccd2e891 | 2026-09-29T20:21:40.657Z |
| 4 | 0b09b039-b7f5-4415-9b1c-bb559fe2e376 | 2026-09-29T20:21:42.502Z |

## Bloqueo confirmado

La misma solicitud creó filas nuevas: el reintento respondió 201 en lugar de 200/replayed. La versión instalada `@netlify/blobs` 10.0.10 implementa `setJSON()` pasando `...conditions` a `makeRequest`, cuando este requiere la propiedad `conditions`. Por eso no se envían `if-none-match`/`if-match`, afectando reservas y bloqueos. No se realizaron más envíos tras detectarlo. Las tres filas de prueba se conservaron como evidencia.

El lanzador incorpora una comprobación real de reserva repetida y bloquea el servidor y los envíos si falla. Siguiente paso mínimo: corregir en código local las escrituras condicionales (por ejemplo usar `store.set(key, JSON.stringify(value), options)` en el adaptador) y probar únicamente reservas/compare-and-swap/reintento antes de volver a enviar a Sheets. No se modificó la implementación productiva para resolver este hallazgo.

El mensaje natural y el intento de navegación fueron comprobados en la ejecución retomada. Los tiempos quedaron en memoria y no se persistieron al abortar por el fallo de idempotencia; no hay valores numéricos confiables para entregar. El primer intento también tuvo un fallo de instrumentación de navegación, ya corregido. Pendiente repetir la medición después de resolver el bloqueo.

## Reanudar

Desde la raíz del proyecto:

```powershell
node scripts/local-sheets-test.mjs --readback
```

Hace solo lectura directa y muestra las filas ficticias. Evidencia adicional en `%TEMP%/tatos-auditoria-17UZOjIk/readback.json`.

```powershell
node scripts/local-sheets-test.mjs
```

Lee la credencial externa, fija permisos de prueba y arranca Blobs local. Actualmente se detiene con `BLOBS_CONDITIONAL_WRITES_BROKEN` antes de habilitar HTTP. Tras corregir y verificar ese bloqueo, sirve el proyecto en `http://127.0.0.1:8888`. El lanzador no equivale a `netlify dev`: sirve el handler existente en un servidor HTTP local y usa el mismo servidor Blobs de desarrollo, evitando configuración remota.

La opción `--audit --resume` permite retomar la última solicitud guardada y bloquear solicitudes externas en Playwright; debe usarse solo después de resolver el bloqueo. No volver a ejecutar una auditoría sin `--resume`, pues crearía una nueva consulta ficticia.

Producción, Google Ads, GTM y configuración remota de Netlify no se modificaron. No se publicó ni se hizo push.
