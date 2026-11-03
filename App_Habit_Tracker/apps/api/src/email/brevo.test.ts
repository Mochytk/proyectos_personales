import { describe, expect, it } from 'vitest';
import { brevoSender } from './brevo';

const ENV = { BREVO_API_KEY: 'xkeysib-test-key', EMAIL_FROM: 'remitente@example.com' };
const MESSAGE = { to: 'tu@example.com', subject: 'Asunto', text: 'Cuerpo del correo' };

function fakeFetch(response: Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), init: init ?? {} });
    return Promise.resolve(response);
  };
  return { calls, fetchImpl };
}

describe('brevoSender', () => {
  it('posts a plain-text transactional email to Brevo', async () => {
    const { calls, fetchImpl } = fakeFetch(
      Response.json({ messageId: '<id@relay>' }, { status: 201 }),
    );
    await brevoSender(ENV, fetchImpl).send(MESSAGE);

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(call?.init.method).toBe('POST');
    const headers = new Headers(call?.init.headers);
    expect(headers.get('api-key')).toBe('xkeysib-test-key');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe('application/json');
    expect(JSON.parse(call?.init.body as string)).toEqual({
      sender: { name: 'Constancia', email: 'remitente@example.com' },
      to: [{ email: 'tu@example.com' }],
      subject: 'Asunto',
      textContent: 'Cuerpo del correo',
    });
  });

  it('throws when Brevo does not answer 2xx, without the key in the error', async () => {
    const { fetchImpl } = fakeFetch(
      Response.json({ code: 'unauthorized', message: 'Key not found' }, { status: 401 }),
    );
    const sending = brevoSender(ENV, fetchImpl).send(MESSAGE);

    await expect(sending).rejects.toThrow('Brevo answered 401 (unauthorized)');
    await sending.catch((error: unknown) => {
      expect(String(error)).not.toContain('xkeysib-test-key');
    });
  });

  it('still throws a clear error when the error body is not JSON', async () => {
    const { fetchImpl } = fakeFetch(new Response('Bad gateway', { status: 502 }));
    await expect(brevoSender(ENV, fetchImpl).send(MESSAGE)).rejects.toThrow(
      'Brevo answered 502 (unknown)',
    );
  });
});
