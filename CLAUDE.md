# Instrucciones del proyecto

## Memoria (MemPalace)

- Antes de responder sobre trabajo pasado, decisiones o personas, busca en el palacio (skill `mempalace-recall`).
- **Acotar la busqueda:** el room `technical` contiene transcripciones de sesiones (salidas de comandos, docs de terceros) y mete ruido. Para decisiones, politicas o documentacion usa `--room general` (o el room del proyecto, ej. `app_media_tracker`) y `docs/decisiones.md`; busca en `technical` solo cuando se pregunte por lo que paso en una sesion concreta. Con la herramienta MCP, pasa el parametro de room/wing equivalente.
- **Decisiones:** cuando se tome una decision de diseno, arquitectura o flujo (algo que el codigo no explica), anade una linea a `docs/decisiones.md` con el formato `- AAAA-MM-DD | decision | por que`. No registres tareas rutinarias ni secretos (claves de API).
- **Cierre de sesion:** cuando la usuaria pida un resumen antes de cerrar, escribelo con `mempalace_diary_write` (que se hizo, que queda pendiente, por que) y confirma que quedo guardado.
- Flujo de Git: ver `CONTRIBUTING.md`.
