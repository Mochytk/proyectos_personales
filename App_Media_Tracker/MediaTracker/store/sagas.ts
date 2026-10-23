import type { MediaItem } from './useStore';

/** Only books belong to sagas for now. */
export const SAGA_TYPES: MediaItem['type'][] = ['book'];

export interface Saga {
  name: string;
  /** Position in the saga (1, 2, 3...). Decimals allow novellas, e.g. 0.5. */
  number?: number;
}

const MAX_NAME_LENGTH = 120;

/** Cleans a saga read from storage or a backup; undefined when there is no usable name. */
export function sanitizeSaga(raw: unknown): Saga | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { name, number } = raw as Record<string, unknown>;
  if (typeof name !== 'string') return undefined;
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  if (!clean) return undefined;
  const hasNumber = typeof number === 'number' && Number.isFinite(number) && number > 0;
  return hasNumber ? { name: clean, number } : { name: clean };
}

/** Identity of a saga: "El Imperio Final", " el imperio  final " and "El imperio final" are the same one. */
export const sagaKey = (name: string): string =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

/** "Mistborn · #2", or undefined when the item has no saga. */
export function sagaLabel(item: Pick<MediaItem, 'saga'>): string | undefined {
  if (!item.saga) return undefined;
  return item.saga.number !== undefined ? `${item.saga.name} · #${item.saga.number}` : item.saga.name;
}

export interface SagaSummary {
  key: string;
  /** Name as the user wrote it (the first one found when spellings differ). */
  name: string;
  /** Books in reading order: by number, then unnumbered ones by title. */
  books: MediaItem[];
  completed: number;
}

const byOrder = (a: MediaItem, b: MediaItem) =>
  (a.saga?.number ?? Infinity) - (b.saga?.number ?? Infinity) || a.title.localeCompare(b.title);

/** Groups books into sagas, sorted by name. */
export function sagasOf(items: MediaItem[]): SagaSummary[] {
  const groups = new Map<string, SagaSummary>();
  for (const item of items) {
    if (!item.saga || !SAGA_TYPES.includes(item.type)) continue;
    const key = sagaKey(item.saga.name);
    const group = groups.get(key) ?? { key, name: item.saga.name, books: [], completed: 0 };
    group.books.push(item);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      books: [...group.books].sort(byOrder),
      completed: group.books.filter((b) => b.status === 'completed').length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The first book of a saga, in order, that is not finished. */
export const nextBook = (saga: SagaSummary): MediaItem | undefined => saga.books.find((b) => b.status !== 'completed' && b.status !== 'abandoned');

/** Saga names already in use, to suggest while typing (those starting with `query` first). */
export function suggestSagas(items: MediaItem[], query: string, limit = 5): string[] {
  const q = sagaKey(query);
  const names = sagasOf(items).map((s) => s.name);
  if (!q) return names.slice(0, limit);
  const matches = names.filter((n) => sagaKey(n).includes(q) && sagaKey(n) !== q);
  return matches.sort((a, b) => Number(!sagaKey(a).startsWith(q)) - Number(!sagaKey(b).startsWith(q))).slice(0, limit);
}

/** Reads the "number in the saga" field: accepts "2", "0.5" and "0,5"; anything else is no number. */
export function parseSagaNumber(text: string): number | undefined {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Builds the saga to save from the form fields; undefined when the name is empty. */
export const buildSaga = (name: string, numberText: string): Saga | undefined =>
  sanitizeSaga({ name, number: parseSagaNumber(numberText) });

/** The number a new book of this saga most likely has: one more than the highest so far (1 if none). */
export function nextSagaNumber(items: MediaItem[], name: string): number {
  const saga = sagasOf(items).find((s) => s.key === sagaKey(name));
  const numbers = (saga?.books ?? []).map((b) => b.saga?.number).filter((n): n is number => n !== undefined);
  return numbers.length > 0 ? Math.floor(Math.max(...numbers)) + 1 : 1;
}
