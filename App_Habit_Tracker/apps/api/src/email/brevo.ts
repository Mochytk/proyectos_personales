import type { EmailSender } from './sender';

const ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

// Brevo's transactional email REST API, without its SDK (ADR 0005). EMAIL_FROM must be a
// sender verified in Brevo; both values are secrets, never in the repo.
export function brevoSender(
  env: { BREVO_API_KEY: string; EMAIL_FROM: string },
  fetchImpl: typeof fetch = fetch,
): EmailSender {
  return {
    async send({ to, subject, text }) {
      const response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Constancia', email: env.EMAIL_FROM },
          to: [{ email: to }],
          subject,
          textContent: text,
        }),
      });
      if (!response.ok) {
        // Only the status and Brevo's error code: never the key or the message body.
        const body = (await response.json().catch(() => ({}))) as { code?: unknown };
        const code = typeof body.code === 'string' ? body.code : 'unknown';
        throw new Error(`Brevo answered ${String(response.status)} (${code})`);
      }
    },
  };
}
