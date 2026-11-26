# Decisiones de arquitectura (ADR)

Cada decisión importante va en un archivo corto con cuatro partes: contexto, decisión, alternativas y consecuencias. Un ADR **Propuesto** pasa a **Aceptado** cuando se fusiona la PR que lo trae. Si una decisión cambia, se escribe un ADR nuevo que reemplaza al anterior. Los ADR antiguos no se editan, salvo para marcarlos como reemplazados o para cerrar un punto pendiente en una sección "Actualización" con fecha.

Las fechas van en formato DD-MM-AAAA. Cada ADR lista las fuentes que se consultaron y en qué fecha.

Esta reescritura usa el stack y el método de Constancia (`App_Habit_Tracker/docs/decisions/`, en la rama `app/habit_tracker`). Cuando un ADR de Media Tracker dice "igual que Constancia", el ADR de Constancia que cita vale para esta app, con las diferencias que se anotan ahí.

| N.º | Título | Estado |
| --- | --- | --- |
| [0001](0001-reescritura-y-estructura.md) | Reescritura, estructura del repositorio y herramientas base | Propuesto |
| [0002](0002-cliente-y-estado-local.md) | Cliente web y estado local | Propuesto |
| [0003](0003-servidor-base-de-datos-y-cuenta.md) | Servidor, base de datos y cuenta | Propuesto |
| [0004](0004-sincronizacion.md) | Sincronización offline-first | Propuesto |
| [0005](0005-metadatos-a-traves-del-servidor.md) | Metadatos a través del servidor | Propuesto |
| [0006](0006-modelo-de-datos-y-migracion.md) | Modelo de datos e importación de la app actual | Propuesto |
| [0007](0007-sagas-jerarquicas.md) | Sagas jerárquicas para todos los tipos | Propuesto |
| [0008](0008-duplicados.md) | Duplicados: aviso, lista y fusión asistida | Propuesto |
| [0009](0009-app-de-escritorio.md) | App de escritorio para Mac | Propuesto |
| [0010](0010-identidad-visual.md) | Identidad visual: nombre «Al día» y tres estilos | Propuesto |
