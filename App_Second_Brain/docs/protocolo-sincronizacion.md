# Protocolo de sincronización cifrada (borrador, fase 0)

> Estado: **borrador para revisión**. El spike E lo prototipa con pruebas; en la fase 5 lo audita un revisor independiente y queda como ADR. **No inventamos criptografía:** solo primitivas estándar de WebCrypto (AES-256-GCM, HKDF-SHA-256, HMAC-SHA-256, SHA-256 y números aleatorios del sistema), que existen igual en Safari, en Node 24 y en Cloudflare Workers.

## Objetivo y supuestos

- El iPhone (y otros dispositivos de captura) **envía** capturas al Mac a través de un buzón (*relay*) en Cloudflare. El Mac es el único que las descifra.
- **El relay no es confiable para la confidencialidad:** puede leer todo lo que guarda, así que solo guarda blobs cifrados. Sí se espera que esté disponible (si se cae, las capturas esperan en el iPhone).
- El canal de emparejamiento es **físico**: un código QR en la pantalla del Mac, que nunca pasa por el servidor.
- Fuera de alcance de la v1: secreto hacia adelante (*forward secrecy*), varias cuentas, y que el iPhone lea notas (RF-8.5 es una fase posterior).

## Partes y secretos

| Secreto | Quién lo tiene | Para qué |
| --- | --- | --- |
| `k_dev` (32 bytes aleatorios, uno por dispositivo) | Mac (llavero de macOS) e iPhone (WebCrypto, no extraíble) | Raíz de las claves de ese dispositivo |
| `k_enc = HKDF(k_dev, salt=device_id, info="sb/v1/capture")` | Ambos | AES-256-GCM de las capturas |
| `k_ack = HKDF(k_dev, salt=device_id, info="sb/v1/receipt")` | Ambos | HMAC de los recibos de entrega |
| `device_token` (32 bytes aleatorios) | iPhone; el relay guarda solo su SHA-256 | Autenticar subidas al relay. No sirve para descifrar nada |
| `hub_token` (32 bytes aleatorios) | Mac (llavero); el relay guarda solo su SHA-256 como secreto del Worker | Autenticar al Mac para listar, bajar, confirmar y gestionar dispositivos |

Las claves derivadas se importan como `CryptoKey` **no extraíbles**. En el iPhone se guardan en IndexedDB, que admite `CryptoKey` no extraíbles; queda por verificar en el spike C si Safari lo cumple en una PWA instalada. `localStorage` no se usa para claves.

## Emparejamiento (HU-14, RF-8.1)

1. En el Mac eliges "Emparejar dispositivo". El Mac genera `device_id` (16 bytes aleatorios), `k_dev` y `device_token`.
2. El Mac registra el dispositivo en el relay: `POST /v1/devices` (con `hub_token`) envía `{ device_id, token_sha256, name }`. El registro queda **pendiente** y caduca a los 10 minutos si nadie lo activa.
3. El Mac muestra un QR con `sb1:` + base64url de `{ v: 1, relay, device_id, device_token, k_dev }`. El QR desaparece al activarse o a los 2 minutos.
4. **Dentro de la PWA instalada** (hipótesis del spike C: la PWA de la pantalla de inicio no comparte almacenamiento con Safari), el iPhone lee el QR (o pegas el código), deriva y guarda las claves, y llama `POST /v1/devices/activate` con su `device_token`.
5. El Mac ve el dispositivo como **activo**. El código de emparejamiento no se guarda en ningún otro lado.

Variante si el spike C elige el **Atajo de iOS**: un Atajo no tiene una acción nativa para cifrar con AES-GCM, así que ese camino usaría iCloud Drive con Protección avanzada de datos en vez de este relay. Este protocolo aplicaría solo a la PWA.

## Formato de una captura

Texto plano, antes de cifrar:

```
u32 (big-endian) largo del encabezado || encabezado JSON (UTF-8) || cuerpo (bytes del audio o vacío) || relleno
```

- Encabezado: `{ v: 1, type: "voice"|"text"|"link", mime, captured_at, duration_s?, text?, url?, lang_hint?, client }`.
- **Relleno:** se rellena hasta el siguiente múltiplo de 4 KiB (menos de 64 KiB) o de 64 KiB (más). Así el relay no conoce el largo exacto de un texto ni de un audio.

Blob que ve el relay:

```
"SB" || versión (1 byte = 1) || iv (12 bytes aleatorios) || AES-256-GCM(k_enc, iv, texto plano, aad) con su etiqueta de 16 bytes
aad = "sb-capture-v1" || device_id || capture_id
```

- `capture_id`: 16 bytes aleatorios generados en el dispositivo (no un ULID, para no revelarle al relay la hora de la captura).
- El `aad` ata el blob a su dispositivo y a su id: si el relay intercambia ids o dispositivos, descifrar falla.
- Con IV aleatorios de 96 bits, el límite seguro de AES-GCM es del orden de 2³² mensajes por clave, muy lejos del uso real. Re-emparejar renueva la clave.

## API del relay (borrador)

| Método y ruta | Quién | Qué hace |
| --- | --- | --- |
| `POST /v1/devices` | Mac | Registra un dispositivo pendiente (`token_sha256`, nombre) |
| `POST /v1/devices/activate` | Dispositivo | Activa su registro dentro del plazo |
| `DELETE /v1/devices/{device_id}` | Mac | Revoca: borra el hash del token y, si lo pides, sus blobs pendientes |
| `PUT /v1/captures/{capture_id}` | Dispositivo | Sube un blob. **Idempotente:** si ya existe con el mismo SHA-256 responde 200; si es distinto, 409 |
| `GET /v1/captures?cursor=` | Mac | Lista pendientes: `capture_id`, `device_id`, tamaño y fecha de subida |
| `GET /v1/captures/{capture_id}` | Mac | Baja el blob |
| `POST /v1/captures/{capture_id}/ack` | Mac | Confirma con `receipt = HMAC(k_ack, "sb-ack-v1" \|\| capture_id)`. El relay borra el blob y guarda el recibo 30 días |
| `GET /v1/captures/{capture_id}/receipt` | Dispositivo | Lee el recibo; el dispositivo lo verifica con `k_ack` |

Reglas del Worker:

- **Solo HTTPS.** CORS con lista explícita (solo el origen de la PWA), cabeceras de seguridad y validación con Zod de ids, tamaños y tipos.
- **Tamaño máximo por blob**, límite de tasa por dispositivo y caducidad (TTL configurable, 30 días por defecto). Los valores exactos dependen del almacenamiento que elija el spike E.
- **Errores sin detalles internos.** Los registros de Cloudflare guardan método, ruta, código y tamaño; nunca cuerpos.

## Entrega exactamente una vez (RF-8.3, RF-8.4)

1. **iPhone:** guarda la captura cifrada en su cola local (IndexedDB) **antes** de intentar subirla. Reintenta con espera creciente cuando vuelve la red.
2. **Mac:** lista los pendientes, baja y descifra cada blob, y verifica el `aad`. Si el descifrado falla, lo registra (sin contenido) y no lo confirma.
3. **Mac:** si el `capture_id` ya existe en la bóveda, salta al paso 5.
4. **Mac:** escribe el audio y la nota en `inbox/`, de forma atómica y con `fsync`.
5. **Mac:** confirma con el recibo HMAC. Si se corta antes de confirmar, al reintentar cae en el paso 3 y no duplica.
6. **iPhone:** consulta el recibo y lo verifica con `k_ack`. Solo entonces borra su copia local.

Un relay malicioso **no puede inventar un recibo** (no tiene `k_ack`), así que no puede engañar al iPhone para que borre capturas que el Mac nunca recibió. Lo peor que puede hacer es retenerlas o borrarlas, y en ambos casos el iPhone conserva su copia y avisa.

## Revocación y rotación

- **Revocar** (HU-17): el Mac llama `DELETE /v1/devices/{id}` y borra `k_dev` de su llavero. A partir de ahí, cualquier blob de ese dispositivo se rechaza. Si sospechas robo, los pendientes de ese dispositivo se descartan sin abrirlos.
- **Rotar:** en la v1, rotar es **re-emparejar** (nuevo `device_id` y nueva `k_dev`) y revocar el anterior. Es simple y fácil de auditar.

## Qué ve cada parte

| Parte | Ve | No ve |
| --- | --- | --- |
| Relay / Cloudflare | `device_id`, `capture_id` aleatorio, tamaño con relleno, hora de subida, IP | Audio, texto, títulos, tipo de captura, hora de grabación |
| Alguien con el `device_token` robado | Puede subir basura a tu bandeja (hasta que revoques) | No puede leer ni bajar nada |
| Alguien con el iPhone desbloqueado | Las capturas aún no entregadas y la clave del dispositivo | Las notas del Mac (el iPhone no las tiene en la v1) |

## Riesgos conocidos

- **Sin secreto hacia adelante:** si alguien obtiene `k_dev` **y además** blobs viejos del relay, puede descifrarlos. Lo acota que los blobs se borran al confirmarse. Un trinquete de claves queda como mejora futura si la revisión lo pide.
- **La PWA se entrega desde Cloudflare:** quien controle tu cuenta de Cloudflare podría servir una PWA modificada que robe claves. Es el límite clásico del cifrado de extremo a extremo en la web. Se mitiga con 2FA en Cloudflare, despliegues solo desde el CI con código revisado, y un service worker que no se actualiza sin avisarte. El riesgo queda documentado en `amenazas.md`.
- **Dónde guarda las claves el núcleo del Mac:** si el núcleo corre en el Node del sistema, no puede usar `safeStorage` de Electron. Las opciones son la herramienta `security` de macOS para el llavero o que la app le pase las claves por el socket. Se decide en la fase 5.

## Pruebas que debe tener (spike E y fase 5)

- Ida y vuelta: cifrar en el "iPhone" y descifrar en el "Mac" con el mismo `k_dev`.
- Un byte alterado en el blob, un `capture_id` o `device_id` cambiado, o una clave equivocada hacen **fallar** el descifrado.
- Reintentos y cortes: la misma captura subida dos veces produce una sola nota.
- Un recibo falso (mal HMAC) es rechazado por el dispositivo.
- **El relay nunca guarda texto en claro:** la prueba busca en lo almacenado un marcador conocido del texto y no debe encontrarlo.
- Un dispositivo revocado no puede subir, y sus blobs pendientes no se procesan.
