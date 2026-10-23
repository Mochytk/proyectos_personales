import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { loadNotes, loadQuestions } from '../src/corpus.ts';
import { evaluate } from '../src/evaluate.ts';
import { FtsIndex } from '../src/fts.ts';

const notes = loadNotes(fileURLToPath(new URL('../eval/notas', import.meta.url)));
const questions = loadQuestions(fileURLToPath(new URL('../eval/preguntas.json', import.meta.url)));

test('the golden set is consistent: every expected id exists', () => {
  const ids = new Set(notes.map((note) => note.id));
  assert.equal(notes.length, 57);
  assert.ok(questions.length >= 30);
  for (const question of questions) for (const id of question.esperadas) assert.ok(ids.has(id), `${question.id} → ${id}`);
});

test('an oracle search scores 100% and a useless one 0%', async () => {
  const answers = new Map(questions.map((question) => [question.pregunta, question.esperadas]));
  const oracle = await evaluate('oracle', questions, notes, (query) => answers.get(query) ?? [], { dates: false });
  assert.equal(oracle.recall5, 1);
  assert.equal(oracle.mrr, 1);
  const useless = await evaluate('nada', questions, notes, () => [], { dates: false });
  assert.equal(useless.recall5, 0);
});

test('a date-only question falls back to that day\'s notes', async () => {
  const onlyDate = questions.filter((question) => question.id === 'Q33');
  const result = await evaluate('fechas', onlyDate, notes, () => [], { dates: true });
  assert.equal(result.recall5, 1);
});

test('FTS ignores accents and finds the exact-word questions', () => {
  const fts = new FtsIndex(notes);
  assert.equal(fts.search('paseo a valparaiso', 5, { stopwords: true })[0], '01EVAL0000000000000000E014');
  assert.equal(fts.search('¿Por qué falló el deploy en Cloudflare?', 5, { stopwords: true })[0], '01EVAL0000000000000000E001');
});
