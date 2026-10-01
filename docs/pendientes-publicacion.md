# Cierre para merge y publicación

## Lecturas realizadas el 30 de septiembre de 2026

La cuenta de servicio del backend recibió **HTTP 403** al consultar metadatos de la planilla productiva `1_f64qlaRjbUKeFsNiQ9MAy-Zxdgozwhc73fs9_uCYyY` a las 21:44 UTC. No se leyeron filas ni se escribió. **Acceso y encabezados productivos pendientes de confirmación**: no se asume que estén presentes ni que falten.

Intervención necesaria: compartir la planilla productiva con `tatos-sheets@centered-sight-383720.iam.gserviceaccount.com`. Lectura basta para comprobar encabezados; la operación productiva posterior necesita permiso de edición. Después, ejecutar únicamente `node scripts/verify-production-readiness.mjs`, que usa alcance Sheets de solo lectura y no imprime secretos. No repetir las pruebas remotas aprobadas.

La lectura de variables en Netlify confirmó que ninguna de las diez variables siguientes tiene valor productivo ni alcance Functions configurado en el sitio productivo `80fb5b5d-a41b-48d2-8f76-26d91a6c795d`. No se crearon ni modificaron variables productivas.

## Variables exactas pendientes

Configurar en el sitio productivo, contexto **production**. Usar todos los scopes compatibles con Free (`builds`, `functions`, `runtime`, `post_processing`); la clave nunca debe exponerse mediante variables de frontend ni incluirse en el bundle. La configuración preparada permanece local y deshabilitada.

| Variable | Valor preparado | Para activar |
| --- | --- | --- |
| `APP_ENV` | `production` | Cargar |
| `LEAD_STORAGE_MODE` | `blobs` | Cargar |
| `LEAD_BLOBS_STORE_NAME` | `tatos-lead-operations` | Cargar; separado del almacén de pruebas |
| `ALLOW_PRODUCTION_WRITES` | `false` | Cambiar a `true` solamente con autorización para activar |
| `ALLOW_TEST_SHEET_WRITES` | `false` | Cargar y mantener |
| `GOOGLE_SHEETS_ID` | `1_f64qlaRjbUKeFsNiQ9MAy-Zxdgozwhc73fs9_uCYyY` | Cargar |
| `GOOGLE_SHEETS_TAB` | `Leads Google Ads` | Confirmar pestaña por lectura y cargar |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `tatos-sheets@centered-sight-383720.iam.gserviceaccount.com` | Cargar después de confirmar acceso |
| `GOOGLE_PRIVATE_KEY` | Secreto externo; sin valor en Git | Cargar desde el archivo de credencial externo mediante configuración protegida |
| `ALLOWED_ORIGINS` | `https://guarderiatatos.com.ar` | Cargar; agregar otro origen solamente si realmente sirve el formulario |

No copiar `TEST_NETLIFY_SITE_ID` ni valores de prueba a producción. `WHATSAPP_BUSINESS_NUMBER` no es una variable requerida por el código actual: el destino está en `data-whatsapp-number` del HTML. `ATTRIBUTION_TTL_DAYS` tampoco controla el módulo actual: usa `data-attribution-ttl-days` del HTML o su valor predeterminado de 90 días.

## Encabezados que debe confirmar la lectura

El backend requiere exactamente estos nombres (el orden puede variar):

`Fecha contacto`, `Nombre`, `WhatsApp`, `Fuente`, `Campaña`, `Término de búsqueda`, `Palabra clave`, `GCLID`, `Contactó`, `Interesado`, `Estado de la reserva`, `Fecha y hora de confirmación`, `Valor total de la estadía`, `Días estadía`, `Estado de envío a Google Ads`, `Observaciones`, `ID único de reserva`, `Moneda`, `Cancelación o ajuste`, `Nombre del gato`, `ID de consulta`, `GBRAID`, `WBRAID`, `UTM source`, `UTM medium`, `UTM campaign`, `UTM term`, `UTM content`, `Campaign ID`, `Adgroup ID`, `Captura atribución`, `Página de entrada`, `Consentimiento conocido`, `Diagnóstico de atribución`.

Si faltan encabezados, agregar únicamente los faltantes después de confirmar por lectura. Conservar encabezados actuales, datos, fórmulas, formatos y validaciones. No se autorizaron ni ejecutaron cambios productivos en Sheets.

## GTM: ajuste pendiente antes de publicar el flujo

Se leyó el contenedor **publicado** `GTM-MC2Z95VT` como texto a las 21:45 UTC, sin ejecutar etiquetas. No se inspeccionaron borradores de GTM. La etiqueta de conversión tipo `__awct` tiene dos reglas de disparo:

- Evento `gtm.click` y elemento que coincide con `button[onclick*="wa.link"], button[class^="Beneficio-titulo"]`.
- Evento `gtm.linkClick` y URL del elemento que contiene `wa.link`.

Los CTA nuevos son enlaces `#consulta`: abrir el formulario no satisface ninguna de esas dos reglas. **El botón de envío `button.Beneficio-titulo_btn.lead-submit` sí satisface la primera**, de modo que puede disparar conversión antes de confirmar el registro, incluso con un 503. El contenedor publicado no tiene una regla para `tatos_lead_saved` y el enlace de continuidad usa `wa.me`, que no satisface la regla de `wa.link`.

Ajuste propuesto para una tarea autorizada de GTM: excluir `#lead-form` (incluido `.lead-submit`) de la regla genérica de botones; decidir si se medirá consulta guardada o clic de salida a WhatsApp. Para consulta guardada, usar el evento `tatos_lead_saved`, que se emite una vez después de confirmar Sheets y significa registro guardado, no mensaje enviado. Mantener separados los accesos directos `wa.link` de otras páginas y evitar contar dos eventos del mismo recorrido. Revisar en preview antes de publicar el contenedor, sin duplicar las pruebas de persistencia aprobadas. No se modifica la conversión existente ni Google Ads en esta entrega.

## Qué entra al commit y qué falta para publicar

El commit incluye el formulario y sus estilos, captura de atribución, validación, Function, adaptadores Sheets/Blobs con idempotencia y recuperación de bloqueos, configuración/build de Netlify y dependencias fijadas, pruebas de código con fixtures, Apps Script como código sin instalar, scripts reutilizables de integración/lectura y documentación de operación/activación.

Lista exacta de archivos incluidos (32):

- Página y formulario: `index.html`, `style.css`, `js/lead-attribution.js`, `js/lead-form.js`.
- Backend: `netlify/functions/create-lead.mjs`, `server/idempotency-store.mjs`, `server/lead-service.mjs`, `server/lead-validation.mjs`, `server/sheets-store.mjs`.
- Configuración y dependencias: `.gitignore`, `netlify.toml`, `package.json`, `package-lock.json`, `playwright.config.js`.
- Apps Script, sin instalar: `apps-script/Code.gs`, `apps-script/appsscript.json`.
- Scripts: `scripts/build-public.mjs`, `scripts/complete-test-integration.mjs`, `scripts/inspect-published-gtm.mjs`, `scripts/recover-lead-lock.mjs`, `scripts/verify-production-readiness.mjs`.
- Pruebas de código: `tests/apps-script.test.mjs`, `tests/currency-preservation.test.mjs`, `tests/lead-attribution.test.mjs`, `tests/lead-form.spec.js`, `tests/lead-regressions.test.mjs`, `tests/lead-service.test.mjs`.
- Documentación: `docs/configuracion-produccion-pendiente.json`, `docs/formulario-tatos.md`, `docs/integracion-remota-completada-2026-09-30.md`, `docs/pendientes-publicacion.md`, `docs/recuperacion-bloqueos.md`.

Se excluyen todos los archivos `.env` (incluido el ejemplo), credenciales/tokens, capturas de consultas, mensajes de WhatsApp de prueba, informes históricos con datos de prueba, archivos temporales y salidas de ejecución. Se preservan localmente. Los valores de fixtures en pruebas y los datos ficticios generados por scripts son ejemplos de código, no registros de personas capturados.

Pendientes concretos: resolver el 403 y confirmar los 34 encabezados; aplicar solo las adiciones de encabezados necesarias con autorización; cargar las diez variables sin activar escrituras; coordinar el ajuste de medición de GTM en una tarea autorizada; aprobar merge y publicación; habilitar `ALLOW_PRODUCTION_WRITES=true` y desplegar. Apps Script no es requisito del recorrido formulario → registro → WhatsApp: instalar sus disparadores de reservas sería una acción posterior separada.

El nuevo formulario se integra en `index.html`; las otras páginas conservan enlaces directos a WhatsApp. No se extiende este commit a esas páginas. Las tres pruebas remotas de persistencia/reintento/continuidad ya pasaron y no se repitieron.
