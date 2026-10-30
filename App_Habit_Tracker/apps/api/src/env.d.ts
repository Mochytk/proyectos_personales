// Secrets and dashboard settings. `wrangler types` only sees wrangler.jsonc, so these are
// declared by hand and merged into the generated Env. Values live in .dev.vars locally and
// in the Cloudflare dashboard, never in the repo.
interface Env {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  // Comma-separated host patterns, e.g. `localhost:*` (ADR 0010).
  AUTH_ALLOWED_HOSTS: string;
  // Sign-up stays closed unless this is exactly "true" (ADR 0005).
  AUTH_SIGNUP_ENABLED?: string;
}
