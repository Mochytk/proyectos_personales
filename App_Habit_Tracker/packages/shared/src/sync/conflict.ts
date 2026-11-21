// Conflict rule for synced rows (ADR 0006): the last edit wins, by the device's updatedAt.

const MAX_AHEAD_MS = 5 * 60 * 1000;

// A tie goes to the incoming row: it reached the server last, so it gets the higher
// server_seq. An identical row is a no-op, which the server checks separately.
export function wins(
  incoming: { updatedAt: string },
  existing: { updatedAt: string } | undefined,
): boolean {
  if (existing === undefined) return true;
  return Date.parse(incoming.updatedAt) >= Date.parse(existing.updatedAt);
}

// A device whose clock runs ahead must not win every conflict from then on.
export function clampUpdatedAt(updatedAt: string, now: Date): string {
  const limit = now.getTime() + MAX_AHEAD_MS;
  return Date.parse(updatedAt) > limit ? new Date(limit).toISOString() : updatedAt;
}
