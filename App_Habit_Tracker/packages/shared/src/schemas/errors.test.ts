import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fieldErrors } from './errors';

describe('fieldErrors', () => {
  const schema = z.object({
    name: z.string().min(1, 'Escribe un nombre.'),
    weekdays: z.array(z.number().max(7, 'Día inválido.')).min(1, 'Elige al menos un día.'),
  });

  it('keeps the first message of each top-level field', () => {
    const result = schema.safeParse({ name: '', weekdays: [9, 10] });
    expect(fieldErrors(result.error)).toEqual({
      name: 'Escribe un nombre.',
      weekdays: 'Día inválido.',
    });
  });

  it('returns null for anything that is not a validation error', () => {
    expect(fieldErrors(new Error('boom'))).toBeNull();
    expect(fieldErrors(undefined)).toBeNull();
  });
});
