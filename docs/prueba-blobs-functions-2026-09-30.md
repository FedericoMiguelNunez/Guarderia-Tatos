# Prueba aislada de Blobs en Functions

Se usó exclusivamente la sesión CLI existente, sin leer el PAT/DPAPI ni cargar credenciales de Google. Sitio de pruebas: `19f95382-9b4e-44dc-b1df-21e9856ff58f`, equipo `643c722dd45d4c2b212bedf8`. Se verificaron sitio, plan Free, ausencia de recarga automática y capacidad de Functions antes del despliegue.

Se preparó una sola función `blobs-diagnostic` con el SDK instalado, clave aleatoria de invocación conservada únicamente en memoria, hash de esa clave en el bundle, comparación de tiempo constante, POST exclusivo, guardia de SiteID y vencimiento de 15 minutos. No se incluyeron formulario, frontend, credenciales Google ni código Sheets. No se cambiaron controles de acceso del sitio ni variables remotas. Los despliegues fueron borradores, sin publicar el sitio.

## Resultados

1. Borrador Lambda `6abd0f93385be59270bcb7c8`: listo. Las solicitudes sin clave y con clave incorrecta devolvieron 401; un GET autenticado devolvió 405. La prueba se detuvo en `reserve-write` con 503 sin estado HTTP de Blobs. La implementación instalada de `connectLambda` no establece `uncachedEdgeURL`, que el SDK exige con consistencia fuerte incluso antes de una escritura. Este intento no permitió evaluar el 401 original de Blobs.
2. Borrador Functions v2 `6abd105c572bfa81c59148e1`: listo. El endpoint devuelve HTTP 502 y el marcador de plataforma `error decoding lambda response`. Se detuvo antes de poder verificar el control de acceso o ejecutar la prueba de Blobs. La causa interna exacta de la respuesta no se confirmó; el fallo observado corresponde a la invocación/decodificación del runtime, no a un HTTP 401 del servicio Blobs. No se debilitaron consistencia ni autenticación para evitarlo.

URL del segundo borrador: https://6abd105c572bfa81c59148e1--tatos-backend-test-mun7j93b.netlify.app

Request ID de la consulta diagnóstica sin credencial: `01M3S9432ZEA3RPY3SY2V0DMXG`. Evidencia estructurada sin secretos: `%TEMP%/tatos-remote-audit/function-diagnostic.json`.

Se detuvo el trabajo remoto según la instrucción del usuario. No se repitió una escritura fallida ni se solicitó otro PAT. No quedaron comprobadas escritura, lectura, ETag, condiciones o reintento remoto. No hubo envíos a Sheets, modificación productiva, Ads, GTM ni contratación. Las claves aleatorias no se persistieron y los endpoints cierran la invocación autorizada al vencer su plazo; el 502 del segundo borrador no permite verificar ese comportamiento en remoto.

Referencias oficiales: [Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [Functions](https://docs.netlify.com/build/functions/get-started/), [despliegue API](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/).
