import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inRange, relativeRange } from '../src/dates.ts';

test('"la semana pasada" is Monday to Sunday of the previous week', () => {
  // 2026-10-21 is a Wednesday.
  const range = relativeRange('¿Qué hice en el gimnasio la semana pasada?', '2026-10-21');
  assert.deepEqual(range, { from: '2026-10-12', to: '2026-10-18', phrase: 'la semana pasada' });
});

test('"ayer" and "hoy" resolve to single days', () => {
  assert.deepEqual(relativeRange('¿Qué idea anoté ayer?', '2026-10-22'), { from: '2026-10-21', to: '2026-10-21', phrase: 'ayer' });
  assert.equal(relativeRange('lo de hoy', '2026-10-22')?.from, '2026-10-22');
});

test('questions without a relative date return null', () => {
  assert.equal(relativeRange('stand de la feria', '2026-10-22'), null);
});

test('inRange uses the local date written in created_at', () => {
  const range = { from: '2026-10-21', to: '2026-10-21', phrase: 'ayer' };
  assert.equal(inRange('2026-10-21T23:50:00-03:00', range), true);
  assert.equal(inRange('2026-10-22T00:10:00-03:00', range), false);
});
