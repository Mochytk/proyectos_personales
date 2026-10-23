# Fase 1 · Núcleo local de hábitos: plan de implementación

> **Para agentes:** usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para marcar el avance.

**Objetivo:** una app web que funciona 100 % en local (IndexedDB), con hábitos diarios y de cuota semanal, anclas, pantalla "Hoy", marcar y desmarcar, saltar con motivo, pausar el día, rachas, progreso semanal, historial de 90 días, archivo y revisión del domingo.

**Arquitectura:** la lógica pura (fechas, reglas de hábitos, esquemas) vive en `packages/shared` y se escribe con TDD. La app `apps/web` lee y escribe solo en Dexie: cada escritura marca la fila en la *outbox*, que la fase 2 va a sincronizar. Las pantallas leen con `useLiveQuery`.

**Stack:** TypeScript 6.0 estricto, React 19, Vite 8, Dexie 4, Zod 4, Vitest 5, Playwright. Más las dependencias de la tabla "Dependencias nuevas" de [`README.md`](README.md), que se aprueban antes de agregarlas.

**Especificación:**

- Documento maestro: secciones 3 (HU-1 a HU-6) y 4 (RF-1).
- [`../modelo-de-datos.md`](../modelo-de-datos.md).
- [ADR 0002](../decisions/0002-cliente-y-estado-local.md), [ADR 0006](../decisions/0006-sincronizacion.md) y [ADR 0007](../decisions/0007-fechas-y-zona-horaria.md).

**Depende de:** la PR `chore/monorepo-setup` fusionada y la dirección visual elegida (solo para las tareas 9 en adelante).

## Restricciones globales

- TypeScript estricto. Nombres de código y comentarios en inglés. Textos de interfaz en español de Chile, cortos, sin tono de coach.
- Fechas en pantalla: `DD-MM-AAAA`. Internamente, `LocalDate` en `AAAA-MM-DD`.
- Zona por defecto: `America/Santiago`. Hora de corte por defecto: 4. Semana de lunes a domingo.
- Áreas táctiles de 44 px o más. Respetar `prefers-reduced-motion` y `prefers-color-scheme`.
- Ninguna dependencia nueva sin aprobación. Sin `console.log` sobrantes.
- Un commit por cambio lógico (Conventional Commits, en inglés), con `git push` después de cada uno. Una PR por rama, hacia `app/habit_tracker`.
- Paquetes: `@habit-tracker/shared` y `@habit-tracker/web`.

## Foco de revisión

Las cinco situaciones que la especificación no prueba y que más probablemente te afecten:

1. **Doble toque accidental en un hábito.** Debe quedar marcado una sola vez, no marcarse y desmarcarse (tarea 16).
2. **App abierta a través de las 04:00.** "Hoy" debe pasar al día nuevo sin recargar (tarea 13).
3. **Reloj o zona horaria del proceso distinta a la configurada** (el CI corre en UTC; tu Mac, en Santiago). Las fechas no pueden depender de la zona del sistema (tarea 1).
4. **IndexedDB no disponible o borrada** (navegación privada, iOS que borró los datos). Debe verse un mensaje claro, no una pantalla en blanco ni un spinner infinito (tarea 11).
5. **Cambiar los días de un hábito con historial.** La racha se recalcula con los días nuevos; la app debe avisarlo antes de guardar (tarea 14).

---

## PR 1.1 · `feat/shared-dates`

### Tarea 1: fecha local con hora de corte

**Archivos:**
- Crear `packages/shared/src/dates/local-date.ts` y `packages/shared/src/dates/local-date.test.ts`.
- Modificar `packages/shared/src/index.ts` (exportar).

**Interfaces:**
- Produce `type LocalDate = string & { readonly __brand: 'LocalDate' }`.
- Produce `parseLocalDate(value: string): LocalDate`. Lanza `RangeError` si no es una fecha `AAAA-MM-DD` válida.
- Produce `toLocalDate(instant: Date, timeZone: string, cutoffHour: number): LocalDate`.

- [ ] **Paso 1: escribir los tests que fallan.**

```ts
const TZ = 'America/Santiago';
it.each([
  ['2026-10-23T15:00:00Z', '2026-10-23'], // 12:00 local
  ['2026-10-24T06:30:00Z', '2026-10-23'], // 03:30 local, antes del corte
  ['2026-10-24T07:30:00Z', '2026-10-24'], // 04:30 local
  ['2026-04-05T07:30:00Z', '2026-04-04'], // 03:30, ya en UTC-4 (fin del horario de verano)
  ['2026-04-05T08:30:00Z', '2026-04-05'], // 04:30, UTC-4
  ['2026-09-06T06:30:00Z', '2026-09-05'], // 03:30, ya en UTC-3 (inicio del horario de verano)
  ['2026-09-06T07:30:00Z', '2026-09-06'], // 04:30, UTC-3
  ['2027-01-01T06:59:00Z', '2026-12-31'], // 03:59 del 1 de enero
  ['2027-01-01T07:01:00Z', '2027-01-01'], // 04:01
])('toLocalDate(%s) is %s with cutoff 4', (iso, expected) => {
  expect(toLocalDate(new Date(iso), TZ, 4)).toBe(expected);
});
it('uses midnight when cutoff is 0', () => {
  expect(toLocalDate(new Date('2026-10-24T03:30:00Z'), TZ, 0)).toBe('2026-10-24');
});
it('rejects a cutoff outside 0-6', () => {
  expect(() => toLocalDate(new Date(), TZ, 7)).toThrow(RangeError);
});
it('parseLocalDate rejects impossible dates', () => {
  expect(() => parseLocalDate('2026-02-30')).toThrow(RangeError);
});
```

- [ ] **Paso 2: correr y ver que fallan.** `pnpm --filter @habit-tracker/shared test local-date` debe fallar con "toLocalDate is not defined" o similar.
- [ ] **Paso 3: implementar.** Con `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day, hour, hourCycle: 'h23' }).formatToParts`. Si la hora local es menor que `cutoffHour`, se resta un día **de calendario** (con `addDays` de la tarea 2, que puede implementarse en este mismo paso), no 24 horas.
- [ ] **Paso 4: correr los tests en dos zonas.** `pnpm --filter @habit-tracker/shared test local-date` y `TZ=Asia/Tokyo pnpm --filter @habit-tracker/shared test local-date`. Los dos deben pasar (foco de revisión 3). Agregar el segundo comando al script `test:tz` del paquete y al CI.
- [ ] **Paso 5: commit.** `feat(shared): compute local dates with a day cutoff`.

### Tarea 2: aritmética de calendario y semanas

**Archivos:**
- Crear `packages/shared/src/dates/calendar.ts` y `calendar.test.ts`.

**Interfaces:**
- Produce `addDays(date: LocalDate, days: number): LocalDate`.
- Produce `diffDays(from: LocalDate, to: LocalDate): number`.
- Produce `type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7` e `isoWeekday(date: LocalDate): IsoWeekday`.
- Produce `weekStart(date: LocalDate): LocalDate` (el lunes).

- [ ] **Paso 1: tests.**

```ts
expect(addDays(d('2026-10-31'), 1)).toBe('2026-11-01');
expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
expect(addDays(d('2028-03-01'), -1)).toBe('2028-02-29');
expect(diffDays(d('2026-10-19'), d('2026-10-26'))).toBe(7);
expect(isoWeekday(d('2026-10-23'))).toBe(5); // viernes
expect(isoWeekday(d('2026-10-25'))).toBe(7); // domingo
expect(weekStart(d('2026-10-23'))).toBe('2026-10-19');
expect(weekStart(d('2026-10-19'))).toBe('2026-10-19');
expect(weekStart(d('2026-10-25'))).toBe('2026-10-19');
expect(weekStart(d('2027-01-01'))).toBe('2026-12-28');
```

(`d` = `parseLocalDate`.)

- [ ] **Paso 2: ver que fallan.**
- [ ] **Paso 3: implementar** con `Date.UTC` sobre año, mes y día (UTC no tiene horario de verano).
- [ ] **Paso 4: ver que pasan** (también con `test:tz`).
- [ ] **Paso 5: commit.** `feat(shared): add calendar arithmetic and ISO weeks`.

### Tarea 3: formato visible

**Archivos:** crear `packages/shared/src/dates/format.ts` y `format.test.ts`.

**Interfaces:**
- Produce `formatDisplayDate(date: LocalDate): string`, por ejemplo `'23-10-2026'`.
- Produce `formatShortDay(date: LocalDate): string`, por ejemplo `'vie 23-10'`.

- [ ] **Paso 1: tests.** `formatDisplayDate(d('2026-10-23')) === '23-10-2026'`, `formatShortDay(d('2026-10-23')) === 'vie 23-10'` y `formatShortDay(d('2026-10-25')) === 'dom 25-10'`.
- [ ] **Paso 2: ver que fallan.**
- [ ] **Paso 3: implementar** con un arreglo fijo `['lun','mar','mié','jue','vie','sáb','dom']`. No usar `Intl` aquí: su salida en `es-CL` (por ejemplo `vie.`) puede variar entre motores.
- [ ] **Paso 4: ver que pasan.**
- [ ] **Paso 5: commit.** `feat(shared): format dates as DD-MM-AAAA`.

### Tarea 4: IDs deterministas (UUID v5)

**Archivos:** crear `packages/shared/src/ids.ts` e `ids.test.ts`.

**Interfaces:**
- Produce `APP_ID_NAMESPACE = '5365024d-226c-481c-8826-894bea6cb2b7'`.
- Produce `uuidV5(name: string, namespace: string): Promise<string>`.
- Produce `checkInId(habitId: string, date: LocalDate): Promise<string>`, con el nombre `check_in:{habitId}:{date}`.
- Produce `quotaOverrideId(habitId: string, weekStart: LocalDate): Promise<string>`, con `quota:{habitId}:{weekStart}`.
- Produce `weeklyReviewId(weekStart: LocalDate): Promise<string>`, con `review:{weekStart}`.
- Produce `seedId(kind: 'anchor' | 'exercise' | 'routine' | 'metric_type' | 'user_settings', slug: string): Promise<string>`, con `{kind}:{slug}`.

- [ ] **Paso 1: tests.**
  - Vector conocido: `uuidV5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')` resuelve a `'886313e1-3b8a-5372-9b90-0c9aee199e5d'`.
  - `checkInId('h1', d('2026-10-23'))` es igual en dos llamadas y distinto del de `'2026-10-24'`.
  - El carácter 14 del resultado es `'5'`.
- [ ] **Paso 2: ver que fallan.**
- [ ] **Paso 3: implementar** con `crypto.subtle.digest('SHA-1', ...)`, disponible en Node 24, en los navegadores y en Workers (RFC 9562, sección 5.5). Es asíncrono, así que en Dexie los IDs se calculan **antes** de abrir la transacción.
- [ ] **Paso 4: ver que pasan.**
- [ ] **Paso 5: commit.** `feat(shared): add deterministic UUID v5 ids`.

## PR 1.2 · `feat/shared-habit-rules`

### Tarea 5: esquemas Zod de hábitos

**Archivos:**
- Crear `packages/shared/src/schemas/sync-columns.ts`, `habits.ts` y `habits.test.ts`.

**Interfaces:**
- Produce `syncColumns`: `id` (uuid), `createdAt` y `updatedAt` (ISO datetime), y `deletedAt` (ISO datetime o null).
- Produce los esquemas y sus tipos (`z.infer`) `userSettingsSchema`, `anchorSchema`, `habitSchema`, `checkInSchema`, `weeklyQuotaOverrideSchema` y `weeklyReviewSchema`. Los campos son los de `modelo-de-datos.md`, en camelCase, y las fechas `LocalDate` se validan con `parseLocalDate`.
- Produce `type CheckInStatus = 'done' | 'skipped'` y `type SkipReason = 'certamen' | 'enfermedad' | 'viaje' | 'descanso' | 'otro'`.

- [ ] **Paso 1: tests.**
  - Un hábito diario válido se valida.
  - `mode: 'weekly_quota'` exige `weeklyQuota` entre 1 y 7: rechaza 0, 8 y `null`.
  - `mode: 'daily'` rechaza un `weeklyQuota` que no sea `null`.
  - `weekdays` no vacío, sin repetidos, con valores de 1 a 7.
  - `name` se recorta y debe tener entre 1 y 60 caracteres.
  - Un check-in con `skipReason` y `status: 'done'` se rechaza.
  - `note` de más de 280 caracteres se rechaza.
  - `dayCutoffHour` va de 0 a 6.
- [ ] **Paso 2: ver que fallan.**
- [ ] **Paso 3: implementar** con `z.object(...).superRefine(...)` para las reglas entre campos.
- [ ] **Paso 4: ver que pasan.**
- [ ] **Paso 5: commit.** `feat(shared): add habit schemas`.

### Tarea 6: qué hábitos tocan un día

**Archivos:** crear `packages/shared/src/habits/schedule.ts` y `schedule.test.ts`.

**Interfaces:**
- Produce `isScheduledOn(habit: Pick<Habit, 'mode' | 'weekdays' | 'startsOn'>, date: LocalDate): boolean`.
- Produce `habitsForDay(habits: Habit[], anchors: Anchor[], date: LocalDate): Array<{ anchor: Anchor; habits: Habit[] }>`.

- [ ] **Paso 1: tests.**
  - Un hábito de lunes a viernes no aplica el sábado.
  - Un hábito de cuota semanal aplica todos los días.
  - Nada aplica antes de `startsOn`.
  - `habitsForDay` excluye archivados y borrados, ordena por `anchor.sortOrder` y luego `habit.sortOrder`, y omite las anclas sin hábitos.
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: commit.** `feat(shared): decide which habits apply on a day`.

### Tarea 7: racha diaria

**Archivos:** crear `packages/shared/src/habits/streak.ts` y `streak.test.ts`.

**Interfaces:**
- Produce `dailyStreak(args: { habit: Pick<Habit, 'mode' | 'weekdays' | 'startsOn'>; today: LocalDate; checkIns: ReadonlyMap<LocalDate, CheckInStatus> }): number`.

- [ ] **Paso 1: tests.** Hábito de todos los días, `startsOn = 2026-10-01`, `today = 2026-10-23`.

| Check-ins | Racha esperada |
| --- | --- |
| ninguno | 0 |
| done 20, 21, 22 | 3 (hoy sin registro no corta) |
| done 20, 21, 22, 23 | 4 |
| done 20, skipped 21, done 22 | 2 |
| done 20, (21 sin registro), done 22 | 1 |
| skipped 23, done 22 | 1 |
| solo skipped 20, 21, 22 | 0 |
| lunes a viernes: done vie 16, lun 19 a jue 22 (hoy vie 23 sin registro) | 5 |
| `startsOn = 2026-10-21`, done 21, 22 | 2 |

- [ ] **Paso 2: ver que fallan.**
- [ ] **Paso 3: implementar.** Recorrer hacia atrás desde hoy hasta `startsOn`, saltando los días no programados:
  - `done` suma.
  - `skipped` sigue sin sumar.
  - Sin registro en un día pasado, corta.
  - Hoy sin registro no corta.
- [ ] **Paso 4: ver que pasan.**
- [ ] **Paso 5: commit.** `feat(shared): compute daily streaks with skips`.

### Tarea 8: cuota efectiva, progreso y racha semanal

**Archivos:** crear `packages/shared/src/habits/weekly.ts` y `weekly.test.ts`.

**Interfaces:**
- Produce `effectiveQuota(habit: Pick<Habit, 'weeklyQuota'>, weekStart: LocalDate, overrides: ReadonlyMap<LocalDate, number>): number`.
- Produce `weeklyProgress(args: { habit: Pick<Habit, 'weeklyQuota'>; weekStart: LocalDate; checkIns: ReadonlyMap<LocalDate, CheckInStatus>; overrides: ReadonlyMap<LocalDate, number> }): { done: number; quota: number; met: boolean }`.
- Produce `weeklyStreak(args: { habit: Pick<Habit, 'weeklyQuota' | 'startsOn'>; currentWeekStart: LocalDate; checkIns; overrides }): number`.

- [ ] **Paso 1: tests.**
  - Cuota 3, done lunes y miércoles: `{ done: 2, quota: 3, met: false }`.
  - Con override 2: `met: true`.
  - `skipped` no cuenta como `done`.
  - Los check-ins fuera de la semana se ignoran.
  - Con override 0, `met` es `true` y la semana no suma ni corta la racha.
  - Racha: tres semanas cerradas cumplidas, más la actual sin cumplir, da 3.
  - Si la actual también se cumple, da 4.
  - Una semana sin cumplir entre medio corta la racha.
  - La primera semana (la que contiene `startsOn`), si no se cumplió, no corta.
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: commit.** `feat(shared): add weekly quota progress and streaks`.

## PR 1.3 · `feat/web-shell`

### Tarea 9: app base y navegación

**Archivos:**
- Crear `apps/web/package.json`, `vite.config.ts` e `index.html` (`lang="es-CL"`).
- Crear `apps/web/src/main.tsx`, `src/app/App.tsx` y `src/app/routes.tsx`.
- Crear `src/styles/tokens.css` (con la dirección visual elegida) y `src/styles/global.css`.

**Interfaces:**
- Produce las rutas `/` (Hoy), `/habitos`, `/habitos/:id`, `/revision` y `/ajustes`.
- Produce la barra de pestañas inferior: Hoy, Hábitos, Revisión y Ajustes.

- [ ] **Paso 1: test** (Testing Library). `renders Hoy as the default tab`: el enlace "Hoy" tiene `aria-current="page"` en `/`.
- [ ] **Paso 2: ver que falla.**
- [ ] **Paso 3: implementar** con el enrutador aprobado, y el tema claro y oscuro desde `prefers-color-scheme`.
- [ ] **Paso 4: ver que pasa.** `pnpm --filter @habit-tracker/web test`, y además `pnpm --filter @habit-tracker/web build` sin errores.
- [ ] **Paso 5: commit.** `feat(web): add app shell and navigation`.

### Tarea 10: *error boundary* y estados con tiempo máximo

**Archivos:** crear `apps/web/src/ui/ErrorBoundary.tsx`, `src/ui/AsyncState.tsx`, `src/ui/useTimedLiveQuery.ts` y sus tests.

**Interfaces:**
- Produce `<ErrorBoundary>`, que muestra "Algo falló en esta sección." y un botón "Reintentar" que la vuelve a montar.
- Produce `useTimedLiveQuery<T>(query: () => Promise<T>, deps: unknown[], timeoutMs = 8000): { state: 'loading' | 'ready' | 'timeout' | 'error'; data?: T; retry(): void }`.
- Produce `<AsyncState>`, que decide entre carga, error, vacío y contenido.

- [ ] **Paso 1: tests.**
  - Con *fake timers*, una consulta que no responde pasa a `timeout` a los 8000 ms y muestra "Está tardando más de lo normal." con "Reintentar".
  - Un hijo que lanza un error queda contenido por el *boundary*.
  - "Reintentar" lo vuelve a montar.
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: commit.** `feat(web): add error boundary and timed async states`.

## PR 1.4 · `feat/web-local-db`

### Tarea 11: esquema Dexie y apertura segura

**Archivos:** crear `apps/web/src/db/db.ts` y `db.test.ts` (con `fake-indexeddb`).

**Interfaces:**
- Produce `class HabitDb extends Dexie`, con estas tablas e índices:
  - `anchors: 'id, sortOrder'`
  - `habits: 'id, anchorId, archivedAt'`
  - `checkIns: 'id, habitId, localDate, [habitId+localDate]'`
  - `weeklyQuotaOverrides: 'id, [habitId+weekStart]'`
  - `weeklyReviews: 'id, weekStart'`
  - `userSettings: 'id'`
  - `outbox: '[table+id], queuedAt'`
  - `syncState: 'id'`
- Produce `openDb(): Promise<HabitDb>`, que lanza `StorageUnavailableError` si IndexedDB no está disponible o falla al abrir.

- [ ] **Paso 1: tests.**
  - Las tablas existen después de `openDb()`.
  - Con `indexedDB` indefinido, `openDb()` rechaza con `StorageUnavailableError`.
  - `App` muestra "No pudimos abrir el almacenamiento de este dispositivo." con una explicación corta (foco de revisión 4).
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: commit.** `feat(web): add the local Dexie database`.

### Tarea 12: repositorios, *outbox* y contenido inicial

**Archivos:** crear `apps/web/src/db/write.ts`, `src/db/habits-repo.ts`, `src/db/check-ins-repo.ts`, `src/db/defaults.ts` y sus tests.

**Interfaces:**
- Produce `writeRows(db, table, rows)`. Fija `updatedAt` y encola en `outbox`, dentro de la misma transacción.
- Produce `habitsRepo`: `create(input: NewHabit): Promise<Habit>`, `update(id, patch)`, `archive(id)` y `unarchive(id)`.
- Produce `checkInsRepo`:
  - `markDone(habitId, date)`;
  - `skip(habitId, date, reason: SkipReason, note?: string)`;
  - `clear(habitId, date)` (borrado lógico);
  - `pauseDay(date, reason, habitIds)`: solo crea `skipped` donde no hay registro.
- Produce `ensureDefaults(db)`: crea `userSettings` y las 7 anclas por defecto con `seedId`, si no existen.

- [ ] **Paso 1: tests.**
  - `markDone` dos veces deja una fila y una entrada de *outbox*.
  - `clear` fija `deletedAt` y encola.
  - `markDone` después de `clear` deja `deletedAt: null`.
  - `pauseDay` no pisa un `done` existente.
  - `ensureDefaults` dos veces deja 7 anclas.
  - Toda escritura se ve en `outbox`.
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan. Los IDs se calculan antes de la transacción.
- [ ] **Paso 5: commit.** `feat(web): add repositories with an outbox and default anchors`.

### Tarea 13: "hoy" que cambia solo

**Archivos:** crear `apps/web/src/app/useToday.ts` y `useToday.test.ts`.

**Interfaces:**
- Produce `useToday(): LocalDate`. Usa `userSettings` y se recalcula con `visibilitychange`, con `focus` y cada 60 s.

- [ ] **Paso 1: test.** Con *fake timers* a las 03:59 del 24-10-2026 (hora de Santiago), devuelve `2026-10-23`. Tras avanzar 2 minutos, devuelve `2026-10-24` sin volver a montar (foco de revisión 2).
- [ ] **Pasos 2 a 4:** ver que falla, implementar y ver que pasa.
- [ ] **Paso 5: commit.** `feat(web): roll today over at the day cutoff`.

## PR 1.5 · `feat/habits-crud`

### Tarea 14: crear, editar y archivar hábitos

**Archivos:** crear `apps/web/src/habits/HabitForm.tsx`, `src/habits/HabitsScreen.tsx` y sus tests.

**Interfaces:**
- Consume `habitSchema`, `habitsRepo` y `anchors`.

- [ ] **Paso 1: tests.**
  - Crear un hábito diario guarda una fila con `startsOn` = hoy.
  - En modo cuota, sin cuota, aparece "Indica cuántas veces por semana (1 a 7)."
  - Dos clics rápidos en "Guardar" crean un solo hábito, porque el botón se deshabilita mientras guarda.
  - Al cambiar los días de un hábito con check-ins aparece "Si cambias los días, la racha se recalcula con los días nuevos." antes de guardar (foco de revisión 5).
  - "Archivar" lo saca de la lista activa y lo muestra en "Archivados", con "Reactivar".
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: commit.** `feat(web): create, edit and archive habits`.

### Tarea 15: editar anclas y ajustes

**Archivos:** crear `apps/web/src/habits/AnchorsEditor.tsx`, `apps/web/src/settings/SettingsScreen.tsx` y sus tests.

**Interfaces:**
- Consume `userSettingsSchema`, `writeRows` y `useToday`.

- [ ] **Paso 1: tests.**
  - Agregar un ancla.
  - Renombrarla.
  - Subir y bajar con botones accesibles (sin arrastrar).
  - No se puede archivar un ancla con hábitos activos: aparece "Mueve sus hábitos a otra ancla primero."
  - En Ajustes, cambiar la hora de corte a 0 (de 0 a 6) actualiza `useToday` de inmediato.
  - La zona horaria muestra `America/Santiago` por defecto y advierte que solo afecta a los registros nuevos.
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: commits.** `feat(web): edit anchors` y `feat(web): add settings for day cutoff and time zone`.

## PR 1.6 · `feat/today-screen`

### Tarea 16: "Hoy" con marcado de un toque

**Archivos:** crear `apps/web/src/today/TodayScreen.tsx`, `src/today/HabitRow.tsx` y sus tests.

**Interfaces:**
- Consume `habitsForDay`, `checkInsRepo` y `useToday`.

- [ ] **Paso 1: tests.**
  - Agrupa por ancla, en orden.
  - Un toque en un hábito lo marca: `aria-pressed="true"`.
  - Otro toque, pasados 400 ms, lo desmarca.
  - **Dos toques en menos de 400 ms dejan el hábito marcado y hacen una sola escritura** (foco de revisión 1).
  - Sin hábitos: "Todavía no tienes hábitos." con el botón "Crear hábito".
  - Los hábitos de cuota muestran "2 de 3 esta semana".
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: commit.** `feat(web): add the Today screen with one-tap check-ins`.

### Tarea 17: saltar con motivo y pausar el día

**Archivos:** crear `apps/web/src/today/SkipSheet.tsx` y su test.

- [ ] **Paso 1: tests.**
  - El botón "Más opciones" de una fila abre la hoja con Certamen, Enfermedad, Viaje, Descanso y Otro, más una nota opcional.
  - Elegir "Certamen" guarda `skipped` con `skipReason: 'certamen'`.
  - "Pausar el día" salta todos los pendientes de hoy con un solo motivo y no toca los ya marcados.
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: commit.** `feat(web): skip habits with a reason and pause the day`.

### Tarea 18: racha y progreso visibles

**Archivos:** crear `apps/web/src/today/useHabitStats.ts` y su test.

- [ ] **Paso 1: tests.**
  - Un diario con racha 5 muestra "Racha: 5 días".
  - Un día saltado muestra "Saltado: certamen".
  - Una cuota cumplida muestra "Cumplido esta semana" y la racha semanal.
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: commit.** `feat(web): show streaks and weekly progress`.

## PR 1.7 · `feat/habit-history`

### Tarea 19: mapa de calor de 90 días

**Archivos:**
- Crear `packages/shared/src/habits/heatmap.ts` y su test.
- Crear `apps/web/src/habits/HabitHistory.tsx` y su test.

**Interfaces:**
- Produce `buildHeatmap(args: { habit; today: LocalDate; checkIns; days?: number }): Array<{ date: LocalDate; state: 'done' | 'skipped' | 'missed' | 'not_scheduled' | 'before_start' | 'today_pending' }>`. Por defecto `days = 90` y el orden va de lo más antiguo a hoy.

- [ ] **Paso 1: tests.**
  - Devuelve 90 celdas.
  - Hoy sin registro queda como `today_pending`, no como `missed`.
  - Los días antes de `startsOn` quedan como `before_start`.
  - El fin de semana de un hábito de lunes a viernes queda como `not_scheduled`.
  - El componente da a cada celda una etiqueta accesible, por ejemplo "vie 23-10: hecho", y usa una cuadrícula con el lunes primero.
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: commit.** `feat: add a 90-day habit history`.

## PR 1.8 · `feat/weekly-review`

### Tarea 20: revisión del domingo

**Archivos:**
- Crear `packages/shared/src/habits/week-summary.ts` y su test.
- Crear `apps/web/src/review/ReviewScreen.tsx` y su test.

**Interfaces:**
- Produce `weekSummary(args: { habits: Habit[]; weekStart: LocalDate; today: LocalDate; checkIns; overrides }): Array<{ habitId: string; done: number; skipped: number; missed: number; quota: number | null; met: boolean | null; streak: number }>`.

- [ ] **Paso 1: tests.**
  - Resumen correcto de una semana con hábitos de los dos tipos.
  - El domingo, la pantalla muestra la semana en curso; de lunes a sábado, la última semana cerrada.
  - Guardar la reflexión escribe `weeklyReviews`.
  - Cambiar la cuota de la semana siguiente escribe `weeklyQuotaOverrides` con `quotaOverrideId`.
  - "Marcar revisión como hecha" fija `completedAt`.
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: commit.** `feat: add the Sunday weekly review`.

## PR 1.9 · `test/phase-1-review`

### Tarea 21: E2E y revisión de interfaz

**Archivos:**
- Crear `apps/web/playwright.config.ts`, con Chromium en 393×852 (`isMobile`, `hasTouch`) y en 1280×800.
- Crear `apps/web/e2e/habits.spec.ts`.

- [ ] **Paso 1: escribir los E2E.**
  - Crear un hábito diario, marcarlo en "Hoy", recargar y verlo marcado.
  - Saltar con motivo.
  - Pausar el día.
  - Progreso de un hábito de cuota.
  - Archivar y reactivar.
  - Revisión del domingo, con el reloj simulado de Playwright.
  - Capturas en claro y oscuro, en móvil y escritorio.
- [ ] **Paso 2: correrlos.** `pnpm --filter @habit-tracker/web e2e` debe pasar con Chromium.
- [ ] **Paso 3: revisión.** Correr la skill `web-design-guidelines` sobre `apps/web/src` y corregir lo que encuentre, con un commit por corrección.
- [ ] **Paso 4: verificar.** Volver a correr unitarios, E2E, `typecheck`, `lint` y `build`, y confirmar que todo pasa.
- [ ] **Paso 5: commit.** `test(web): add phase 1 end-to-end tests`.

Cierre de la fase: resumen para ti, con capturas, y la etiqueta `phase-1-ok` cuando lo apruebes.
