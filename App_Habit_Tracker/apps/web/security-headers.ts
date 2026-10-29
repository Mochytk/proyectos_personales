// Security headers for the web app's static files (ADR 0003, 0010). Written into the
// build as Cloudflare's `_headers` file and also sent by `vite preview`, so the E2E tests
// run under the same CSP. Responses from the Worker (/api/*) set their own headers.
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export function headersFile(headers: Record<string, string>): string {
  const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
  return ['/*', ...lines, ''].join('\n');
}
