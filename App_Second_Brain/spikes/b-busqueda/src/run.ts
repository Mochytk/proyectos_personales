// Spike B: golden-set evaluation of full-text, vector and hybrid search (throwaway code, never merged).
// Usage: node src/run.ts [--fts-only] [--extra] [--models-dir DIR] [--out FILE]
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { loadNotes, loadQuestions, type Note, passageOf } from './corpus.ts';
import { ensureModel } from './download.ts';
import { transformersEmbedder } from './embedder.ts';
import { evaluate, type MethodResult } from './evaluate.ts';
import { FtsIndex } from './fts.ts';
import { percentile } from './metrics.ts';
import { EXTRA_MODELS, MODELS } from './models.ts';
import { rrf } from './rrf.ts';
import { VectorIndex } from './vector.ts';

const here = dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({
  options: {
    'fts-only': { type: 'boolean', default: false },
    extra: { type: 'boolean', default: false },
    'models-dir': { type: 'string', default: join(homedir(), 'SegundoCerebro-spikes', 'b', 'models') },
    out: { type: 'string', default: join(homedir(), 'SegundoCerebro-spikes', 'b', 'results.json') },
  },
});

const notes = loadNotes(join(here, '..', 'eval', 'notas'));
const questions = loadQuestions(join(here, '..', 'eval', 'preguntas.json'));
const fts = new FtsIndex(notes);
const ftsSearch = (stopwords: boolean) => (query: string, k: number) => fts.search(query, k, { stopwords });

const results: MethodResult[] = [];
const models: Record<string, unknown>[] = [];
results.push(await evaluate('fts', questions, notes, ftsSearch(false), { dates: false }));
results.push(await evaluate('fts+stop', questions, notes, ftsSearch(true), { dates: false }));
results.push(await evaluate('fts+stop+fechas', questions, notes, ftsSearch(true), { dates: true }));

if (!args['fts-only']) {
  const specs = args.extra ? [...MODELS, ...EXTRA_MODELS] : MODELS;
  for (const spec of specs) {
    try {
      const download = await ensureModel(spec, args['models-dir']);
      const rssBefore = process.memoryUsage().rss;
      const loadStarted = performance.now();
      const embedder = await transformersEmbedder(spec, args['models-dir']);
      const loadMs = performance.now() - loadStarted;
      const indexStarted = performance.now();
      const vectors = await embedder.embed(notes.map(passageOf), 'passage');
      const indexMsPerNote = (performance.now() - indexStarted) / notes.length;
      const index = new VectorIndex();
      notes.forEach((note, i) => index.add(note.id, vectors[i] ?? new Float32Array()));
      const vectorSearch = async (query: string, k: number) => {
        const [vector] = await embedder.embed([query], 'query');
        return vector ? index.search(vector, k) : [];
      };
      const hybrid = async (query: string, k: number) =>
        rrf([fts.search(query, 20, { stopwords: true }), await vectorSearch(query, 20)]).slice(0, k);
      results.push(await evaluate(`emb:${spec.id}`, questions, notes, vectorSearch, { dates: false }));
      results.push(await evaluate(`híbrida:${spec.id}`, questions, notes, hybrid, { dates: false }));
      results.push(await evaluate(`híbrida+fechas:${spec.id}`, questions, notes, hybrid, { dates: true }));
      models.push({
        model: spec.id,
        repo: spec.repo,
        revision: download.revision.slice(0, 12),
        license: download.license,
        disk_mb: Math.round(download.bytes / 2 ** 20),
        load_ms: Math.round(loadMs),
        embed_ms_per_note: Math.round(indexMsPerNote * 10) / 10,
        rss_delta_mb: Math.round((process.memoryUsage().rss - rssBefore) / 2 ** 20),
        dims: vectors[0]?.length ?? 0,
      });
    } catch (error) {
      models.push({ model: spec.id, error: (error as Error).message });
    }
  }
}

// Search cost at the target scale, independent of content: 10,000 notes.
function syntheticNotes(count: number): Note[] {
  const words = 'idea proyecto feria titulo ramo redes certamen gimnasio receta compras lectura deploy merge viaje libro'.split(' ');
  return Array.from({ length: count }, (_, i) => ({
    id: `syn-${String(i)}`,
    title: `${words[i % words.length] ?? ''} ${words[(i * 7) % words.length] ?? ''}`,
    tags: [],
    createdAt: '2026-10-01T10:00:00-03:00',
    body: Array.from({ length: 80 }, (_, j) => words[(i * 31 + j * 17) % words.length]).join(' '),
  }));
}
const bigFts = new FtsIndex(syntheticNotes(10_000));
const ftsTimes = Array.from({ length: 50 }, (_, i) => {
  const started = performance.now();
  bigFts.search(['feria proyecto', 'certamen redes', 'receta compras', 'viaje libro'][i % 4] ?? 'idea', 20, { stopwords: true });
  return performance.now() - started;
});
const bigVectors = new VectorIndex();
const unit = (dims: number) => {
  const vector = Float32Array.from({ length: dims }, () => Math.random() - 0.5);
  const norm = Math.hypot(...vector);
  return vector.map((value) => value / norm);
};
for (let i = 0; i < 10_000; i += 1) bigVectors.add(String(i), unit(384));
const vectorTimes = Array.from({ length: 50 }, () => {
  const query = unit(384);
  const started = performance.now();
  bigVectors.search(query, 20);
  return performance.now() - started;
});
const scale = {
  notes: 10_000,
  fts_p50_ms: Math.round(percentile(ftsTimes, 50) * 10) / 10,
  vector384_p50_ms: Math.round(percentile(vectorTimes, 50) * 10) / 10,
};

const round = (value: number) => Math.round(value * 1000) / 10;
console.log(`\n# Spike B: resultados (${String(questions.length)} preguntas, ${String(notes.length)} notas sintéticas)\n`);
console.log('| Método | recall@5 | MRR | p50 (ms) | p95 (ms) | Falló en |');
console.log('| --- | --- | --- | --- | --- | --- |');
for (const r of results) {
  console.log(`| ${r.method} | ${String(round(r.recall5))}% | ${(r.mrr).toFixed(2)} | ${r.p50ms.toFixed(1)} | ${r.p95ms.toFixed(1)} | ${r.misses.join(', ')} |`);
}
const categories = [...new Set(questions.map((q) => q.categoria))];
console.log(`\n| Método | ${categories.join(' | ')} |`);
console.log(`| --- | ${categories.map(() => '---').join(' | ')} |`);
for (const r of results) {
  console.log(`| ${r.method} | ${categories.map((c) => `${String(round(r.byCategory[c] ?? 0))}%`).join(' | ')} |`);
}
console.log('\nModelos:', JSON.stringify(models, null, 2));
console.log('Escala:', JSON.stringify(scale));
mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, JSON.stringify({ node: process.version, results, models, scale }, null, 2));
