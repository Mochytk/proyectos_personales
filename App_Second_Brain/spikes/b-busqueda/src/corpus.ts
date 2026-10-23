// Loads the synthetic golden set: notes (Markdown + frontmatter) and questions (JSON).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Note {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  body: string;
}

export interface Question {
  id: string;
  categoria: string;
  pregunta: string;
  esperadas: string[];
  fecha_ref?: string;
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;

export function parseNote(text: string): Note | null {
  const match = FRONTMATTER.exec(text);
  if (match?.[1] === undefined) return null;
  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const field = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (field?.[1] !== undefined && field[2] !== undefined) fields[field[1]] = field[2].trim();
  }
  const { id, title } = fields;
  if (id === undefined || title === undefined) return null;
  const tags = (fields.tags ?? '').replace(/^\[|\]$/g, '').split(',').map((tag) => tag.trim()).filter(Boolean);
  return { id, title, tags, createdAt: fields.created_at ?? '', body: text.slice(match[0].length).trim() };
}

export function loadNotes(dir: string): Note[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => parseNote(readFileSync(join(dir, name), 'utf8')))
    .filter((note): note is Note => note !== null);
}

export function loadQuestions(file: string): Question[] {
  return (JSON.parse(readFileSync(file, 'utf8')) as { preguntas: Question[] }).preguntas;
}

/** Text used for embeddings: the title carries a lot of meaning in short notes. */
export function passageOf(note: Note): string {
  return `${note.title}. ${note.body}`;
}
