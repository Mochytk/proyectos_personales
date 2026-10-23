# Registro de decisiones

Una linea por decision: `AAAA-MM-DD | decision | por que`. Se indexa en MemPalace al minar.

- 2026-10-15 | Una rama por cambio con PR a `develop`; `main` solo al terminar una app completa | Evitar commits directos en `develop` y mantener `main` estable (ver CONTRIBUTING.md)
- 2026-10-15 | MemPalace como palacio local privado, indexando este repo | Poder buscar decisiones y contexto pasado entre sesiones
- 2026-10-23 | Segundo cerebro en `App_Second_Brain/`: monorepo pnpm, Node 24 y TypeScript 6.0, con rama base `app/second_brain` y una PR por rama | Mismas herramientas y flujo que el habit tracker, en el repo público (respuestas 1, 2 y 4 de su fase 0)
- 2026-10-23 | Segundo cerebro: el código de los spikes vive solo en ramas `spike/*`; los informes llegan por PR de documentación | Que el código desechable no se mezcle con el producto (respuesta 3 de su fase 0)
- 2026-10-23 | Segundo cerebro: pnpm con `minimumReleaseAge: 1440` | No instalar versiones publicadas hace menos de un día, que es cuando suelen detectarse los paquetes comprometidos
