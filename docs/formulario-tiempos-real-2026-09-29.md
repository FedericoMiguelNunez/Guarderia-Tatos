# Formulario real y tiempos — 2026-09-29
> El hallazgo de Moneda quedó corregido posteriormente; la espera ahora ofrece continuación a los 3 segundos. Resultados en [cierre-moneda-espera-2026-09-29.md](cierre-moneda-espera-2026-09-29.md). Los tiempos de este documento corresponden a la versión anterior.


Se ejecutaron únicamente cinco envíos nuevos desde el formulario y cuatro casos dirigidos de fallo/demora. No se repitió la auditoría de duplicados ni las 29 pruebas anteriores. El backend y el frontend de producto no se modificaron.

## Entorno y método

- Sheets REAL: copia `17UZOjIkLGw8ykFsJRmiGlqIGwf91u8eurTZIU3fv5gc`, pestaña `Leads Google Ads`.
- Blobs LOCAL aislado con la compatibilidad de ETag/serialización ya documentada; no Blobs remoto.
- Chromium headless; escritorio 1280×900, celular emulado 390×844 (DPR 3, touch/mobile), sin limitación artificial de CPU o red.
- Cinco contextos de navegador nuevos y cinco claves únicas. Orden alternado: escritorio, celular, escritorio, celular, escritorio. No se hicieron envíos de calentamiento.
- Todas las solicitudes fuera del origen local se bloquearon. `wa.me` se respondió localmente con 204, sin contactar WhatsApp. Bloqueados: GTM, Google/Ads, Meta, Wistia y Font Awesome externos.
- Clic: evento real del botón registrado en fase capture con `performance.now()`.
- Aparición de “Abriendo WhatsApp…”: observación de la mutación y dos callbacks rAF para muestrear después de un frame con el texto actualizado. Es una cota de aparición visual, con precisión aproximada de un frame; no un sensor de píxeles.
- Inicio de navegación: `Network.requestWillBeSent` de Chromium/CDP a `wa.me`; se compara `wallTime` con `performance.timeOrigin + instante del clic`. No se usa `page.evaluate()` dentro de la ruta de navegación.
- Trazas de duración en el lanzador: envuelven los métodos originales, sin cambiar argumentos, resultados, orden, tiempos límite ni lógica de persistencia. No registran tokens, encabezados ni claves privadas.

## Tiempos individuales

| Envío | Tamaño | Clic → texto visible (ms) | Clic → navegación (ms) | Fila |
| --- | --- | ---: | ---: | ---: |
| 1 | Escritorio | 22,7 | 1613,0 | 7 |
| 2 | Celular | 22,0 | 1489,7 | 8 |
| 3 | Escritorio | 20,4 | 2490,0 | 9 |
| 4 | Celular | 22,9 | 2204,1 | 10 |
| 5 | Escritorio | 22,1 | 1573,0 | 11 |
| Mediana global | 5 envíos | **22,1** | **1613,0** | — |
| Máximo global | 5 envíos | **22,9** | **2490,0** | — |

Desglose por tamaño (muestra pequeña; no sirve para atribuir diferencias al dispositivo):

| Tamaño | n | Mediana texto (ms) | Máximo texto (ms) | Mediana navegación (ms) | Máximo navegación (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Escritorio | 3 | 22,1 | 22,7 | 1613,0 | 2490,0 |
| Celular | 2 | 22,45 | 22,9 | 1846,9 | 2204,1 |

La mutación del DOM ocurrió en 9,2–12,9 ms; los valores de la tabla incluyen el muestreo visual posterior.

## Registros confirmados leyendo directamente Sheets

Nombre: `PRUEBA AUDITORÍA TIEMPOS c55a45e6 N` (N = 1 a 5), teléfono ficticio reservado `+12025550127`, entrada `/`, consentimiento `No`, UTM source `google`, medium `cpc`, campaign `PRUEBA_TIEMPOS_c55a45e6`, content según tamaño, GCLID ficticio `PRUEBA_TIEMPOS_c55a45e6_N`.

| Fila | Gato ficticio | ID de consulta |
| --- | --- | --- |
| 7 | Nube Medición | 8a9b588e-a5dc-4c43-840d-18ed1ef40609 |
| 8 | Luna Medición | 2a0b30f6-e41c-47c4-8669-d064bbddb99e |
| 9 | Sol Medición | 33292697-3e16-419f-ba3e-2050b3f58904 |
| 10 | Menta Medición | ea9df09c-bc9b-4db8-ad50-62b735e8eac6 |
| 11 | Nina Medición | 88380aac-217f-4d07-b37d-46b3c65a9b06 |

Cada respuesta fue 201 con `saved: true`. Se comprobó un único ID/fila por consulta y exactamente cinco filas nuevas. Se verificaron nombre, gato, teléfono, fechas ISO, captura, entrada y atribución; no se reintentaron los envíos exitosos.

Se comprobó el texto natural de WhatsApp en los cinco casos y su correspondencia con el enlace de respaldo. No incluía teléfono del visitante ni identificadores publicitarios. Se inspeccionaron capturas de éxito en celular y de demora en escritorio; acciones y mensajes visibles, sin desbordamiento horizontal.

## Causa de la demora medida

| Envío | 3 lecturas + 1 escritura Sheets (ms) | Blobs local total (ms) | Backend completo (ms) | Respuesta JSON → navegación (ms) |
| --- | ---: | ---: | ---: | ---: |
| 1 | 1273,1 | 178,8 | 1470,0 | 106,5 |
| 2 | 1123,6 | 216,7 | 1345,1 | 104,1 |
| 3 | 2159,5 | 191,8 | 2354,1 | 107,8 |
| 4 | 1907,6 | 150,9 | 2061,1 | 105,7 |
| 5 | 1291,4 | 139,0 | 1433,9 | 108,0 |

El flujo existente consulta si existe el ID, relee encabezados/filas para ubicar la fila, escribe, y relee para confirmar: cuatro operaciones seriales contra Google. Eso explica la mayor parte de la demora. El envío 3 tuvo lecturas de 521,1, 542,5 y 612,3 ms; el envío 4 tuvo una escritura de 939,8 ms. La autenticación OAuth del primer envío fue 56,7 ms y está incluida en la primera lectura, no se suma otra vez. No explica el máximo, ocurrido en el envío 3.

Tras la respuesta, el formulario tiene un `setTimeout(..., 100)` previo a `location.assign`, consistente con los 104–108 ms observados. No se cambió ni esa espera ni el backend. La ubicación en la API remota está medida; la separación entre latencia de red y procesamiento interno de Google no se observó.

## Fallo y respuesta lenta

Estos cuatro casos se inyectaron en el navegador, sin mandar la solicitud al backend real y sin escritura en Sheets. No simulan el guardado de los cinco casos exitosos.

| Caso | Escritorio: clic → error | Celular: clic → error |
| --- | ---: | ---: |
| Respuesta HTTP 503 | 25,8 ms | 26,7 ms |
| Solicitud retenida más allá del timeout | 8016,1 ms | 8015,5 ms |

En ambos tamaños y ambos fallos:

- nombre, gato y teléfono se conservaron;
- el botón volvió a `Continuar a WhatsApp` y quedó habilitado;
- el enlace de respaldo quedó visible y su clic inició navegación interceptada;
- no se afirmó `Consulta guardada`, no se emitió `tatos_lead_saved` ni hubo navegación automática;
- la espera lenta terminó con `AbortError` al límite existente de 8 segundos;
- la consulta ficticia negativa no apareció en Sheets.

La demora se simuló reteniendo la respuesta hasta el aborto del navegador. Un timeout real no garantiza que el servidor no haya guardado; por eso el mensaje correctamente dice “La respuesta demoró” y conserva el cuerpo para reconciliar un futuro reintento.

## Hallazgo adicional, fuera de la optimización de tiempos

La comparación de conservación detectó que el backend existente escribe `Moneda: ARS`, reemplazando fórmulas de la plantilla en R7:R11. Se restauraron únicamente esas cinco fórmulas en la COPIA de prueba, con `USER_ENTERED`, sin alterar formatos ni validaciones. El patrón se comprobó contra la fórmula original capturada por la aserción de fila 7 y las filas de plantilla 12–15. Se confirmó luego la fórmula y su resultado `ARS` en cada fila.

Las filas 2, 3 y 4 se conservaron como evidencia; también 5 y 6. La restauración no alteró otras celdas ni creó consultas. El hallazgo del backend sigue pendiente: futuros envíos pueden volver a reemplazar la fórmula. No se modificó el backend para solucionarlo ni para mejorar los tiempos.

## Evidencias y relectura

Resultado completo sin credenciales: `%TEMP%/tatos-auditoria-17UZOjIk/form-timing-results.json`. Capturas: `%TEMP%/tatos-auditoria-17UZOjIk/form-screenshots/`.

Para leer las filas, sin nuevos envíos:

```powershell
node scripts/local-sheets-test.mjs --readback
```

No volver a ejecutar `--form-timing` para revisar estos resultados: ese modo crea cinco consultas nuevas. Las pruebas terminaron; la comparación final detectó el hallazgo de Moneda y el cierre posterior restauró las fórmulas y releyó los mismos registros.

## Paso mínimo propuesto para Blobs remoto — NO ejecutado

Para verificar solo Blobs remoto, no es necesario publicar el formulario ni el backend. Usar un sitio Netlify de pruebas distinto del sitio productivo, su `siteID`, un token autorizado para ese sitio cargado solo en el proceso local, y un almacén exclusivo, por ejemplo `tatos-blobs-remoto-pruebas`. La API oficial admite `getStore({ name, siteID, token, consistency: 'strong' })` desde un cliente autenticado; las Functions reciben contexto automáticamente cuando se despliegan. Fuente: https://docs.netlify.com/build/data-and-storage/netlify-blobs/#getstore.

Configuración mínima: acceso a un sitio de pruebas (si no existe, crear uno separado sin desplegar la web), ID de ese sitio y token; nada en producción. No se necesita subir la credencial de Google para este primer chequeo de Blobs. Ejecutar el verificador de condiciones ya creado contra ese SDK remoto, sin servidor local ni compatibilidad, y añadir la adquisición concurrente desde dos procesos independientes. El chequeo debe cubrir ETag vigente/obsoleto, `onlyIfNew`, exclusión, liberación y una única reserva bajo concurrencia. Usar prefijos nuevos y no tocar operaciones previas; si falla, detenerse antes de habilitar Sheets.

Si se necesita además comprobar el runtime de Netlify Functions, el siguiente paso sería publicar SOLO `create-lead` y sus módulos/dependencias en ese sitio de pruebas, sin GTM/Ads ni página pública de producción. Configurar en el ámbito Functions de ese sitio:

- `APP_ENV=test`, `LEAD_STORAGE_MODE=blobs`;
- `ALLOW_PRODUCTION_WRITES=false`, `ALLOW_TEST_SHEET_WRITES=true`;
- `GOOGLE_SHEETS_ID=17UZOjIkLGw8ykFsJRmiGlqIGwf91u8eurTZIU3fv5gc` y pestaña `Leads Google Ads`;
- `LEAD_BLOBS_STORE_NAME=tatos-blobs-remoto-pruebas` y origen permitido exclusivo de prueba;
- email y clave de la cuenta de servicio como secretos del sitio de pruebas, nunca en código o archivos publicados.

Las variables para Functions se configuran en Netlify UI/CLI/API con ámbito Functions, no mediante `netlify.toml`: https://docs.netlify.com/build/functions/environment-variables/. El primer chequeo remoto no requiere esa publicación opcional. No se creó el sitio, se configuraron variables remotas, se publicó ni se contrató ningún servicio.
