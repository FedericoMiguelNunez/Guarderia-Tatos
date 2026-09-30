# Integración remota completada — 2026-09-30

Se conservó la rama `codex` y el trabajo existente. No se hizo merge, push ni publicación productiva. No se crearon sitios ni ramas, no se cambiaron Google Ads o GTM y no se contrataron servicios.

## Resultado

- Sitio de pruebas existente: `19f95382-9b4e-44dc-b1df-21e9856ff58f`, `tatos-backend-test-mun7j93b`.
- Planilla de pruebas existente: `17UZOjIkLGw8ykFsJRmiGlqIGwf91u8eurTZIU3fv5gc`, pestaña `Leads Google Ads`. Se leyeron los 34 encabezados requeridos; no se modificó su estructura.
- [Borrador completo verificado](https://6abd80b24222d95bdc3e3aa7--tatos-backend-test-mun7j93b.netlify.app).
- Configuración de prueba cargada en Netlify para contextos `dev` y `deploy-preview`, con almacén Blobs `tatos-lead-operations-test-17UZOjIk` y `ALLOW_PRODUCTION_WRITES=false`.

El 502 previo se corrigió declarando explícitamente `build_data.runtimeAPIVersion=2` y `bootstrapVersion` al desplegar el bundle. `zipFunctions()` expone esos campos directamente; `fn.buildData` no existía y se omitía de la solicitud. El despliegue completo respondió correctamente desde Functions v2 y usó Blobs remoto y Sheets real.

El cargador usa SHA-1 para archivos públicos y SHA-256 para Functions. Las variables se guardaron con todos los scopes admitidos por el plan Free, exclusivamente en el sitio de pruebas. Los intentos anteriores se detuvieron antes de los envíos por un 403 de configuración y un 422 del hash de archivos.

La Function permite el origen del propio borrador solamente si `APP_ENV=test` y `context.site.id` coincide con `TEST_NETLIFY_SITE_ID`. Producción conserva su lista explícita de orígenes.

## Las tres verificaciones solicitadas

1. **Envío completo:** Chromium abrió el formulario del borrador remoto, envió datos ficticios y obtuvo HTTP **201**, `saved=true`, ID `7a09b731-ebbf-41ca-96dc-1991f64c1119`. Se confirmó directamente en Sheets **una sola fila** con ese ID y se observó la navegación a WhatsApp.
2. **Reintento:** el mismo payload respondió HTTP **200**, `replayed=true`, con el mismo ID. La lectura directa siguió mostrando **una sola fila**.
3. **Fallo de registro:** se interceptó el POST en el navegador con HTTP **503**. El formulario mostró el error y el enlace para continuar a WhatsApp; al activarlo se observó la navegación. Este caso no escribió en Sheets y no simula una caída real del servicio remoto.

En ambos recorridos de WhatsApp se interceptó la navegación con HTTP 204; no se enviaron mensajes. Se bloquearon solicitudes externas al borrador, incluidas etiquetas publicitarias. No se reiniciaron auditorías ni suites aprobadas.

La evidencia original quedó fuera del commit en `%TEMP%/tatos-remote-audit/integration-result.json`. El repositorio conserva solamente este resumen, sin nombres, teléfonos ni mensajes de las pruebas.

## Preparación productiva y pendientes

[configuracion-produccion-pendiente.json](configuracion-produccion-pendiente.json) contiene la configuración propuesta del sitio y la planilla productivos, con el dominio canónico existente `https://guarderiatatos.com.ar`, almacén separado y `ALLOW_PRODUCTION_WRITES=false`. No se aplicó. El archivo tiene un marcador de secreto, nunca la clave privada.

Para merge: revisar y registrar los cambios de `codex`, incluidos los archivos de integración que ya estaban sin seguimiento. Las verificaciones solicitadas están aprobadas; no requieren repetir las auditorías anteriores.

Para publicar, consultar la [lista concreta de pendientes y variables](pendientes-publicacion.md). La lectura productiva y la lectura de GTM del cierre posterior están documentadas allí. No se aplicará la configuración automáticamente ni se modificará Ads/GTM.

El sitio de pruebas permanece con borradores y datos ficticios como evidencia. Las consultas con escritura incierta conservan la política de revisión y la recuperación manual documentada en [recuperacion-bloqueos.md](recuperacion-bloqueos.md).
