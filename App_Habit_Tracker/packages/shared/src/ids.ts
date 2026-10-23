import type { LocalDate } from './dates/local-date';

// Namespace for every deterministic id in the app. Never change it: existing rows
// would get new ids and devices would stop agreeing on them (ADR 0006).
export const APP_ID_NAMESPACE = '5365024d-226c-481c-8826-894bea6cb2b7';

export type SeedKind = 'anchor' | 'exercise' | 'routine' | 'metric_type' | 'user_settings';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidToBytes(uuid: string): Uint8Array {
  if (!UUID_PATTERN.test(uuid)) throw new RangeError(`Not a UUID: ${uuid}`);
  const hex = uuid.replaceAll('-', '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

// Name-based UUID (RFC 9562, section 5.5): SHA-1 of namespace + name,
// stamped with version 5 and the RFC variant. Async because Web Crypto is.
export async function uuidV5(name: string, namespace: string): Promise<string> {
  const namespaceBytes = uuidToBytes(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(namespaceBytes.length + nameBytes.length);
  input.set(namespaceBytes);
  input.set(nameBytes, namespaceBytes.length);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', input)).slice(0, 16);
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;
  return bytesToUuid(hash);
}

// The names below are part of the sync contract: every device must build them the same way.
export function checkInId(habitId: string, date: LocalDate): Promise<string> {
  return uuidV5(`check_in:${habitId}:${date}`, APP_ID_NAMESPACE);
}

export function quotaOverrideId(habitId: string, weekStart: LocalDate): Promise<string> {
  return uuidV5(`quota:${habitId}:${weekStart}`, APP_ID_NAMESPACE);
}

export function weeklyReviewId(weekStart: LocalDate): Promise<string> {
  return uuidV5(`review:${weekStart}`, APP_ID_NAMESPACE);
}

export function seedId(kind: SeedKind, slug: string): Promise<string> {
  return uuidV5(`${kind}:${slug}`, APP_ID_NAMESPACE);
}
