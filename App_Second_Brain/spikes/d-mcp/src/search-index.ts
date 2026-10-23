// In-memory full-text index on node:sqlite (no native modules), the hypothesis of the architecture draft.
import { DatabaseSync } from 'node:sqlite';

import type { Note } from './vault.ts';

export interface Hit {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  snippet: string;
  score: number;
}

export interface Summary {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

export interface Stats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  tags: number;
}

const MIN_TOKEN = 2;
const PREFIX_FROM = 4; // "apunte" also matches "apuntes"

/**
 * Turns free text into a safe FTS5 query: only letters and digits survive, each token is
 * quoted (so OR, NEAR, column filters and * lose their meaning) and tokens are OR-ed.
 */
export function toFtsQuery(text: string): string | null {
  const words = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (word) => word.length >= MIN_TOKEN,
  );
  if (words.length === 0) return null;
  return words.map((word) => (word.length >= PREFIX_FROM ? `"${word}"*` : `"${word}"`)).join(' OR ');
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

export class SearchIndex {
  // Plain fields, not parameter properties: Node's type stripping only accepts erasable syntax.
  private readonly db: DatabaseSync;
  private readonly notes: Map<string, Note>;

  private constructor(db: DatabaseSync, notes: Map<string, Note>) {
    this.db = db;
    this.notes = notes;
  }

  static build(notes: Note[]): SearchIndex {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE VIRTUAL TABLE notes_fts USING fts5(
      id UNINDEXED, title, body, tags,
      tokenize = 'unicode61 remove_diacritics 2'
    )`);
    const insert = db.prepare('INSERT INTO notes_fts (id, title, body, tags) VALUES (?, ?, ?, ?)');
    db.exec('BEGIN');
    for (const note of notes) insert.run(note.id, note.title, note.body, note.tags.join(' '));
    db.exec('COMMIT');
    return new SearchIndex(db, new Map(notes.map((note) => [note.id, note])));
  }

  search(text: string, k: number): Hit[] {
    const query = toFtsQuery(text);
    if (query === null) return [];
    // bm25 weights: id, title, body, tags. Lower bm25 is better, so it is negated.
    const rows = this.db
      .prepare(
        `SELECT id, -bm25(notes_fts, 0, 5.0, 1.0, 2.0) AS score,
                snippet(notes_fts, 2, '«', '»', '…', 24) AS snippet
         FROM notes_fts WHERE notes_fts MATCH ? ORDER BY score DESC LIMIT ?`,
      )
      .all(query, k) as { id: string; score: number; snippet: string }[];
    return rows.flatMap((row) => {
      const note = this.notes.get(row.id);
      if (!note) return [];
      return [
        {
          id: note.id,
          title: note.title,
          type: note.type,
          status: note.status,
          createdAt: note.createdAt,
          snippet: row.snippet,
          score: Math.round(row.score * 100) / 100,
        },
      ];
    });
  }

  get(id: string): Note | undefined {
    return this.notes.get(id);
  }

  inbox(limit: number): Summary[] {
    return [...this.notes.values()]
      .filter((note) => note.status === 'inbox')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(({ id, title, type, createdAt }) => ({ id, title, type, createdAt }));
  }

  stats(): Stats {
    const all = [...this.notes.values()];
    return {
      total: all.length,
      byType: countBy(all.map((note) => note.type)),
      byStatus: countBy(all.map((note) => note.status)),
      tags: new Set(all.flatMap((note) => note.tags)).size,
    };
  }
}
