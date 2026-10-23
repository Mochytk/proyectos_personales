# 0006 · Sincronización offline-first

- **Estado:** Propuesta
- **Fecha:** 23-10-2026

## Contexto

- La app lee y escribe primero en el dispositivo y sincroniza después (RF-4.1).
- Un cambio tiene que aparecer en el otro dispositivo en menos de 30 s, con conexión y con la app abierta (criterio de éxito; respuesta 13 de la fase 0).
- La sincronización tiene que ser idempotente y tolerar cortes a mitad de camino (RF-4.4).
- Hay un solo usuario con dos dispositivos.
- Neon Free tiene 100 CU-horas al mes, así que la base no puede quedar despierta solo para saber si hay cambios (ADR 0004).

## Decisión

### Datos

- Toda entidad sincronizable tiene estas columnas:
  - `id`: UUID generado en el cliente.
  - `user_id`.
  - `created_at`.
  - `updated_at`: hora del dispositivo al editar.
  - `deleted_at`: borrado lógico.
  - `server_seq`: número que asigna el servidor.
- **IDs deterministas para las claves naturales.** Hay registros que pueden nacer en dos dispositivos a la vez:
  - el check-in de un hábito en una fecha;
  - la cuota de un hábito en una semana;
  - la revisión de una semana;
  - una medida corporal en una fecha;
  - el contenido inicial (anclas, catálogo de ejercicios, tipos de medida).

  Para esos, el `id` es un UUID v5 calculado de la clave natural. Así, si marcas el mismo hábito el mismo día en el iPhone y en el Mac, los dos generan el mismo `id` y el servidor los fusiona, en vez de chocar con una restricción de unicidad. Los demás registros usan `crypto.randomUUID()`.
- Desmarcar un hábito es un borrado lógico. Volver a marcarlo es el mismo `id`, con `deleted_at = null`.

### Protocolo

- **Push** (`POST /api/sync/push`): el cliente manda las filas que cambió, como fotos completas, en lotes de hasta 200. El servidor:
  1. Valida cada fila con el esquema Zod compartido y fuerza `user_id` desde la sesión.
  2. Toma un candado por usuario (`pg_advisory_xact_lock`), para que dos *push* simultáneos no se mezclen.
  3. Hace un *upsert* por fila con la regla de conflicto (ver más abajo). A cada fila aceptada le asigna `server_seq` desde una secuencia global.
  4. Hace *commit* de todo el lote o de nada.
  5. Avisa al Durable Object `SyncNotifier` del nuevo `server_seq` máximo.
- **Pull** (`GET /api/sync/pull?cursor=N`): devuelve las filas del usuario con `server_seq > N`, en orden, hasta 500, junto con el nuevo cursor y `hasMore`.
- **Aviso de cambios sin despertar Neon** (`GET /api/sync/version`): responde el `SyncNotifier` (un Durable Object con SQLite por usuario), no Postgres.
  - Con la app visible, el cliente pregunta cada 15 s.
  - También pregunta al abrir la app, al volver a ella y al recuperar la conexión.
  - Solo hace *pull* si la versión es mayor que su cursor.
  - Con dos dispositivos y 12 horas de uso son unas 6.000 peticiones al día, dentro de las 100.000 gratis.
- **Cola local (*outbox*):** cada escritura local marca la fila como pendiente en la misma transacción de Dexie. El *push* envía las pendientes. Una fila deja de estar pendiente solo si no se volvió a editar mientras viajaba (se compara `updated_at`).
- **Reintentos:** con espera creciente (1 s, 2 s, 4 s... hasta 5 min) y con un poco de azar. Se reintenta al recuperar la conexión.

### Regla de conflicto

Gana el **último en escribir, por registro**, según `updated_at`, que es la hora del dispositivo al editar. Si los dos `updated_at` son iguales, gana el que llegó último al servidor (mayor `server_seq`). Ese es el desempate con el reloj del servidor que pide RF-4.2.

Se usa la hora de edición y no la hora de llegada por un caso concreto: anotas una serie sin señal en el gimnasio a las 18:00, la corriges desde el Mac a las 19:00, y el teléfono recién se conecta a las 20:00. Con la hora de llegada, el teléfono pisaría tu corrección más nueva.

Para que un reloj desajustado no domine, el servidor recorta cualquier `updated_at` que venga más de 5 minutos en el futuro.

### Estado visible

El indicador de sincronización (RF-4.3) tiene cuatro estados:

- **Sincronizado:** sin pendientes y último intento exitoso.
- **Pendiente:** hay filas en la *outbox*.
- **Sin conexión:** `navigator.onLine` es falso o el último intento falló por red.
- **Error:** el servidor rechazó algo (por ejemplo, la validación). Muestra qué falló.

## Por qué es idempotente

Repetir el mismo *push* deja la base igual, porque la regla de conflicto compara `updated_at` y una fila igual no gana ni pierde. Si la conexión se corta antes del *commit*, no se aplicó nada y el cliente reintenta. Si se corta después del *commit*, el reintento no cambia nada, y el *pull* trae el estado final.

## Alternativas

- **Dexie Cloud.** Es el servicio de sincronización de los autores de Dexie. El plan gratis tiene 3 usuarios de producción, autenticación incluida y 10 bases.
  - *A favor:* casi no hay que escribir código de sincronización, y resuelve conflictos con CRDT.
  - *En contra:* tus datos quedan en la nube de un tercero y no en tus cuentas, lo que choca con el supuesto 6 del documento maestro. Además reemplazaría a Neon y a Better Auth, aprenderíamos mucho menos del ciclo completo y quedaríamos atados a su servicio para el proyecto más grande.
  - **No se recomienda,** pero si prefieres velocidad por sobre aprendizaje, es la opción realista.
- **Consultar Neon cada 15 s.** Mantiene la base despierta mientras la app esté abierta y gastaría el límite de cómputo (ADR 0004).
- **WebSockets con el Durable Object (*hibernation*).** Darían avisos instantáneos. Quedan como mejora si la consulta cada 15 s no basta; el protocolo no cambia.
- **CRDT o sincronización por operación.** Con un solo usuario, el último en escribir por registro es suficiente y mucho más simple.
- **ElectricSQL, PowerSync y similares.** No los evalué a fondo. Necesitan otro servicio, o replicación lógica de Postgres, que impide que Neon duerma. Para un solo usuario agregan más de lo que aportan.

## Consecuencias

- La lógica de comparación y de lotes vive en `packages/shared` y se prueba con tests unitarios. Los cortes de red, los reintentos y el *push* duplicado se prueban con tests de integración contra Postgres.
- Si el aviso al Durable Object falla después del *commit*, el otro dispositivo se entera en su siguiente *push* o al volver a abrir la app. El aviso se reintenta una vez dentro de la misma petición.
- **Exportar e importar** (RF-5.1) usan los mismos esquemas. Importar es un *push* masivo con la misma regla de conflicto, así que nunca borra datos más nuevos.

## Fuentes (consultadas el 23-10-2026)

- Precios de Durable Objects y KV: https://developers.cloudflare.com/workers/platform/pricing/
- Neon, escala a cero y replicación lógica: https://neon.com/docs/introduction/scale-to-zero
- Dexie Cloud: https://dexie.org/cloud/pricing
