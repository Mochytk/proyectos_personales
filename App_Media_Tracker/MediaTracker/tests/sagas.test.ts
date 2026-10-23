import { describe, expect, it } from 'vitest';
import { buildSaga, nextBook, nextSagaNumber, parseSagaNumber, sagaKey, sagaLabel, sagasOf, sanitizeSaga, suggestSagas } from '../store/sagas';
import type { MediaItem } from '../store/useStore';

let n = 0;
const book = (title: string, saga?: MediaItem['saga'], over: Partial<MediaItem> = {}): MediaItem => ({
  id: `b${++n}`, title, type: 'book', status: 'unstarted', progress: 0, createdAt: 1, updatedAt: 1, saga, ...over,
});

describe('sanitizeSaga', () => {
  it('trims the name and keeps a valid number', () => {
    expect(sanitizeSaga({ name: '  Nacidos   de la bruma ', number: 2 })).toEqual({ name: 'Nacidos de la bruma', number: 2 });
    expect(sanitizeSaga({ name: 'Interludio', number: 0.5 })).toEqual({ name: 'Interludio', number: 0.5 });
  });

  it('drops invalid numbers and unusable sagas', () => {
    expect(sanitizeSaga({ name: 'X', number: 0 })).toEqual({ name: 'X' });
    expect(sanitizeSaga({ name: 'X', number: -1 })).toEqual({ name: 'X' });
    expect(sanitizeSaga({ name: 'X', number: '2' })).toEqual({ name: 'X' });
    expect(sanitizeSaga({ name: '   ' })).toBeUndefined();
    expect(sanitizeSaga({ number: 2 })).toBeUndefined();
    expect(sanitizeSaga('Mistborn')).toBeUndefined();
    expect(sanitizeSaga(null)).toBeUndefined();
  });

  it('caps very long names', () => {
    expect(sanitizeSaga({ name: 'a'.repeat(500) })!.name).toHaveLength(120);
  });
});

describe('sagaKey', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(sagaKey('  El  Imperio FINAL ')).toBe(sagaKey('el imperio final'));
    expect(sagaKey('Canción de hielo y fuego')).toBe(sagaKey('cancion de hielo y fuego'));
    expect(sagaKey('A')).not.toBe(sagaKey('B'));
  });
});

describe('sagaLabel', () => {
  it('shows the number when there is one', () => {
    expect(sagaLabel({ saga: { name: 'Mistborn', number: 2 } })).toBe('Mistborn · #2');
    expect(sagaLabel({ saga: { name: 'Mistborn' } })).toBe('Mistborn');
    expect(sagaLabel({})).toBeUndefined();
  });
});

describe('sagasOf', () => {
  it('groups spellings of the same saga and orders books by number, unnumbered last', () => {
    const sagas = sagasOf([
      book('Tres', { name: 'mistborn', number: 3 }),
      book('Interludio', { name: 'Mistborn' }),
      book('Uno', { name: 'Mistborn', number: 1 }),
      book('Suelto'),
      book('Otro', { name: 'Dune', number: 1 }),
    ]);
    expect(sagas.map((s) => s.name)).toEqual(['Dune', 'mistborn']);
    expect(sagas[1].books.map((b) => b.title)).toEqual(['Uno', 'Tres', 'Interludio']);
  });

  it('counts finished books and ignores non-books', () => {
    const sagas = sagasOf([
      book('Uno', { name: 'S', number: 1 }, { status: 'completed' }),
      book('Dos', { name: 'S', number: 2 }),
      book('Película', { name: 'S' }, { type: 'movie' }),
    ]);
    expect(sagas).toHaveLength(1);
    expect(sagas[0].books).toHaveLength(2);
    expect(sagas[0].completed).toBe(1);
  });
});

describe('nextBook', () => {
  it('is the first book in order that is not finished or abandoned', () => {
    const [saga] = sagasOf([
      book('Uno', { name: 'S', number: 1 }, { status: 'completed' }),
      book('Dos', { name: 'S', number: 2 }, { status: 'abandoned' }),
      book('Tres', { name: 'S', number: 3 }, { status: 'in_progress' }),
      book('Cuatro', { name: 'S', number: 4 }),
    ]);
    expect(nextBook(saga)?.title).toBe('Tres');
  });

  it('is undefined when the whole saga is finished', () => {
    const [saga] = sagasOf([book('Uno', { name: 'S', number: 1 }, { status: 'completed' })]);
    expect(nextBook(saga)).toBeUndefined();
  });
});

describe('suggestSagas', () => {
  const items = [book('a', { name: 'Mistborn' }), book('b', { name: 'Los Juegos del Hambre' }), book('c', { name: 'Hambre de lobos' })];

  it('lists existing sagas without a query', () => {
    expect(suggestSagas(items, '')).toEqual(['Hambre de lobos', 'Los Juegos del Hambre', 'Mistborn']);
  });

  it('matches anywhere in the name, prefix first, ignoring accents and case', () => {
    expect(suggestSagas(items, 'hambre')).toEqual(['Hambre de lobos', 'Los Juegos del Hambre']);
  });

  it('does not suggest what is already typed in full', () => {
    expect(suggestSagas(items, 'mistborn')).toEqual([]);
  });
});

describe('form fields', () => {
  it('parses the number, accepting a decimal comma', () => {
    expect(parseSagaNumber('2')).toBe(2);
    expect(parseSagaNumber(' 0,5 ')).toBe(0.5);
    expect(parseSagaNumber('0')).toBeUndefined();
    expect(parseSagaNumber('-1')).toBeUndefined();
    expect(parseSagaNumber('abc')).toBeUndefined();
    expect(parseSagaNumber('')).toBeUndefined();
  });

  it('builds the saga to save, or none when the name is empty', () => {
    expect(buildSaga(' Mistborn ', '2')).toEqual({ name: 'Mistborn', number: 2 });
    expect(buildSaga('Mistborn', '')).toEqual({ name: 'Mistborn' });
    expect(buildSaga('  ', '2')).toBeUndefined();
  });

  it('proposes the next number in an existing saga', () => {
    const items = [book('Uno', { name: 'Mistborn', number: 1 }), book('Dos', { name: 'mistborn', number: 2 }), book('Medio', { name: 'Mistborn', number: 2.5 })];
    expect(nextSagaNumber(items, 'MISTBORN')).toBe(3);
    expect(nextSagaNumber(items, 'Dune')).toBe(1);
    expect(nextSagaNumber([book('Sin número', { name: 'Dune' })], 'Dune')).toBe(1);
  });
});
