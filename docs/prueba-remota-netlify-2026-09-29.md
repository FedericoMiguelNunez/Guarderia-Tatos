# Prueba remota Netlify — 2026-09-29

## Cuenta y capacidad consultadas

- Sesión CLI activa: fede24896@gmail.com.
- Equipo: grupo 11, slug `federicomiguelnunez`, ID `643c722dd45d4c2b212bedf8`.
- Rol: Owner; acceso a todos los sitios.
- Plan: Free (`free-is-free`), sin método Stripe ni recarga automática.
- Período de uso: 1 de septiembre a 1 de octubre de 2026.
- Capacidades que informa la API: funciones 0/125000; minutos de build 0/300; transferencia 0/107374182400 bytes. No límites excedidos.
- Estos valores son los informados por la API; no se contrastaron con el panel de facturación.

## Recurso creado

- Sitio: `tatos-backend-test-mun7j93b`.
- SiteID: `19f95382-9b4e-44dc-b1df-21e9856ff58f`.
- URL asignada: https://tatos-backend-test-mun7j93b.netlify.app
- Almacén solicitado exclusivamente para pruebas: `tatos-remote-test-19f95382-9b4e-44dc-b1df-21e9856ff58f`.
- SiteID de producción excluido: `80fb5b5d-a41b-48d2-8f76-26d91a6c795d`.
- El sitio no tiene deploy; la URL asignada no ofrece todavía un backend.
- No se cambió la vinculación local ni se conectó un repositorio Git.

## Bloqueo comprobado

La primera escritura `set(..., {onlyIfNew:true})` del SDK instalado @netlify/blobs 10.0.10 falla al obtener la URL firmada:

`PUT /api/v1/blobs/<siteID>/<store>/<key>` → HTTP 401, `Access Denied: user does not have access`.

Una lectura diagnóstica obtiene una URL firmada con HTTP 200 y el objeto inexistente responde 404. Una escritura diagnóstica única confirmó el mismo 401. La sesión sí permite consultar la cuenta, listar sitios y crear el sitio separado.

No hay contexto local de Blobs en el proceso. No se usó mock ni se alteró la dependencia. No se confirmó la causa interna de la diferencia entre permisos GET/PUT.

## Estado y siguiente paso

No se verificaron onlyIfNew, onlyIfMatch, ETag ni concurrencia remota porque la primera escritura no fue autorizada. No se configuraron secretos de Google, no se desplegó el backend y no se escribió en Sheets. No hay filas, IDs de consulta ni tiempos de endpoint remoto que reportar.

La documentación oficial permite proporcionar un Personal Access Token con acceso a Blobs al ejecutar el SDK fuera de funciones. El siguiente diagnóstico mínimo es comprobar Blobs en el panel de este sitio y probar una credencial temporal con ese acceso, transferida únicamente por un mecanismo local seguro, nunca por chat. No se puede garantizar que cambiar la credencial resuelva el rechazo; si persiste, escalar el error a soporte de Netlify sin cambiar de plan.

El script `scripts/remote-netlify-test.mjs` conserva el SiteID en `%TEMP%/tatos-remote-audit/state.json` para reutilizar este sitio. No guarda tokens ni credenciales de Google. Su guardia impide continuar con Sheets si falla la comprobación de Blobs.
