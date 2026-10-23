# Registro de decisiones

Una linea por decision: `AAAA-MM-DD | decision | por que`. Se indexa en MemPalace al minar.

- 2026-10-15 | Una rama por cambio con PR a `develop`; `main` solo al terminar una app completa | Evitar commits directos en `develop` y mantener `main` estable (ver CONTRIBUTING.md)
- 2026-10-15 | MemPalace como palacio local privado, indexando este repo | Poder buscar decisiones y contexto pasado entre sesiones
- 2026-10-23 | Cada app tiene una rama de integracion `app/<App>`; las ramas por cambio (`feature/`, `fix/`, `chore/`) salen de ella y se fusionan ahi por PR; luego `app/<App>` -> `develop` para probar, y a `main` solo con la app completa | Probar en `develop` un conjunto de cambios ya integrado en vez de cada rama suelta, y mantener `main` estable (reemplaza la linea del 2026-10-15 sobre PRs directos a `develop`; ver CONTRIBUTING.md)
- 2026-10-23 | El formato del respaldo JSON tiene version propia (`BACKUP_SCHEMA_VERSION`), migraciones por version y un respaldo real congelado por version en `tests/fixtures/backups/` | Que todo respaldo exportado se pueda importar en cualquier version futura; los tests fallan si se rompe esa compatibilidad
