// Full-text baseline on node:sqlite FTS5 (no native modules).
import { DatabaseSync } from 'node:sqlite';

import type { Note } from './corpus.ts';

// Very common Spanish words that only add noise to an OR query.
const STOPWORDS = new Set(
  ('a al algo con como cual cuando de del el ella en es esa ese esta este hay la las lo los me mi ' +
    'mis no o para pero por que qué se sin sobre su sus te tengo tenía tu un una uno y ya yo anoté ' +
    'anote hice idea ideas nota notas quien quién tenia tiene').split(' '),
);

export function ftsQuery(text: string, { stopwords }: { stopwords: boolean }): string | null {
  const words = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => word.length >= 2)
    .filter((word) => !stopwords || !STOPWORDS.has(word));
  if (words.length === 0) return null;
  return words.map((word) => (word.length >= 4 ? `"${word}"*` : `"${word}"`)).join(' OR ');
}

export class FtsIndex {
  private readonly db: DatabaseSync;

  constructor(notes: Note[]) {
    this.db = new DatabaseSync(':memory:');
    this.db.exec(`CREATE VIRTUAL TABLE notes_fts USING fts5(
      id UNINDEXED, title, body, tags, tokenize = 'unicode61 remove_diacritics 2')`);
    const insert = this.db.prepare('INSERT INTO notes_fts (id, title, body, tags) VALUES (?, ?, ?, ?)');
    for (const note of notes) insert.run(note.id, note.title, note.body, note.tags.join(' '));
  }

  search(text: string, k: number, options: { stopwords: boolean }): string[] {
    const query = ftsQuery(text, options);
    if (query === null) return [];
    const rows = this.db
      .prepare('SELECT id FROM notes_fts WHERE notes_fts MATCH ? ORDER BY bm25(notes_fts, 0, 5.0, 1.0, 2.0) LIMIT ?')
      .all(query, k) as { id: string }[];
    return rows.map((row) => row.id);
  }
}
