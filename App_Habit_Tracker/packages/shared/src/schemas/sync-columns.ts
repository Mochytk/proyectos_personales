import { z } from 'zod';
import { isoWeekday } from '../dates/calendar';
import { parseLocalDate } from '../dates/local-date';

// The web app runs under a strict CSP without 'unsafe-eval'. Zod's JIT would probe
// `new Function`, which the browser reports as a violation even though Zod catches it.
z.config({ jitless: true });

// Columns every synced row carries (ADR 0006). user_id and server_seq live only on the server.
export const syncColumns = {
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
};

export const localDateSchema = z.string().transform((value, ctx) => {
  try {
    return parseLocalDate(value);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Fecha inválida.', input: value });
    return z.NEVER;
  }
});

export const weekStartSchema = localDateSchema.refine((date) => isoWeekday(date) === 1, {
  message: 'La semana empieza el lunes.',
});
