# 0007 · Fechas, zona horaria y día lógico

- **Estado:** Aceptada (23-10-2026, PR #18)
- **Fecha:** 23-10-2026

## Contexto

Las rachas y las cuotas dependen de "qué día es" y de "qué semana es". `America/Santiago` tiene horario de verano, así que hay días de 23 y de 25 horas. Además, un hábito "antes de dormir" marcado a las 0:40 debería contar para el día anterior (respuesta 9 de la fase 0). Tú ves las fechas en formato DD-MM-AAAA.

## Decisión

- **Instantes** (cuándo pasó algo: `created_at`, `updated_at`, inicio y fin de una sesión de gym): `timestamptz` en Postgres e ISO 8601 en UTC dentro de la app.
- **Días** (a qué día pertenece un check-in, una medida o una sesión de gym): la columna `local_date`, de tipo `date` en Postgres y texto `AAAA-MM-DD` en el cliente. Ese formato interno se usa porque ordena bien como texto; el formato DD-MM-AAAA solo se usa para mostrar. Se calcula **una vez, al registrar**, y no se recalcula:
  - Zona horaria: `user_settings.time_zone`, por defecto `America/Santiago`.
  - Hora de corte del día: `user_settings.day_cutoff_hour`, por defecto 4. Antes de las 04:00 todavía es "ayer".
- **Semana:** de lunes a domingo, identificada por la fecha de su lunes (`week_start`).
- Toda la aritmética de rachas y semanas trabaja con **fechas de calendario**, no con milisegundos. Así el cambio de horario no cambia el resultado.
- Las fechas se calculan con `Intl.DateTimeFormat` y su opción `timeZone`, sin librerías de fechas. Si en la fase 1 hiciera falta una, se revisa antes de agregarla.

## Formato visible

| Dónde | Formato |
| --- | --- |
| Interfaz | DD-MM-AAAA (por ejemplo, 23-10-2026). Los días van con nombre corto en español de Chile: "vie 23-10" |
| Exportación CSV | DD-MM-AAAA, para abrir directo en Numbers o Excel |
| Exportación JSON | `AAAA-MM-DD` e ISO 8601, para que la importación no tenga ambigüedad |
| Documentación para ti | DD-MM-AAAA |
| `docs/decisiones.md` (raíz del repo) | `AAAA-MM-DD`, como fija el `CLAUDE.md` de la raíz |

## Alternativas

- **Guardar solo `timestamptz` y calcular el día al leer.** Si cambias la zona horaria o la hora de corte, el historial pasado se movería de día. Descartado.
- **Medianoche estricta.** Descartada en la fase 0.
- **La API `Temporal`.** Sería ideal, pero su soporte en Safari de iOS se verifica en la fase 1 antes de depender de ella.

## Consecuencias

- Hay tests unitarios con casos borde:
  - los dos cambios de horario de Santiago;
  - marcar justo antes y justo después de las 04:00;
  - una semana que cruza de mes o de año;
  - un hábito creado a mitad de semana.
- Si un día viajas a otra zona horaria, los registros siguen la zona de `user_settings`, no la del teléfono. Cambiarla es explícito.
