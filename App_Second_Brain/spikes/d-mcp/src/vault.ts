// Minimal vault reader for the spike. The real core will use a full YAML parser
// and validate the frontmatter with the Zod schemas in packages/shared.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Note {
  id: string;
  title: string;
  type: string;
  status: string;
  tags: string[];
  createdAt: string;
  body: string;
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;

function parseFrontmatter(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const match = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) fields[match[1]] = match[2].trim();
  }
  return fields;
}

function parseList(value: string | undefined): string[] {
  if (!value?.startsWith('[') || !value.endsWith(']')) return [];
  return value
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function parseNote(text: string): Note | null {
  const match = FRONTMATTER.exec(text);
  if (match?.[1] === undefined) return null;
  const fields = parseFrontmatter(match[1]);
  const { id, title } = fields;
  if (id === undefined || title === undefined) return null;
  return {
    id,
    title,
    type: fields.type ?? 'note',
    status: fields.status ?? 'inbox',
    tags: parseList(fields.tags),
    createdAt: fields.created_at ?? '',
    body: text.slice(match[0].length).trim(),
  };
}

/** Reads every *.md file directly inside `dir`; files without valid frontmatter are skipped. */
export function loadVault(dir: string): { notes: Note[]; skipped: number } {
  const notes: Note[] = [];
  let skipped = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const parsed = parseNote(readFileSync(join(dir, name), 'utf8'));
    if (parsed) notes.push(parsed);
    else skipped += 1;
  }
  return { notes, skipped };
}
