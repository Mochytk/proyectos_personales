import { z } from 'zod';
import type { IsoWeekday } from '../dates/calendar';
import { localDateSchema, syncColumns, weekStartSchema } from './sync-columns';

// Field rules follow docs/modelo-de-datos.md. Messages are user-facing (Chilean Spanish).

const nullableDatetime = z.iso.datetime().nullable();

function isKnownTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const styleSettingSchema = z.enum(['cuaderno', 'linea', 'disco', 'rotate']);
export type StyleSetting = z.infer<typeof styleSettingSchema>;

export const userSettingsSchema = z.object({
  ...syncColumns,
  timeZone: z.string().refine(isKnownTimeZone, { message: 'Zona horaria desconocida.' }),
  dayCutoffHour: z.number().int().min(0).max(6),
  style: styleSettingSchema,
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const anchorSchema = z.object({
  ...syncColumns,
  name: z.string().trim().min(1, 'Escribe un nombre.').max(40, 'Máximo 40 caracteres.'),
  sortOrder: z.number().int(),
  archivedAt: nullableDatetime,
});
export type Anchor = z.infer<typeof anchorSchema>;

const isoWeekdaySchema = z
  .number()
  .int()
  .min(1)
  .max(7)
  .transform((day) => day as IsoWeekday);

export const habitModeSchema = z.enum(['daily', 'weekly_quota']);
export type HabitMode = z.infer<typeof habitModeSchema>;

export const habitSchema = z
  .object({
    ...syncColumns,
    name: z.string().trim().min(1, 'Escribe un nombre.').max(60, 'Máximo 60 caracteres.'),
    description: z.string().trim().max(280, 'Máximo 280 caracteres.').nullable(),
    mode: habitModeSchema,
    weeklyQuota: z.number().int().nullable(),
    weekdays: z
      .array(isoWeekdaySchema)
      .min(1, 'Elige al menos un día.')
      .refine((days) => new Set(days).size === days.length, { message: 'Hay días repetidos.' }),
    startsOn: localDateSchema,
    anchorId: z.uuid(),
    color: z.string().min(1).max(30),
    icon: z.string().max(40).nullable(),
    sortOrder: z.number().int(),
    archivedAt: nullableDatetime,
  })
  .superRefine((habit, ctx) => {
    if (habit.mode === 'weekly_quota') {
      const quota = habit.weeklyQuota;
      if (quota === null || quota < 1 || quota > 7) {
        ctx.addIssue({
          code: 'custom',
          path: ['weeklyQuota'],
          message: 'Indica cuántas veces por semana (1 a 7).',
          input: quota,
        });
      }
    } else if (habit.weeklyQuota !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['weeklyQuota'],
        message: 'Un hábito diario no lleva cuota semanal.',
        input: habit.weeklyQuota,
      });
    }
  });
export type Habit = z.infer<typeof habitSchema>;

export const checkInStatusSchema = z.enum(['done', 'skipped']);
export type CheckInStatus = z.infer<typeof checkInStatusSchema>;

export const skipReasonSchema = z.enum(['certamen', 'enfermedad', 'viaje', 'descanso', 'otro']);
export type SkipReason = z.infer<typeof skipReasonSchema>;

export const checkInSchema = z
  .object({
    ...syncColumns,
    habitId: z.uuid(),
    localDate: localDateSchema,
    status: checkInStatusSchema,
    skipReason: skipReasonSchema.nullable(),
    note: z.string().trim().max(280, 'Máximo 280 caracteres.').nullable(),
    // Reserved for numeric goals (hours slept, wake-up time); no UI in v1.
    value: z.number().nullable(),
  })
  .superRefine((checkIn, ctx) => {
    if (checkIn.status === 'done' && checkIn.skipReason !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['skipReason'],
        message: 'Solo un día saltado lleva motivo.',
        input: checkIn.skipReason,
      });
    }
  });
export type CheckIn = z.infer<typeof checkInSchema>;

export const weeklyQuotaOverrideSchema = z.object({
  ...syncColumns,
  habitId: z.uuid(),
  weekStart: weekStartSchema,
  quota: z.number().int().min(0).max(7),
});
export type WeeklyQuotaOverride = z.infer<typeof weeklyQuotaOverrideSchema>;

export const weeklyReviewSchema = z.object({
  ...syncColumns,
  weekStart: weekStartSchema,
  reflection: z.string().trim().max(2000, 'Máximo 2000 caracteres.').nullable(),
  completedAt: nullableDatetime,
});
export type WeeklyReview = z.infer<typeof weeklyReviewSchema>;
