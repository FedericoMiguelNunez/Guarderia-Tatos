# Auditoría del flujo — 29 de septiembre de 2026

## Punto de reanudación

Se recuperó el estado desde el código y `docs/formulario-tatos.md`; no se dispone del historial de la conversación interrumpida. El último commit visible es `5058ac0` (`faqs`). La implementación del formulario está en cambios locales: `index.html` y `style.css` modificados, y backend, frontend modular, documentación, configuración y pruebas sin seguimiento de Git.

El documento previo describe una entrega local con pendientes externos. No demuestra que se hayan completado pruebas de navegador o integración real. Esta revisión conserva los cambios existentes y no publica ni modifica Sheets, GTM o Ads.

## Verificación realizada

- `npm.cmd test`: 19 pruebas aprobadas, 0 fallos.
- `npm.cmd run build`: correcto; se regeneró `dist/` mediante el script existente.
- Primer intento de navegador: los 18 casos fallaron antes de iniciar por falta del ejecutable de Chromium. Se instaló Chromium con `npx.cmd playwright install chromium`; se repite la suite con almacenamiento mock y escrituras productivas deshabilitadas.
- Resultado final de navegador: 15 casos aprobados en la ejecución completa y los 3 casos restantes aprobados en una ejecución dirigida después de corregir la simulación. Los 18 casos tienen un resultado satisfactorio; no se repitieron los 15 casos no afectados. Las respuestas del endpoint están simuladas: esto no verifica el recorrido HTTP real hasta Sheets.
- PowerShell bloquea `npm.ps1`; se utilizó `npm.cmd` sin cambiar la política del sistema.
- El entorno aislado falló al crear procesos; los comandos de revisión se ejecutaron mediante la autorización de ejecución fuera de él.

## Hallazgos de código, por prioridad

### Alta: el bloqueo de filas puede vencer durante una escritura

`server/idempotency-store.mjs:74` concede un bloqueo de 30 segundos y permite reemplazarlo al vencer, pero no renueva el bloqueo ni detiene al escritor anterior. `server/sheets-store.mjs:58` selecciona una fila libre antes de escribirla. Si una operación queda pendiente más de 30 segundos, otro escritor puede seleccionar la misma fila. El control del token al liberar protege la liberación, pero no evita escrituras simultáneas ni una posible sobrescritura.

Reproducción local: se ejecutó la clase real `BlobsIdempotencyStore` sobre un almacenamiento en memoria que respeta `onlyIfNew` y `onlyIfMatch`. Se mantuvo el primer callback pendiente, se adelantó el reloj 31 segundos y se inició otro escritor. Resultado: `simultaneousWritersAfterLeaseExpiry: true`. Esto confirma la superposición de callbacks; no se provocó una sobrescritura en Sheets ni se accedió a Blobs real.

### Alta: un reintento con datos editados conserva una clave incompatible

`js/lead-form.js:57` conserva `attemptKey` tras un error, pero vuelve a construir el cuerpo con los campos actuales y vuelve a leer atribución y consentimiento en cada envío (`:65`). Si el servidor ya reservó la clave y el usuario corrige un campo después de un timeout, devuelve `IDEMPOTENCY_CONFLICT`; el formulario trata el conflicto como un fallo genérico y sigue reutilizando la misma clave. La atribución tampoco queda congelada durante todo el intento. Se necesita conservar el cuerpo original para reconciliar una operación incierta y definir explícitamente cuándo comenzar una consulta nueva.

Verificación con `LeadService` y almacenes en memoria: primer envío 201; segunda solicitud con la misma clave y otro nombre de gato, 409 `IDEMPOTENCY_CONFLICT`. El rechazo del backend es correcto; falta resolver la recuperación en el frontend.

### Media: cualquier respuesta HTTP satisfactoria se presenta como consulta guardada

`js/lead-form.js:67-71` acepta un cuerpo JSON inválido como `{}` y solo comprueba `response.ok`. Una respuesta 200 vacía o inesperada emite `tatos_lead_saved` y abre WhatsApp sin comprobar `saved === true` ni el ID de consulta. Validar el contrato de éxito y cubrir una respuesta 200 inválida.

### Media: tres pruebas de navegador no abren el diálogo

Los casos de atribución, fallo y layout intentaban completar o desplazar elementos dentro de `#consulta` cuando el diálogo seguía oculto. Se corrigió su preparación en `tests/lead-form.spec.js`: ahora activan un CTA antes de interactuar. El cambio se aplica a los tres tamaños configurados. No confundir un fallo de preparación de la prueba con un fallo del flujo para el visitante.

Tras instalar Chromium, pasaron 15 de los 18 casos. Los tres casos de éxito fallaron al leer el enlace después de abortar la navegación a WhatsApp. Se cambió esa simulación por una respuesta 204 que conserva el documento y se agregó una comprobación de que la URL solicitada coincide con el enlace de respaldo. La navegación sigue interceptada y no contacta WhatsApp.

### Cobertura: el flujo nuevo solo está instalado en la portada

Solo `index.html` carga `lead-attribution.js` y `lead-form.js`. Servicios, requisitos, nosotros y galería conservan accesos directos `wa.link`. Una llegada publicitaria a esas páginas no captura atribución mediante el módulo nuevo; un contacto desde sus botones omite el guardado del formulario. Confirmar el alcance original antes de extender el cambio a esas páginas.

## Próximo punto de trabajo

La recuperación del estado, la compilación y las pruebas existentes quedan verificadas. La preparación de navegador está corregida y los casos pasan en 360 px, 390 px y escritorio. El siguiente punto es corregir y cubrir los escenarios de reintento y concurrencia anteriores, validar el contrato de éxito y probar el endpoint HTTP con almacenamiento local. Los hallazgos de lógica de producto permanecen abiertos. Las pruebas actuales no validan Google Sheets ni Blobs reales; tampoco sustituyen una revisión visual manual.

Siguen pendientes los pasos externos del documento original: copia autorizada de Sheets, credenciales de prueba, integración real de Blobs, revisión de medición y consentimiento, y aprobación separada antes de publicación. No se han ejecutado durante esta revisión.

## Verificación posterior solicitada: escritorio y celular

- Se preservaron el formulario y el mensaje de WhatsApp existentes, sin cambios de producto.
- Se comprobó por hash que `index.html`, `style.css` y ambos módulos del formulario coinciden con los archivos servidos en `dist/`.
- `npm.cmd run test:e2e -- --config scripts/audit-visual.config.mjs`: **18 pruebas aprobadas en una ejecución completa**, en 1280×900, 390×844 y 360×740.
- Verificado: apertura, foco y cierre; campos obligatorios; conservación de datos; bloqueo del botón durante envío; éxito y error simulados; contenido y destino del enlace de WhatsApp; ausencia de desbordamiento horizontal.
- Se inspeccionaron capturas de validaciones en los tres tamaños y de éxito en escritorio y 360 px: campos, mensajes, cierre y acciones visibles, sin recortes ni superposiciones apreciables en esas capturas.
- Se agregó exclusivamente una configuración de auditoría con capturas, reutilizando los escenarios existentes. Evidencias en `test-results/visual-audit/` (carpeta ignorada por Git).
- Límite: celulares emulados en Chromium; no se verificaron dispositivos físicos, teclado virtual real ni Safari/iOS. Guardado y navegación a WhatsApp están interceptados; este resultado no valida Sheets ni la apertura de la aplicación nativa.
- El navegador integrado no pudo conectarse por un error del entorno Windows; la revisión se completó con las pruebas locales y sus capturas.
