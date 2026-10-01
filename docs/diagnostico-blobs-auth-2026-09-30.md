# Auditoría de autenticación Blobs

Consultas de solo lectura realizadas con la credencial del usuario activo del CLI:

- `/user`: 200; usuario `643c722dd45d4c2b212bedf7`, cuenta `fede24896@gmail.com`.
- `/sites/19f95382-9b4e-44dc-b1df-21e9856ff58f`: 200; sitio `tatos-backend-test-mun7j93b`, equipo `643c722dd45d4c2b212bedf8`, slug `federicomiguelnunez`; sin deploy publicado.
- `/accounts/643c722dd45d4c2b212bedf8`: 200; equipo `grupo 11`, Free, `saml_enabled=false`.
- `/federicomiguelnunez/members`: 200; usuario actual Owner, `site_access=all`.
- La consulta inicial a `/accounts/<id>/members` devolvió 404; se corrigió la ruta conforme a la especificación instalada. No indica falta de membresía.
- `/oauth/applications`: 200, vacío. Esta ruta no permite clasificar la credencial activa ni enumerar aplicaciones autorizadas.

`getAPIToken()` en la dependencia instalada lee exclusivamente `users.<userId>.auth.token` del archivo global del CLI. No había `NETLIFY_AUTH_TOKEN` ni contexto de Blobs en el proceso. El flujo de login del CLI utiliza un ticket de autorización de aplicación; el archivo no certifica si la credencial actual provino de ese flujo o de una carga manual.

La documentación oficial de [Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/) admite explícitamente un Personal Access Token para el SDK externo con `siteID` y `token`. El SDK instalado solicita la URL firmada con Bearer y el método PUT, conforme a su implementación. La documentación no permite concluir que toda credencial de aplicación sea incompatible, ni demuestra que un PAT resolverá este 401.

El 401 de escritura documentado el 29 de septiembre no se repitió con la misma credencial. Identidad, equipo, membresía y ausencia de SAML están comprobados; la causa interna del rechazo de escritura continúa abierta. No se desplegó ni se escribió en producción, Sheets, Ads o GTM.

Se corrigió `remote-netlify-test.mjs` para respetar primero `NETLIFY_AUTH_TOKEN`; antes lo ignoraba. Una credencial temporal alternativa puede guardarse mediante `scripts/netlify-test-credential.ps1 -Action Save`, con entrada oculta y cifrado DPAPI del usuario de Windows, sin cambiar el login del CLI. Luego `-Action Audit` verifica su identidad y `-Action Test` ejecuta las pruebas remotas ya existentes, manteniendo la guardia que bloquea la continuación ante un fallo de Blobs. Ningún token se guarda en el repositorio ni se imprime.

Acción manual pendiente: proporcionar localmente un PAT temporal de la misma cuenta mediante ese flujo, sin cambiar roles ni habilitar permisos SAML. Es necesario para probar el método expresamente documentado y distinguir un problema de credencial de un rechazo interno del servicio. Las pruebas remotas de escritura siguen pendientes hasta entonces.

## Intento con el archivo DPAPI proporcionado

El archivo existía. Se corrigió la lectura para quitar el salto de línea del texto cifrado antes de `ConvertTo-SecureString`. El descifrado luego funcionó, pero la credencial recuperada contiene caracteres de control y fuera de ASCII. Node devuelve `TypeError`, código `UND_ERR_INVALID_ARG`, al construir la solicitud autenticada; no hubo respuesta HTTP ni escritura con ese PAT. Una consulta sin autenticación obtuvo HTTP 401 y confirmó conectividad con la API. No se imprimió el valor del secreto.

Se agregó validación de formato al guardado antes de reemplazar el archivo. Es necesario volver a guardar el PAT original mediante entrada oculta; no se afirma que un PAT correctamente guardado vaya a resolver el 401 anterior. Las pruebas de Blobs y la comprobación de fila única en Sheets permanecen pendientes; no hubo despliegue ni envíos.

## Revisión del capturador y validador con datos sintéticos

La expresión anterior no fijaba prefijo ni longitud, pero restringía caracteres a letras, números, punto, guion y guion bajo. La documentación consultada de Netlify no especifica ese alfabeto. Se eliminó esa suposición: se verifica únicamente que la entrada no esté vacía y contenga caracteres ASCII imprimibles sin espacios, para transporte HTTP. La autenticidad y vigencia siguen correspondiendo a la API.

En Windows PowerShell 5.1 se comprobó igualdad exacta de SecureString/BSTR y DPAPI en memoria. La acción `SelfTest` pasó cinco casos sintéticos por el campo enmascarado, SecureString y guardado/lectura DPAPI en archivo temporal independiente, incluidos signos previamente rechazados y una cadena de 2048 caracteres. También pasó cinco casos de rechazo por entrada vacía, espacio, salto de línea, escape y Unicode. Solo se imprimió un resumen; no se leyó el archivo del usuario ni hubo solicitudes remotas.

Se reemplazó Read-Host por un campo Windows Forms enmascarado, sin límite de prefijo/longitud del script, para evitar depender del pegado de la terminal. No se reprodujo el pegado interactivo anterior y no se atribuye con certeza a él la corrupción detectada. El guardado ahora verifica igualdad exacta después de releer el archivo cifrado. La comprobación sintética del control no equivale a verificar el portapapeles del usuario.

Único paso de carga: ejecutar `scripts/netlify-test-credential.ps1 -Action Save`, pegar el PAT en el campo enmascarado de la ventana y pulsar Guardar cifrado. No se pasa el secreto como argumento, no se registra en consola ni se modifica el login del CLI.
