import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth/minimal';
import type { Db } from '../db/client';
import * as schema from '../db/schema';

export type AuthEnv = Pick<
  Env,
  'BETTER_AUTH_SECRET' | 'AUTH_ALLOWED_HOSTS' | 'AUTH_SIGNUP_ENABLED'
>;

const DAY = 60 * 60 * 24;

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

// Built per request: a Worker gets its env and database with each request (ADR 0005).
// `requestUrl` decides the cookie's Secure flag, which Better Auth would otherwise tie to
// NODE_ENV, unreliable in a Worker: Secure everywhere except plain-HTTP localhost.
export function createAuth(env: AuthEnv, db: Db, requestUrl: string) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: { allowedHosts: env.AUTH_ALLOWED_HOSTS.split(',').map((host) => host.trim()) },
    database: drizzleAdapter(db, { provider: 'pg', transaction: true, schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      disableSignUp: env.AUTH_SIGNUP_ENABLED !== 'true',
    },
    // 30 days, renewed at most once a day while in use (ADR 0010).
    session: { expiresIn: 30 * DAY, updateAge: DAY },
    // Kept in Postgres: a Worker's memory does not outlive the request. The default rules
    // allow 3 sign-in attempts per 10 s for each IP.
    rateLimit: { enabled: true, storage: 'database' },
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      useSecureCookies: !isLocalhost(new URL(requestUrl).hostname),
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
