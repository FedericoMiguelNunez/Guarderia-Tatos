# Corrección de duplicados — verificación real dirigida, 2026-09-29

## Causa comprobada y corrección

Documentación oficial: https://docs.netlify.com/build/data-and-storage/netlify-blobs/#set y https://docs.netlify.com/build/data-and-storage/netlify-blobs/#setjson. Ambos métodos reciben `onlyIfNew`/`onlyIfMatch` en el tercer argumento; el rechazo condicional se devuelve como `modified: false`.

El SDK instalado permanece en `@netlify/blobs` **10.0.10**. En `dist/main.js`, `set()` entrega `{ conditions, ... }` al cliente, pero `setJSON()` entrega `{ ...conditions, ... }`. En `dist/chunk-HN33TXZT.js`, `makeRequest()` solo lee la propiedad `conditions` para generar `if-none-match`/`if-match`. No se actualizó la dependencia ni se modificó `node_modules`.

`server/idempotency-store.mjs` ahora usa `store.set(key, JSON.stringify(value), options)` mediante un helper para TODAS las escrituras: reserva, finalización, adquisición/reutilización/liberación y recuperación del bloqueo. Si falta ETag en una actualización condicional, se rechaza con `BLOBS_ETAG_MISSING`; no se convierte en escritura incondicional.

El servicio genera un ID candidato por cada llamada. Antes, la reserva ignoraba `onlyIfNew` y reemplazaba la operación anterior: cada candidato llegaba a Sheets, causando tres IDs diferentes. La solicitud histórica guardada mantiene la clave `2df8f2c8_0769_43ea_82cf_34dd7eabfb1c`; su huella normalizada coincide con la huella de la última reserva y con la captura de atribución de las filas 2, 3 y 4. El lanzador anterior reutilizaba la solicitud congelada. No existen capturas separadas del cuerpo bruto de los tres envíos históricos; la comprobación actual agregó hashes por intento para evitar esa limitación.

La prueba dirigida de navegador verificó dos envíos con cuerpo bruto y clave idénticos aun al intentar cambiar campos, consentimiento y atribución. Sus respuestas fueron interceptadas como 503 y no escribieron en Sheets. Los casos siguientes usaron el handler real y Sheets real.

## Particularidad del servidor Blobs local instalado

También se reprodujo en almacenamiento temporal que el servidor local oficial 10.0.10 no devuelve ETag al leer y permite dos creaciones simultáneas con `onlyIfNew` (dos resultados `modified: true`).

El servidor de pruebas `scripts/local-conditional-blobs-server.mjs` extiende exclusivamente esa implementación local: agrega el ETag calculado por el propio servidor y serializa sus solicitudes. Conserva almacenamiento, autenticación y evaluación de condiciones del servidor original. Usa métodos internos de la versión fijada y exige revisión si cambia la versión. El SDK cliente y el servicio remoto no se alteraron. Esta prueba NO valida Blobs remoto ni concurrencia entre procesos independientes.

El lanzador ejecuta `verifyBlobsConditions()` antes de cualquier escritura en Sheets o de habilitar HTTP. Se verificaron reserva repetida, ETag vigente/obsoleto, clave ausente, finalización, exclusión/liberación/recuperación CAS y creación simultánea. Se inyectaron clientes que omiten condiciones para comprobar que el guard los rechaza.

## Resultados leídos directamente de la copia autorizada

Planilla `17UZOjIkLGw8ykFsJRmiGlqIGwf91u8eurTZIU3fv5gc`, pestaña `Leads Google Ads`.

| Caso | Fila | ID de consulta | Resultado |
| --- | --- | --- | --- |
| Primer envío, Nube Ficticia | 5 | 0dd31608-c43c-497c-9868-27b6a4d93e7c | 201, una fila |
| Reintento idéntico | 5 | 0dd31608-c43c-497c-9868-27b6a4d93e7c | 200, replayed, misma fila sin cambios |
| Misma clave, gato modificado | Sin fila nueva | — | 409 IDEMPOTENCY_CONFLICT |
| Dos solicitudes simultáneas, Luna Ficticia | 6 | 7d13ce22-dc53-4db4-88ba-de05de8e638b | 201 + 409 REQUEST_IN_PROGRESS, una sola fila |
| Reintento del concurrente | 6 | 7d13ce22-dc53-4db4-88ba-de05de8e638b | 200, replayed, mismo ID |

Ambos registros tienen nombre `PRUEBA AUDITORÍA REINTENTO`, teléfono ficticio reservado `+12025550124`, campaña `PRUEBA_IDEMPOTENCIA`, source `google`, medium `cpc`, GCLID `PRUEBA_REINTENTO_NO_CONVERSION`, entrada `/` y consentimiento `No`.

Fechas UTC: fila 5 `2026-09-29T20:40:20.415Z`; fila 6 `2026-09-29T20:40:22.548Z`. Captura `2026-09-29T20:40:19.978Z`.

Clave secuencial: `retry_947bd0c6_9c1d_4a2e_bf82_7c4bd8b72682_sequential`. SHA-256 del cuerpo idéntico: `52ce41470899701ccb763d09776edf4cafd9faa8e4383f283e01be26b988ad32`.

Clave concurrente: `retry_947bd0c6_9c1d_4a2e_bf82_7c4bd8b72682_concurrent`. SHA-256: `1d04ba19ac16733e9938a098cdd9d8ac9f27f496bd5a3f4667748728d688fa3c`.

Las filas 2, 3 y 4 se compararon con la lectura histórica, conservando todos sus valores y fórmulas. No se borraron. El cierre de la prueba comparó la planilla completa antes/después de los dos reintentos finales: ninguna celda cambió.

El primer cierre tuvo una aserción incorrecta del harness: trataba poblar celdas vacías de las filas plantilla 5/6 como una alteración de datos anteriores. Se corrigió esa comparación y se retomó con las mismas claves guardadas; no se generaron más consultas.

## Verificación y uso local

Solo se ejecutaron las comprobaciones nuevas del fallo, el navegador dirigido de conservación del cuerpo y las dos regresiones existentes del bloqueo afectadas (2 aprobadas). No se reinició la auditoría ni se repitieron las 29 pruebas.

```powershell
node scripts/check-blobs-conditions.mjs
node scripts/local-sheets-test.mjs --readback
```

Para retomar los mismos casos ya guardados sin generar claves nuevas:

```powershell
node scripts/local-sheets-test.mjs --verify-retry --resume-retry
```

El modo de reanudación conserva las claves y verifica los hashes originales y los de los reintentos adicionales. Para una lectura sin envíos, usar `--readback`.

`node scripts/local-sheets-test.mjs` inicia el servidor local con el guard completo, credencial externa en memoria, producción deshabilitada y almacenamiento aislado. Ctrl+C detiene el proceso. Este comando sirve el handler local y no carga configuración remota de Netlify. No abrir manualmente el sitio para pruebas publicitarias sin bloquear solicitudes externas; la prueba dirigida de navegador ya las bloquea.

Evidencia local sin credenciales: `%TEMP%/tatos-auditoria-17UZOjIk/last-retry-verification.json`, `retry-results.json`, `retry-fixture.json` y `request-hashes.jsonl`.

No se publicó, se hizo push, se modificaron operaciones de producción, Google Ads, GTM o variables remotas. No se enviaron mensajes de WhatsApp ni conversiones. La clave privada permaneció fuera del repositorio, dist y documentación.
