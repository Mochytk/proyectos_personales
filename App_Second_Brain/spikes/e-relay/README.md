# Spike E · Buzón cifrado en Cloudflare

> Código desechable: vive solo en la rama `spike/encrypted-relay` y no se fusiona. El protocolo está en `docs/protocolo-sincronizacion.md` (PR de la fase 0); el informe irá a `docs/spikes/`.

**Preguntas:**

1. ¿Qué almacenamiento gratuito de Cloudflare sirve como buzón de audios cifrados, y cuál pide tarjeta?
2. ¿El protocolo del borrador funciona de punta a punta solo con WebCrypto, y resiste lo que dice resistir?

## 1 · Límites gratuitos (documentación oficial, leída el 23-10-2026)

| Servicio | Lo que importa para el buzón | ¿Pide tarjeta? |
| --- | --- | --- |
| **Workers (Free)** | 100.000 peticiones al día; **10 ms de CPU por petición**; cuerpo de hasta 100 MB; 128 MB de memoria. Si se pasa del límite diario: error 1027 | No |
| **KV (Free)** | Valores de hasta **25 MiB**; 100.000 lecturas, **1.000 escrituras, 1.000 borrados y 1.000 listados al día**; 1 GB en total; caducidad (`expirationTtl`) de 60 s como mínimo; **consistencia eventual** (un cambio puede tardar 60 s o más en verse en otra ubicación); 1 escritura por segundo a la misma clave | No |
| **D1 (Free)** | Máximo **2 MB por fila o BLOB**; 5 millones de filas leídas y 100.000 escritas al día; 500 MB por base, 5 GB por cuenta | No |
| **Durable Objects (Free)** | Solo con almacenamiento SQLite; 100.000 peticiones y 13.000 GB-s al día; 5 GB; máximo **2 MB por fila**; consistencia fuerte | No |
| **R2** | 10 GB al mes, 1 millón de operaciones clase A y 10 millones clase B | **Sí**: "You need a Cloudflare account with an R2 subscription". Hay que pasar por un checkout antes de crear un bucket. **Descartado** por tu regla de no usar tarjeta |

Fuentes: https://developers.cloudflare.com/workers/platform/limits/, https://developers.cloudflare.com/kv/platform/limits/, https://developers.cloudflare.com/kv/platform/pricing/, https://developers.cloudflare.com/kv/concepts/how-kv-works/, https://developers.cloudflare.com/kv/api/write-key-value-pairs/, https://developers.cloudflare.com/d1/platform/limits/, https://developers.cloudflare.com/d1/platform/pricing/, https://developers.cloudflare.com/durable-objects/platform/limits/, https://developers.cloudflare.com/durable-objects/platform/pricing/, https://developers.cloudflare.com/r2/pricing/ y https://developers.cloudflare.com/r2/get-started/.

### Cuánto gasta una captura en KV

- **Subir:** 1 escritura. **Confirmar:** 1 escritura (el recibo) y 1 borrado. **El Mac revisando:** 1 listado por ronda.
- Con 1.000 escrituras al día alcanza para unas **500 capturas diarias**, muy por encima de tu uso.
- **Los listados son el límite real:** revisar cada minuto serían 1.440 al día y se pasaría de los 1.000. Hay que revisar **cada 2 a 5 minutos** (entre 288 y 720 listados), más un botón "Sincronizar ahora". Con eso, la meta de "menos de 3 minutos de la captura a consultable" sigue siendo alcanzable mientras la app esté abierta.
- Un audio de 1 minuto pesa alrededor de 1 MB (estimación; el spike C mide los reales). Con 25 MiB por valor caben notas de unos 20 minutos sin trocear.

### Recomendación: KV para la v1, con Durable Objects como plan B

- **KV** es lo más simple: un audio entero en un solo valor, caducidad nativa, sin tarjeta. La consistencia eventual solo atrasa algunos segundos; el Mac reintenta en la siguiente ronda.
- **Durable Objects** solo si la consistencia eventual o los límites diarios de KV molestan en la práctica. Dan transacciones y límites de tasa exactos, pero obligan a trocear audios de más de 2 MB y suman código.
- **D1** no aporta sobre Durable Objects para este caso.

### Riesgos que encontró el spike

- **10 ms de CPU por petición (Workers Free).** El prototipo calcula el SHA-256 del blob en el relay para la idempotencia. Con audios de varios MB eso puede pasarse del límite. **Mitigación:** que el dispositivo mande el hash en una cabecera y el relay compare tamaño y hash sin recalcularlo. Un dispositivo que mienta solo se perjudica a sí mismo. **Hay que medirlo** en un `preview` real (fase 5).
- **Límite de tasa:** contar subidas por dispositivo en KV gastaría escrituras. El binding de *rate limiting* de Workers es aproximado y por ubicación, y la documentación no dice si está en el plan gratis. **A verificar** en la fase 5. Mientras tanto, las peticiones sin token se rechazan antes de tocar KV, así que no gastan escrituras, aunque sí cuentan para las 100.000 peticiones diarias.
- **Inundación de peticiones:** alguien que conozca la URL puede agotar las 100.000 peticiones del día. Lo peor que pasa es que ese día no se sube nada: el iPhone conserva su cola y reintenta. Se evaluará una regla de WAF en la fase 6.

## 2 · Prototipo del protocolo (Node 24, solo WebCrypto, sin dependencias de producción)

| Archivo | Qué hace |
| --- | --- |
| `src/pairing.ts` | Material de emparejamiento, código `sb1:` para el QR y derivación HKDF de `k_enc` (AES-256-GCM) y `k_ack` (HMAC), **no extraíbles** |
| `src/capture.ts` | Sobre `"SB" ‖ versión ‖ iv ‖ AES-GCM`, con `aad = device_id ‖ capture_id` y relleno a 4 KiB o 64 KiB |
| `src/receipt.ts` | Recibos HMAC de entrega |
| `src/relay.ts` | El relay como manejador `fetch` estilo Worker sobre una interfaz tipo KV. Solo guarda blobs y hashes de tokens |
| `src/device.ts`, `src/hub.ts` | El iPhone (cola local, subida, recibos) y el Mac (descarga, descifrado, escritura, confirmación) |

### Qué prueban los 23 tests

- El código de emparejamiento va y vuelve; uno mal formado se rechaza; las claves derivadas no se pueden exportar.
- Un byte alterado, un `capture_id` o `device_id` cambiado, o la clave de otro dispositivo hacen fallar el descifrado.
- El relleno iguala los tamaños de un texto de 2 caracteres y uno de 3.000, y agrupa los audios por tramos de 64 KiB.
- Un recibo solo vale para su captura y su clave.
- **Relay:** solo el Mac registra dispositivos; un registro sin activar caduca a los 10 minutos; subir exige un dispositivo activo y su token; subir dos veces es idempotente y con otro contenido da conflicto; los blobs demasiado grandes y los ids mal formados se rechazan **sin escribir nada**; confirmar borra el blob y deja el recibo; un dispositivo revocado no puede subir; los errores no muestran detalles internos.
- **De punta a punta:** tres capturas hechas sin red llegan una vez cada una; un corte entre escribir la nota y confirmar no la duplica; **el relay nunca guarda el texto en claro** (se busca un marcador en todo lo almacenado); **un relay hostil que inventa un recibo no logra que el iPhone borre su copia**; tras revocar, el Mac ignora las capturas de ese dispositivo.

Además encontró un detalle real: **`crypto.getRandomValues` entrega como máximo 65.536 bytes por llamada** (también en Safari), así que generar datos aleatorios grandes se hace por trozos.

### Correrlo

```sh
git fetch origin spike/encrypted-relay
git worktree add ~/SegundoCerebro-spikes/repo-e origin/spike/encrypted-relay
cd ~/SegundoCerebro-spikes/repo-e/App_Second_Brain/spikes/e-relay
corepack enable && pnpm install --frozen-lockfile
pnpm test && pnpm typecheck
```

No necesitas correrlo en tu Mac: no depende del hardware. Está por si quieres verlo.

## Qué queda para la fase 5

- Desplegarlo como Worker real en un entorno `preview`, contra KV de verdad, y medir CPU, consistencia y latencia.
- Las mismas pruebas de cifrado **dentro de Safari** en el iPhone (spike C): `CryptoKey` no extraíbles en IndexedDB y el límite de `getRandomValues`.
- Revisión independiente del protocolo antes de usarlo con datos reales.
