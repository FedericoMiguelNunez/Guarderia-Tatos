# Recuperación de bloqueos

No se recuperan bloqueos por antigüedad: Google Sheets no admite un token que impida escribir a un proceso anterior. Un timeout no demuestra que terminó su escritura.

Para el bloqueo global `sheets-row`, usar el mismo entorno y almacén que la aplicación:

1. Detener todos los escritores (en local, Netlify Dev; en remoto, impedir nuevas invocaciones y esperar la terminación de todas las existentes). Resolver cualquier petición de Sheets en vuelo antes de continuar.
2. `node scripts/recover-lead-lock.mjs inspect snapshot.json`
3. Revisar el snapshot y las consultas afectadas por `ID de consulta` en Sheets.
4. `node scripts/recover-lead-lock.mjs recover snapshot.json --writers-stopped`
5. Reiniciar los escritores. Las consultas `retryable` mantienen su ID al reintentar.

En Blobs se libera únicamente la versión del snapshot mediante ETag. En disco la recuperación exige detener todos los procesos porque eliminar un archivo no admite compare-and-swap. Los archivos antiguos vacíos también son recuperables. Para un bloqueo individual `idem-*.lock` del mock, usar `node scripts/recover-lead-lock.mjs inspect snapshot.json idem-CLAVE` y luego el mismo comando `recover` indicado arriba. No borrarlos en masa.

Las operaciones `processing` o `review` no se vuelven a escribir automáticamente: reconciliar primero por ID, conservando ese ID. La recuperación del bloqueo no equivale a resolver una escritura incierta.

# Planilla de prueba

Usar `LEAD_STORAGE_MODE=blobs`, credenciales y un ID distinto de producción, con `ALLOW_TEST_SHEET_WRITES=true`. Producción sigue exigiendo `APP_ENV=production` y `ALLOW_PRODUCTION_WRITES=true`; el permiso de prueba nunca habilita producción.

La integración exige los 34 encabezados de `REQUIRED_HEADERS`. Una planilla de 19 columnas necesita migración antes de una prueba de escritura. El estado inicial es `Pendiente`, compatible con el desplegable informado. No se modifica automáticamente la estructura ni las validaciones de una planilla existente.
