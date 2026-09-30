# Formulario de consultas — Guardería Tatos

## Estado de esta entrega

Integración remota de pruebas completada el 30 de septiembre: ver [resultado y pendientes](integracion-remota-completada-2026-09-30.md). Producción permanece sin activar. El modo predeterminado local es `mock`; no se envían conversiones a Google Ads, no se publican cambios de GTM y las pruebas no mandan mensajes de WhatsApp. El ID productivo de Sheets queda bloqueado si `APP_ENV` no es `production`, incluso cuando existan variables heredadas.

No se inspeccionó ni modificó la planilla productiva. El esquema descrito abajo parte de la especificación y requiere verificación sobre una copia expresamente autorizada.

## Estructura

- `index.html`, `style.css`, `script.js`: página existente y enlace mínimo al formulario.
- `js/lead-attribution.js`: captura permitida, vencimiento, coherencia de campaña y fallback de almacenamiento.
- `js/lead-form.js`: validación, idempotencia del intento, POST, reintento, fallback y navegación a WhatsApp.
- `netlify/functions/create-lead.mjs`: único endpoint público; POST JSON, origen, tamaño y respuestas sin PII.
- `server/`: validación compartida, Google Sheets por encabezados, adaptadores Blobs/mock y orquestación/reconciliación.
- `apps-script/`: automatización vinculable a una copia de la planilla; no es un endpoint público.
- `tests/`: servicio, lógica de reservas y navegador.
- `scripts/build-public.mjs`: construye `dist/` por lista explícita.
- `docs/`: decisiones y pasos externos. No se copia a `dist/`.

## Diseño y experiencia

El formulario permanece oculto hasta activar un CTA de consulta o WhatsApp. Se presenta como un diálogo dentro de la página, sobre un fondo atenuado, y reutiliza Oswald, los tokens verde/crema/naranja, radio de 25 px, sombra y un ancho máximo de 800 px. Hay dos columnas en escritorio y una en hasta 600 px; en móvil la tarjeta aprovecha el alto disponible con scroll interno. Las etiquetas son persistentes, los inputs usan 16 px, el foco es visible y cada error está asociado y anunciado. Puede cerrarse con el botón, el fondo o Escape, conserva lo escrito y devuelve el foco al CTA. Abrir o cerrar no registra consultas ni emite eventos.

El repositorio no contiene una política de privacidad existente, por lo que el formulario no inventa una URL ni muestra un enlace provisional. Tampoco incluye consentimiento de marketing: enviar una consulta no se interpreta como autorización publicitaria.

## Desarrollo local

Requisitos: Node 20 o posterior.

```powershell
$env:APP_ENV = 'local'
$env:LEAD_STORAGE_MODE = 'mock'
$env:ALLOW_PRODUCTION_WRITES = 'false'
npm install
npm run build
npm run dev
```

Valores seguros de primera ejecución: `LEAD_STORAGE_MODE=mock`, `APP_ENV=local`, `ALLOW_PRODUCTION_WRITES=false`. Abrir `http://localhost:8888`. El endpoint es `POST /.netlify/functions/create-lead`.

Comandos:

```powershell
npm test
npm run test:e2e
npm run build
```

`npm run build` borra y reconstruye `dist/`; copia solo páginas, estilos, scripts y recursos públicos declarados. Revisar cada nueva ruta pública en la lista del script. Nunca copiar `.env`, `server/`, `apps-script/`, `tests/`, `docs/`, `netlify/` ni credenciales.

## Atribución y consentimiento

Se aceptan `gclid`, `gbraid`, `wbraid`, UTM, `campaign_id`, `adgroup_id` y `keyword`, conservando el valor recibido. Se guarda fecha, ruta sin query y vencimiento (90 días por defecto). Una llegada publicitaria reemplaza el conjunto completo; una llegada directa posterior no lo borra. La consulta toma una copia congelada.

Mientras no exista consentimiento explícito, el frontend usa `sessionStorage`; si está bloqueado usa memoria. Solo usa `localStorage` si la integración futura define `window.tatosAdvertisingConsent === true`. La consulta nunca se bloquea por falta de atribución. Pendiente: aprobar plazo y conectar el mecanismo real de consentimiento.

UTM no equivale a identificador de clic. `keyword` es palabra clave publicitaria, no término de búsqueda. El campo “Término de búsqueda” queda vacío. “Fuente” solo dice Google Ads cuando llega GCLID/BRAID; una visita sin evidencia no se etiqueta como Ads.

## Idempotencia y consistencia

El navegador crea una clave por intento y la conserva al reintentar. El servidor crea el ID de consulta. Blobs usa lectura fuerte, `onlyIfNew` para reservar y `onlyIfMatch` para cambios de estado. Un lock sin recuperación automática por antigüedad serializa la selección de filas. La misma clave con otro payload devuelve conflicto; el mismo teléfono con otra clave crea otra consulta.

Sheets y Blobs no son una transacción. Antes de reintentar una escritura se busca el ID de consulta; una respuesta perdida después de escribir se reconcilia. Si el resultado no puede determinarse se marca revisión y no se repite el append. Esto es “at-least-once con reconciliación”, no una promesa de exactly-once.

Blobs y Functions consumen recursos según el plan. Antes de activar `LEAD_STORAGE_MODE=blobs`, revisar en Netlify **Usage & billing**, el consumo de Functions y **Data & Storage > Blobs**. Presupuesto de esta tarea: $0; no cambiar plan ni activar extras.

La limitación por IP está disponible en Netlify, pero la configuración de código requiere una ruta personalizada y deshabilita en Netlify Dev la ruta convencional solicitada. Se conservó `/.netlify/functions/create-lead`; antes de publicar se debe validar una regla de rate limiting en el entorno del sitio sin cambiar ese contrato. El honeypot y la validación de origen son defensas adicionales, no autenticación.

## Preparación de Sheets

1. Crear una copia de prueba autorizada. No usar la planilla final en desarrollo/preview.
2. Habilitar Sheets API en un proyecto de prueba y crear una cuenta de servicio con alcance mínimo.
3. Compartir exclusivamente esa copia con el email de la cuenta de servicio. No hacer pública la planilla ni enviar el JSON por chat.
4. Agregar, sin renombrar ni borrar columnas existentes: `Nombre del gato`, `ID de consulta`, `GBRAID`, `WBRAID`, `UTM source`, `UTM medium`, `UTM campaign`, `UTM term`, `UTM content`, `Campaign ID`, `Adgroup ID`, `Captura atribución`, `Página de entrada`, `Consentimiento conocido`, `Diagnóstico de atribución`.
5. Preservar fórmulas/validaciones. Las columnas técnicas pueden agruparse u ocultarse por usabilidad; ocultarlas no agrega seguridad.
6. Configurar variables disponibles en **Functions** y valores separados por contexto. En Free, usar todos los scopes admitidos, como en la configuración preparada. Nunca poner secretos en `netlify.toml` ni usar prefijos exportados al frontend.

El backend lee encabezados, localiza la primera fila vacía por ID/contacto (ignora fórmulas vacías como las de Moneda hasta fila 1000), escribe celdas por nombre con `RAW` y confirma el ID antes de responder éxito.

## Apps Script

En la copia autorizada, abrir Extensiones > Apps Script, copiar `Code.gs` y `appsscript.json`, verificar `TATOS.TAB` y ejecutar una vez `installEditTrigger`. Revisar permisos antes de aceptar. Probar confirmación con estado/importe en ambos órdenes, pegado de varias filas, cero/inválido, cancelación y ajuste.

Al confirmar se fija una sola fecha en `America/Buenos_Aires`, se crea un UUID permanente si falta y se asigna ARS. El importe es el total de la estadía. Nunca se marca “Enviado”; “Estado de envío a Google Ads” permanece “No configurado”. Las escrituras API no disparan `onEdit`, por eso la Function crea el estado inicial y el script aplica la misma política a ediciones humanas. `LockService` serializa ediciones del script; es independiente del lock de filas del backend.

## WhatsApp y medición

El destino verificado en el código existente es `5491135942796`. El mensaje solo contiene nombre y gato. La navegación ocurre en la pestaña actual después de confirmar la fila; queda un enlace visible si la app no toma el control. El teléfono es declarado, no verificado, y no demuestra que el mensaje se envió.

GTM publicado usa `GTM-MC2Z95VT` y observa enlaces `wa.link` y botones cuya clase comienza con `Beneficio-titulo`. La lectura actual y el riesgo de contar el envío antes del registro están detallados en [pendientes-publicacion.md](pendientes-publicacion.md). El nuevo recorrido emite solo `{ event: "tatos_lead_saved" }`, sin PII ni IDs. Antes de publicar:

1. Crear y previsualizar un trigger específico para ese evento.
2. Desactivar/adaptar el trigger anterior de `wa.link` para evitar doble conteo o conteo al abrir el formulario.
3. No vincular todavía el evento a una conversión Ads ni disparar `gtag` de Ads.
4. Validar en modo preview con etiquetas Ads/Meta desactivadas; no publicar GTM en esta tarea.

## Checklist previo a cualquier despliegue

- Aprobar copia y contenido del aviso de privacidad, consentimiento y TTL.
- Verificar esquema real en una copia de Sheets y autorizar credenciales de prueba.
- Verificar plan/consumo de Functions y Blobs; confirmar presupuesto $0.
- Probar Blobs real en contexto de prueba, concurrencia y recuperación de locks.
- Ejecutar unitarias, navegador a 360/390/escritorio y revisar capturas.
- Coordinar GTM y confirmar que no hay doble conteo ni llamadas reales en tests.
- Revisar `dist/` y variables por contexto; confirmar bloqueo del ID productivo en dev/preview.
- Solicitar una aprobación separada y concreta antes de push, preview remoto o deploy.

## Referencias verificadas

- [Netlify Functions](https://docs.netlify.com/build/functions/get-started/)
- [Variables de entorno](https://docs.netlify.com/build/environment-variables/get-started/)
- [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
- [Uso y facturación de Functions](https://docs.netlify.com/build/functions/usage-and-billing/)
- [Google Sheets values](https://developers.google.com/workspace/sheets/api/guides/values)
- [Triggers instalables](https://developers.google.com/apps-script/guides/triggers/installable)
- [Apps Script LockService](https://developers.google.com/apps-script/reference/lock/lock-service)
