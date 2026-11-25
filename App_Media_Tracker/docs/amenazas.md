# Modelo de amenazas · Media Tracker

Versión STRIDE breve, del 25-11-2026. Se revisa al cerrar cada fase que toque el servidor, la cuenta o Electron, y punto por punto en la fase 7.

## Qué se protege

| Activo | Por qué importa |
| --- | --- |
| Tu biblioteca (elementos, notas, calificaciones, listas, sagas) | Son datos personales. Las notas pueden ser íntimas. |
| Tu cuenta y su sesión | Con ellas se leen y se borran tus datos. |
| Claves de TMDB y RAWG | Si se filtran, alguien puede gastar o perder tu cuota, y te pueden suspender la cuenta de desarrollador. |
| Secretos del Worker (`BETTER_AUTH_SECRET`, `DATABASE_URL`) | Con ellos se falsifican sesiones o se entra a la base. |
| Tus respaldos JSON | Contienen la biblioteca completa. |

## Límites de confianza

1. El dispositivo (PWA o Electron) y el Worker se hablan por HTTPS, con cookie de sesión.
2. El Worker y Neon se hablan por TLS, con `DATABASE_URL`.
3. El Worker y las APIs externas (TMDB, RAWG, Open Library, Wikidata) se hablan por HTTPS. Todo lo que devuelven es texto no confiable.
4. El dispositivo carga las portadas directo desde las CDN.
5. Lo que tú importas (respaldos, archivos de otras apps) también es no confiable.
6. En Electron, el proceso principal y el *renderer* se hablan por IPC.

## Amenazas y mitigaciones

| STRIDE | Amenaza | Mitigación | Fase | Verificación |
| --- | --- | --- | --- | --- |
| S | Alguien adivina la contraseña o reutiliza una filtrada. | Better Auth con scrypt, límite de intentos, registro cerrado (`AUTH_SIGNUP_ENABLED=false`) y contraseña de 12 caracteres o más. | 4 | Prueba de límite de intentos y de registro cerrado. |
| S | Robo de la cookie de sesión. | Cookie `HttpOnly`, `Secure` y `SameSite=Lax`; CSP estricta para frenar XSS; sesión que expira y se puede cerrar desde Ajustes. | 4 | Prueba de cabeceras y E2E de cierre de sesión. |
| T | Un *push* manipulado escribe en los datos de otro usuario. | `user_id` siempre sale de la sesión, nunca del cuerpo; validación Zod; las consultas filtran por `user_id`. | 4 | Pruebas de aislamiento entre dos usuarios sintéticos. |
| T | Un respaldo o un archivo importado malicioso (campos gigantes, prototipos, HTML). | Parseo con Zod y límites de tamaño (archivo de 20 MB, texto de 10.000 caracteres, 50.000 elementos); se descartan `__proto__` y los campos desconocidos; nada se ejecuta ni se trata como HTML; el plan de importación se muestra antes de escribir. | 1 | Pruebas con respaldos hostiles sintéticos. |
| T | Una respuesta de TMDB, RAWG, Open Library o Wikidata trae HTML o script en una sinopsis o un título. | El servidor quita el HTML; React escapa todo; `dangerouslySetInnerHTML` está prohibido por lint; las URLs de portada solo se aceptan de hosts conocidos. | 2 | Prueba con respuestas falsas hostiles y regla de ESLint. |
| R | No se sabe qué dispositivo cambió algo. | Cada fila guarda `updatedAt` y `serverSeq`; el servidor registra el *push* (usuario, número de filas, hora) sin contenido. | 4 | Revisión de los registros. |
| I | Las claves de API se filtran por el frontend o el repo. | Solo existen como secretos del Worker; `.env.example` sin valores; un escáner de secretos en la CI (se propone para aprobación en la fase 1); el *bundle* se revisa con una búsqueda de patrones de clave. | 0, 2 | CI y búsqueda en `dist/`. |
| I | Los registros del Worker exponen consultas o notas. | No se registran cuerpos, consultas de búsqueda ni URLs de destino; solo ruta, estado y duración. | 2 | Revisión del código de registro. |
| I | Las CDN de portadas ven tu IP y qué portadas cargas. | Se acepta (riesgo bajo). Las portadas quedan en la caché del dispositivo 30 días, así que se piden pocas veces. | 2 | Documentado aquí. |
| I | Un respaldo exportado queda en un lugar compartido. | El respaldo no incluye secretos (ya no hay claves en el cliente) y se avisa al exportar. El cifrado del respaldo queda como posible mejora (fase 7). | 1 | Prueba de que el respaldo no tiene campos de secretos. |
| I | Datos reales en el repo (pruebas, fixtures, capturas). | Solo datos sintéticos y obras públicas; capturas con la biblioteca de ejemplo. | Todas | Revisión de cada PR. |
| D | Alguien con tu sesión agota la cuota de TMDB o RAWG con el proxy. | Límite por usuario (60 por minuto, 2.000 por día), caché en KV, tiempo máximo de 8 s y ninguna URL libre. | 2 | Prueba del límite. |
| D | Se agota el plan gratis de Workers, Neon o KV. | El aviso de cambios lo responde el Durable Object, no Neon; KV solo para metadatos; la app funciona sin red. | 2, 4 | Medición de peticiones en un día de uso. |
| E | SSRF a través del proxy de metadatos. | El cliente nunca manda URLs; lista fija de hosts; los IDs se validan con expresiones regulares estrictas; SPARQL de plantilla fija. | 2 | Pruebas con entradas hostiles. |
| E | Inyección SPARQL. | El ID entra validado con una expresión regular (`^OL\d+W$`, `^\d+$`) y nunca se interpola texto libre. | 3 | Pruebas con entradas hostiles. |
| E | Electron: una página o un enlace externo obtiene acceso a Node. | `contextIsolation`, `sandbox`, sin `nodeIntegration`, navegación externa bloqueada, permisos denegados, IPC validado con Zod. | 5 | Lista de seguridad de Electron y pruebas del *preload*. |
| E | Dependencia comprometida (cadena de suministro). | Lockfile, versiones exactas, `pnpm audit` en la CI, scripts de instalación bloqueados salvo los revisados y revisión de cada dependencia nueva antes de añadirla. | 0 | CI. |

## Riesgos aceptados

- Un único usuario, sin roles.
- Sin firma de Apple: hay que confiar en la app una vez desde Ajustes del sistema.
- La PWA en iOS puede perder los datos locales si no se instala en la pantalla de inicio. Por eso la app lo explica, y además los datos están en el servidor.
