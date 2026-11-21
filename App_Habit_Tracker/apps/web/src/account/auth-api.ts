// Calls Better Auth's endpoints with plain fetch, instead of its client, to keep the
// bundle small (phase 2 plan, task 9). Same origin, so the session cookie goes along.

const BASE = '/api/auth';
const TIMEOUT_MS = 15_000;

export type AuthFailure =
  'invalid_credentials' | 'too_many_requests' | 'expired_token' | 'offline' | 'unknown';

export type AuthResult<T = undefined> = { ok: true; data: T } | { ok: false; error: AuthFailure };

export interface Session {
  email: string;
}

async function call(path: string, init: RequestInit = {}): Promise<Response | 'offline'> {
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // No network, or no answer within 15 s.
    return 'offline';
  }
}

async function failure(response: Response | 'offline'): Promise<AuthFailure> {
  if (response === 'offline') return 'offline';
  if (response.status === 429) return 'too_many_requests';
  if (response.status === 401) return 'invalid_credentials';
  const body = (await response.json().catch(() => ({}))) as { code?: unknown };
  if (body.code === 'INVALID_TOKEN') return 'expired_token';
  if (body.code === 'INVALID_PASSWORD' || body.code === 'INVALID_EMAIL_OR_PASSWORD') {
    return 'invalid_credentials';
  }
  return 'unknown';
}

async function post(path: string, body: unknown): Promise<AuthResult> {
  const response = await call(path, { method: 'POST', body: JSON.stringify(body) });
  if (response !== 'offline' && response.ok) return { ok: true, data: undefined };
  return { ok: false, error: await failure(response) };
}

// null when nobody is signed in.
export async function getSession(): Promise<AuthResult<Session | null>> {
  const response = await call('/get-session');
  if (response === 'offline' || !response.ok) return { ok: false, error: await failure(response) };
  const body = (await response.json().catch(() => undefined)) as
    { user?: { email?: unknown } } | null | undefined;
  if (body === undefined) return { ok: false, error: 'unknown' };
  const email = body?.user?.email;
  return { ok: true, data: typeof email === 'string' ? { email } : null };
}

export function signIn(email: string, password: string): Promise<AuthResult> {
  return post('/sign-in/email', { email, password });
}

export function signOut(): Promise<AuthResult> {
  return post('/sign-out', {});
}

// Every session of the account, this one included.
export function revokeAllSessions(): Promise<AuthResult> {
  return post('/revoke-sessions', {});
}

export function changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
  return post('/change-password', { currentPassword, newPassword, revokeOtherSessions: true });
}

// The emailed link goes through the Worker, which checks the token and sends the browser
// on to /restablecer?token=… (or ?error=INVALID_TOKEN).
export function requestReset(email: string): Promise<AuthResult> {
  return post('/request-password-reset', { email, redirectTo: '/restablecer' });
}

export function resetPassword(token: string, newPassword: string): Promise<AuthResult> {
  return post('/reset-password', { token, newPassword });
}

export const AUTH_MESSAGES: Record<AuthFailure, string> = {
  invalid_credentials: 'El correo o la contraseña no coinciden.',
  too_many_requests: 'Demasiados intentos. Espera unos segundos.',
  expired_token: 'El enlace venció. Pide uno nuevo.',
  offline: 'Sin conexión. Inténtalo de nuevo cuando vuelva la señal.',
  unknown: 'No pudimos completar esto. Intenta de nuevo.',
};
