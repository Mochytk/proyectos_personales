import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SearchIndex, toFtsQuery } from '../src/search-index.ts';
import type { Note } from '../src/vault.ts';

function note(id: string, title: string, body: string, extra: Partial<Note> = {}): Note {
  return {
    id,
    title,
    body,
    type: 'note',
    status: 'processed',
    tags: [],
    createdAt: '2026-10-01T10:00:00-03:00',
    ...extra,
  };
}

const notes = [
  note('01AAAAAAAAAAAAAAAAAAAAAAA1', 'Stand para la feria', 'Demo en vivo de la app y un QR.'),
  note('01AAAAAAAAAAAAAAAAAAAAAAA2', 'Apuntes de redes', 'Control de congestión en TCP.', {
    status: 'inbox',
  }),
  note('01AAAAAAAAAAAAAAAAAAAAAAA3', 'Búsqueda híbrida', 'Combinar BM25 con embeddings.', {
    tags: ['titulo'],
  }),
];

test('toFtsQuery quotes every token and adds a prefix wildcard to long ones', () => {
  assert.equal(toFtsQuery('feria de software'), '"feria"* OR "de" OR "software"*');
});

test('toFtsQuery neutralizes FTS5 syntax in user input', () => {
  assert.equal(toFtsQuery('redes" OR (body:*) NEAR'), '"redes"* OR "or" OR "body"* OR "near"*');
  assert.equal(toFtsQuery('¿?¡! "" ()'), null);
});

test('search finds a note by a word without its accent', () => {
  const index = SearchIndex.build(notes);
  const results = index.search('busqueda hibrida', 5);
  assert.equal(results[0]?.id, '01AAAAAAAAAAAAAAAAAAAAAAA3');
});

test('search matches plurals through the prefix wildcard', () => {
  const index = SearchIndex.build(notes);
  const results = index.search('apunte', 5);
  assert.equal(results[0]?.id, '01AAAAAAAAAAAAAAAAAAAAAAA2');
});

test('search returns short snippets, never whole bodies', () => {
  const long = note('01AAAAAAAAAAAAAAAAAAAAAAA4', 'Largo', `${'relleno '.repeat(400)}aguja ${'relleno '.repeat(400)}`);
  const index = SearchIndex.build([long]);
  const [hit] = index.search('aguja', 5);
  assert.ok(hit);
  assert.ok(hit.snippet.length < 300, `snippet too long: ${String(hit.snippet.length)}`);
  assert.match(hit.snippet, /aguja/);
});

test('search with only punctuation returns nothing instead of throwing', () => {
  const index = SearchIndex.build(notes);
  assert.deepEqual(index.search('"*()', 5), []);
});

test('inbox lists only notes in the inbox, newest first', () => {
  const index = SearchIndex.build(notes);
  assert.deepEqual(
    index.inbox(10).map((n) => n.id),
    ['01AAAAAAAAAAAAAAAAAAAAAAA2'],
  );
});

test('stats counts notes by type and status', () => {
  const stats = SearchIndex.build(notes).stats();
  assert.equal(stats.total, 3);
  assert.deepEqual(stats.byStatus, { inbox: 1, processed: 2 });
});
