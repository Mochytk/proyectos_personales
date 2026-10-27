import { z } from 'zod';

// Maps a validation error to one message per top-level field, for forms. The first
// message wins, as the schema lists the most basic rule first.
export function fieldErrors(error: unknown): Record<string, string> | null {
  if (!(error instanceof z.ZodError)) return null;
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '');
    errors[field] ??= issue.message;
  }
  return errors;
}
