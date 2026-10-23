# Spike C · Captura en el iPhone

> Código desechable: vive solo en la rama `spike/iphone-capture` y no se fusiona. El informe irá a `docs/spikes/`.

**Pregunta:** en tu iPhone 17e, ¿qué camino captura voz en 3 toques o menos, aguanta estar sin señal y permite el cifrado de extremo a extremo?

- **(A) PWA** instalada en la pantalla de inicio: graba con `MediaRecorder`, cifra con WebCrypto y sube al relay de Cloudflare. Es lo que elegiste como opción por defecto: escala mejor (sirve en otros dispositivos y permite la búsqueda en el iPhone más adelante).
- **(B) Atajo de iOS** en el botón de acción: graba y guarda en iCloud Drive, protegido por la Protección avanzada de datos de Apple, y el Mac vigila esa carpeta.

## Lo que dice la documentación hoy (23-10-2026)

| Tema | Hallazgo | Confianza |
| --- | --- | --- |
| Botón de acción del iPhone 17e | Existe y se le puede asignar un **Atajo** o **Notas de Voz** ([ficha técnica de Apple](https://www.apple.com/iphone-17e/specs/)) | Alta |
| Formatos de `MediaRecorder` en Safari | `audio/mp4` (AAC) siempre; `audio/webm;codecs=opus` desde Safari/iOS 18.4, según una guía de terceros; Ogg/Opus no funciona | Media: **lo mide la página** |
| Permiso de micrófono en una PWA instalada | Hay reportes de desarrolladores de que iOS **vuelve a pedirlo en cada apertura** (al menos para la cámara; WebKit bug 215884), y no existe un ajuste por app para fijarlo | Baja: **lo mide la página** |
| Almacenamiento de la PWA instalada | Separado del de Safari: al instalarla solo se copian las cookies una vez. Tiene su propio contador de uso para la regla de 7 días de inactividad, y `navigator.storage.persist()` se concede por heurística, más fácil si está instalada ([WebKit: Updates to Storage Policy](https://webkit.org/?p=14403)) | Media: **lo mide la página** |
| Grabar en segundo plano | Una página web no sigue grabando con la pantalla bloqueada o con otra app abierta. Sin documentación oficial explícita | **Lo mide la página** |
| Cifrar en un Atajo | No encontré ninguna acción nativa de cifrado (AES) en Atajos | Media: revísalo buscando "cifrar" en las acciones |
| iCloud Drive con Protección avanzada de datos | iCloud Drive pasa a tener cifrado de extremo a extremo; si pierdes el acceso a tu cuenta, Apple no puede recuperar tus datos ([Apple: iCloud data security overview](https://support.apple.com/102651)) | Alta |

**Consecuencia para el diseño:** un Atajo no puede usar el relay cifrado. Si gana (B), el canal es iCloud Drive con Protección avanzada de datos. Si gana (A), el emparejamiento tiene que hacerse **dentro de la PWA instalada**, porque Safari y la PWA no comparten almacenamiento.

## Prueba (A): la página de prueba en tu iPhone

La página mide lo que no se puede saber leyendo documentación. **No envía nada a ningún servidor:** solo usa IndexedDB del iPhone y, si tú lo pides, el portapapeles. La prueba automática en Chromium lo verifica: graba, cifra, guarda en la cola, mantiene la clave tras recargar y no hace ninguna petición fuera de su propio origen.

### 1 · Publicarla en tu cuenta de Cloudflare (desde el Mac)

```sh
git fetch origin spike/iphone-capture
git worktree add ~/SegundoCerebro-spikes/repo-c origin/spike/iphone-capture
cd ~/SegundoCerebro-spikes/repo-c/App_Second_Brain/spikes/c-captura
corepack enable && pnpm install --frozen-lockfile
pnpm wrangler login      # abre el navegador para autorizar a wrangler en tu cuenta
pnpm run deploy          # publica https://sb-spike-captura.<tu-subdominio>.workers.dev
```

- Es un Worker **solo de archivos estáticos**: sin código de servidor, sin bindings, sin secretos y gratis (plan Free, sin tarjeta).
- `wrangler` 4.151.3 (de Cloudflare, licencias MIT y Apache-2.0) está fijado en `pnpm-lock.yaml`. pnpm bloqueó los scripts de instalación de `esbuild` y `workerd`, y no hacen falta para esto: lo comprobé con `wrangler deploy --dry-run`. Los scripts del `package.json` desactivan las métricas de `wrangler` (`WRANGLER_SEND_METRICS=false`).
- La página queda pública mientras dure la prueba. No tiene datos, pero al terminar se borra con `pnpm run undeploy`.

### 2 · En el iPhone

1. Abre la URL en **Safari** y toca **Grabar** una vez. Anota si aparece el permiso del micrófono.
2. Compartir → **Agregar a pantalla de inicio**. Ábrela desde el ícono "Prueba SC".
3. En la sección Resultados, revisa `context` (debe decir `pantalla-de-inicio`) y `key.fromPreviousVisit`. Si dice `false`, el almacenamiento de Safari y el de la app instalada están separados.
4. **Tres grabaciones** de 10 a 20 segundos (lee cualquier frase). En cada una marca si apareció el aviso del permiso. Los toques desde la pantalla de inicio son: ícono, Grabar y Detener.
5. **Cierra la app del todo** (desliza hacia arriba), ábrela de nuevo y graba. ¿Volvió a pedir el permiso?
6. **Pantalla bloqueada:** graba unos 20 segundos y bloquea la pantalla unos 5 en medio. Desbloquea y detén. La página compara `wallSeconds` (tiempo real) con `mediaSeconds` (lo grabado).
7. **Modo avión:** cierra la app, activa el modo avión y ábrela desde el ícono. ¿Abre? Graba algo: `queue` debe subir.
8. Toca **Pedir almacenamiento persistente**.
9. **Al día siguiente** ábrela otra vez: `key.fromPreviousVisit` debe ser `true` y `queue` debe conservar las grabaciones.
10. Toca **Copiar resultados** y pégamelos en el chat. Solo traen tipos de audio, tamaños, tiempos y si funcionó cada cosa. No traen audio.

## Prueba (B): el Atajo con el botón de acción

1. En la app **Atajos**, crea uno nuevo llamado "Nota SC":
   - **Grabar audio**: calidad Normal, empezar **Inmediatamente** y terminar **Al tocar**.
   - **Guardar archivo**: desactiva "Preguntar dónde guardar" y usa la ruta `/SegundoCerebro/`. Crea antes la carpeta `SegundoCerebro` dentro de iCloud Drive → Atajos, y activa "Sobrescribir si el archivo existe".
2. **Ajustes → Botón de acción → Atajo → "Nota SC"**.
3. Pruébalo tres veces: presiona el botón, habla y toca para detener. Anota los toques y si pide algún permiso.
4. En el Mac, abre en Finder **iCloud Drive → Atajos → SegundoCerebro**. Anota cuánto tarda en aparecer cada audio, su formato y su tamaño.
5. **Modo avión:** graba con el botón, espera un minuto y quita el modo avión. ¿Llegó al Mac?
6. **Pantalla bloqueada:** ¿se puede grabar desde la pantalla bloqueada con el botón de acción?
7. En **Ajustes → [tu nombre] → iCloud → Protección avanzada de datos**, dime solo si está activada. No hace falta activarla para esta prueba.
8. En Atajos, busca "cifrar" o "encrypt" en la lista de acciones y dime si aparece algo.

## Cómo decidiremos

| Criterio | Meta | (A) PWA | (B) Atajo |
| --- | --- | --- | --- |
| Toques desde la pantalla de inicio | 3 o menos | Ícono + Grabar + Detener = 3, si no pide permiso cada vez | Botón + tocar para detener = 2 |
| Sin señal | No se pierde nada | Cola en IndexedDB (a medir) | iCloud Drive encola (a medir) |
| Cifrado de extremo a extremo | Obligatorio | Nuestro protocolo (spike E) | Protección avanzada de datos de Apple |
| Escala a otros dispositivos y a búsqueda en el iPhone | Preferido | Sí | No, solo Apple |
| Trabajo de desarrollo | — | Más (PWA, emparejamiento, relay) | Muy poco |

Si el permiso del micrófono se pide en cada apertura, (A) quedaría en 4 toques y fallaría la meta. En ese caso propondría (B) para la voz y (A) para texto y enlaces, o ajustar la meta: lo conversamos con los datos en la mano.

## Prueba automática (en el contenedor, sin iPhone)

```sh
CHROMIUM_PATH=/ruta/a/chromium pnpm test   # sin CHROMIUM_PATH usa el Chromium de Playwright
```

Usa un micrófono falso de Chromium. Prueba la lógica de la página, no el comportamiento de Safari.
