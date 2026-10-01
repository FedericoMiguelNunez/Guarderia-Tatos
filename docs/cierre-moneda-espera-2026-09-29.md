# Cierre local: Moneda y continuación a los 3 segundos — 2026-09-29

Se cerraron únicamente los dos pendientes solicitados, sin repetir la auditoría completa ni optimizar lecturas de Sheets.

## Moneda

`server/sheets-store.mjs` usa `FORMULA` en la lectura que ya realizaba antes de escribir. Una fórmula que devuelve vacío ya no se confunde con una celda realmente vacía. Si Moneda contiene fórmula o un valor existente, se excluye esa celda del batch; si está vacía, el registro guarda ARS. Las consultas por ID mantienen la lectura original. No se agregó ni eliminó ninguna lectura ni se cambió el bloqueo o la reserva de idempotencia.

Pruebas focalizadas: **4 aprobadas** (fórmula con resultado inicial vacío, fórmula ARS, celda vacía sin fórmula y moneda existente USD). También pasó **1 regresión afectada** de encabezados/escritura RAW. No se ejecutó la suite completa.

Consulta real única, enviada desde el formulario con publicidad bloqueada:

- Planilla de prueba: `17UZOjIkLGw8ykFsJRmiGlqIGwf91u8eurTZIU3fv5gc`, pestaña `Leads Google Ads`.
- Fila **12**, ID **4696ba44-3b72-4c43-b573-01ca210e6884**.
- Nombre: `PRUEBA AUDITORÍA ESPERA 2e54cf52 escritorio real`.
- Gato: `Gato Espera Ficticio`; teléfono ficticio reservado: `+12025550130`.
- Fecha UTC: `2026-09-29T21:22:20.398Z`; entrada `/`.
- Atribución: source `PRUEBA_LOCAL`, campaign `PRUEBA_MONEDA_ESPERA`; consentimiento `No`.
- Fórmula R12 antes/después, idéntica: `=IF(OR(B12<>"";K12<>"";M12<>"");"ARS";"")`.
- Resultado evaluado leído desde Sheets: **ARS**.
- Se confirmó una sola fila para el ID y que no cambiaron valores ni fórmulas existentes de otras filas, incluidas las evidencias 2–11. No se restauró manualmente R12: el backend corregido preservó la fórmula durante la escritura.

La rama de celda vacía sin fórmula se verificó con la prueba focalizada; la integración real se hizo contra la fórmula de plantilla existente, con una única consulta nueva.

## Espera y confiabilidad

`js/lead-form.js` mantiene el botón `Abriendo WhatsApp…` inmediatamente. A los 3000 ms, si no terminó la solicitud, muestra el enlace **Continuar a WhatsApp** y aclara que el guardado sigue pendiente. El botón de envío permanece deshabilitado para evitar otro POST paralelo.

No se emite `tatos_lead_saved` ni se anuncia guardado al mostrar o usar el enlace. Solo una respuesta confirmada `saved: true` con ID válido habilita ese evento y el mensaje de guardado. La navegación manual no aborta explícitamente la solicitud ni usa keepalive/sendBeacon para prometer persistencia; salir de la página puede abandonar la solicitud y no es prueba de guardado.

El cuerpo y la clave se conservan durante los reintentos mientras el documento vive. Un clic manual a WhatsApp evita una segunda navegación automática si llega luego la confirmación. El timeout de 8 segundos sigue vigente para quien no continúa antes; los dos timers se cancelan cuando termina la solicitud.

**8 casos de navegador aprobados**, cuatro en escritorio 1280×900 y cuatro en celular Chromium emulado 390×844:

| Caso | Escritorio | Celular | Verificado |
| --- | ---: | ---: | --- |
| Continuación manual con solicitud pendiente | opción a 3010,2 ms | opción a 3007,1 ms | sin evento/afirmación de guardado; una navegación interceptada |
| Solicitud que llega al timeout | opción a 3009,9 ms; error a 8009,9 ms | opción a 3007,2 ms; error a 8010,5 ms | opción antes de 8 s; datos conservados |
| Éxito antes de 3 s | aprobado | aprobado | timer de continuación cancelado; evento solo tras confirmación |
| Fallo antes de 3 s | aprobado | aprobado | timer cancelado; cero eventos y cero navegación automática |

En el caso manual se simuló después el abandono del request y un reintento: misma clave y cuerpo bruto, sin otro POST mientras el primero seguía pendiente. La confirmación simulada del reintento emitió un único evento; no produjo una segunda navegación a WhatsApp. Estas respuestas de navegador fueron interceptadas y no escribieron en Sheets. La consulta de fila 12 usó el backend y Sheets reales.

El cambio inicial del DOM a `Abriendo WhatsApp…` se observó entre **5,2 y 7,0 ms** en los casos focalizados. La opción de los 3 segundos se inspeccionó visualmente en capturas de escritorio y celular; quedó visible y accesible. Precisión de observación DOM, no medición de píxeles.

Publicidad y todas las solicitudes externas bloqueadas; WhatsApp respondido localmente con 204. No se enviaron mensajes ni conversiones. Blobs fue el almacenamiento local aislado con compatibilidad ETag/serialización; no se atribuye este resultado al servicio remoto.

## Evidencia sin nuevos envíos

Resultado: `%TEMP%/tatos-auditoria-17UZOjIk/pending-currency-results.json`. Comparación previa: `pending-currency-before.json`. Capturas: `pending-currency-screenshots/`.

Para releer la planilla sin nuevas consultas:

```powershell
node scripts/local-sheets-test.mjs --readback
```

No repetir `--close-pendings` para revisar este resultado: ese modo ejecuta los casos focalizados y crea una consulta nueva.

## Plan mínimo para Blobs remoto — no ejecutado

1. Disponer de un **sitio Netlify de pruebas separado del productivo**, su `siteID` y una cuenta/token con acceso a ese sitio y permisos de lectura/escritura de Blobs. Si no existe ese recurso o acceso, detenerse y pedir autorización para crearlo/otorgarlo; no usar el sitio productivo. Elegir un almacén exclusivo (`tatos-blobs-remoto-pruebas`) y prefijos únicos. Permiso de borrado solo sería necesario si se autoriza limpiar las claves de prueba.
2. Configurar ID/token **solo en el proceso local**, mediante variables externas; no guardarlos en el repositorio. Ejecutar el SDK contra ese sitio remoto, sin servidor local ni compatibilidad. Verificar ETag, onlyIfNew, CAS, bloqueo y dos procesos independientes que disputen la misma clave. Hasta que pase, no habilitar escrituras de prueba a Sheets. La API permite usar `siteID` y `token` explícitos desde el cliente local: [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/#getstore).
3. Para ese primer chequeo no hace falta publicar el formulario, desplegar Functions ni subir la clave de Google. Para una prueba posterior en el runtime de Functions, haría falta autorización de despliegue en **ese sitio de pruebas** y de configuración de sus secretos: subir solo el handler y módulos/dependencias, fijar APP_ENV=test, el almacén exclusivo, la planilla de prueba, ALLOW_PRODUCTION_WRITES=false, ALLOW_TEST_SHEET_WRITES=true y un origen de prueba; email/clave de servicio en el ámbito Functions. [Variables para Functions](https://docs.netlify.com/build/functions/environment-variables/). La cuenta de servicio necesitaría seguir siendo Editor únicamente de la copia autorizada; Google Sheets API habilitada, como en la prueba local.

No se crearon sitios, almacenes remotos o tokens; no se publicaron cambios ni se modificaron variables remotas, producción, Google Ads o GTM. La credencial de Google se leyó desde Downloads en memoria y no se copió al proyecto.
