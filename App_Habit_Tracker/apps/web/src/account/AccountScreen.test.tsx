import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeFetch, json, offline } from '../test/fake-fetch';
import { renderRoute } from '../test/render';

const SIGNED_IN = { user: { email: 'tu@example.com' }, session: {} };

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillSignIn(user: Awaited<ReturnType<typeof renderRoute>>['user']) {
  await user.type(await screen.findByLabelText('Correo'), 'tu@example.com');
  await user.type(screen.getByLabelText('Contraseña'), 'correct horse battery');
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

describe('AccountScreen', () => {
  it('signs in and shows who is signed in', async () => {
    let signedIn = false;
    const { calls } = fakeFetch({
      'GET /api/auth/get-session': () => json(signedIn ? SIGNED_IN : null),
      'POST /api/auth/sign-in/email': () => {
        signedIn = true;
        return json({ token: 'x' });
      },
    });
    const { user } = await renderRoute('/cuenta');
    await fillSignIn(user);

    expect(await screen.findByText('Sesión iniciada como tu@example.com')).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/auth/sign-in/email')?.body).toEqual({
      email: 'tu@example.com',
      password: 'correct horse battery',
    });
  });

  it('says when there were too many attempts', async () => {
    fakeFetch({
      'GET /api/auth/get-session': () => json(null),
      'POST /api/auth/sign-in/email': () => json({ message: 'Too many requests' }, 429),
    });
    const { user } = await renderRoute('/cuenta');
    await fillSignIn(user);
    expect(await screen.findByText('Demasiados intentos. Espera unos segundos.')).toBeTruthy();
  });

  it('says when there is no connection', async () => {
    fakeFetch({
      'GET /api/auth/get-session': () => json(null),
      'POST /api/auth/sign-in/email': offline,
    });
    const { user } = await renderRoute('/cuenta');
    await fillSignIn(user);
    expect(
      await screen.findByText('Sin conexión. Inténtalo de nuevo cuando vuelva la señal.'),
    ).toBeTruthy();
  });

  it('asks before signing out on every device', async () => {
    let signedIn = true;
    const { calls } = fakeFetch({
      'GET /api/auth/get-session': () => json(signedIn ? SIGNED_IN : null),
      'POST /api/auth/revoke-sessions': () => {
        signedIn = false;
        return json({ status: true });
      },
    });
    const { user } = await renderRoute('/cuenta');
    await user.click(
      await screen.findByRole('button', { name: 'Cerrar sesión en todos los dispositivos' }),
    );
    expect(calls.some((c) => c.key === 'POST /api/auth/revoke-sessions')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Sí, cerrar todas' }));
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeTruthy();
    expect(calls.some((c) => c.key === 'POST /api/auth/revoke-sessions')).toBe(true);
  });

  it('changes the password and closes the other sessions', async () => {
    const { calls } = fakeFetch({
      'GET /api/auth/get-session': () => json(SIGNED_IN),
      'POST /api/auth/change-password': () => json({ token: 'y' }),
    });
    const { user } = await renderRoute('/cuenta');
    await user.type(await screen.findByLabelText('Contraseña actual'), 'correct horse battery');
    await user.type(screen.getByLabelText('Contraseña nueva'), 'a brand new passphrase');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(
      await screen.findByText('Contraseña cambiada. Las otras sesiones se cerraron.'),
    ).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/auth/change-password')?.body).toEqual({
      currentPassword: 'correct horse battery',
      newPassword: 'a brand new passphrase',
      revokeOtherSessions: true,
    });
  });

  it('asks for a reset link without saying whether the address has an account', async () => {
    const { calls } = fakeFetch({
      'GET /api/auth/get-session': () => json(null),
      'POST /api/auth/request-password-reset': () => json({ status: true }),
    });
    const { user } = await renderRoute('/cuenta');
    await user.click(await screen.findByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    await user.type(screen.getByLabelText('Correo de tu cuenta'), 'tu@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(
      await screen.findByText(
        'Si el correo tiene cuenta, te llegará un enlace que vence en 1 hora.',
      ),
    ).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/auth/request-password-reset')?.body).toEqual({
      email: 'tu@example.com',
      redirectTo: '/restablecer',
    });
  });
});

describe('ResetPasswordScreen', () => {
  it('sets the new password with the token from the link', async () => {
    const { calls } = fakeFetch({
      'POST /api/auth/reset-password': () => json({ status: true }),
    });
    const { user } = await renderRoute('/restablecer?token=abc123');
    await user.type(await screen.findByLabelText('Contraseña nueva'), 'a brand new passphrase');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(await screen.findByText('Listo. Inicia sesión con tu contraseña nueva.')).toBeTruthy();
    expect(calls[0]?.body).toEqual({ token: 'abc123', newPassword: 'a brand new passphrase' });
  });

  it('says the link expired when the token no longer works', async () => {
    fakeFetch({
      'POST /api/auth/reset-password': () =>
        json({ code: 'INVALID_TOKEN', message: 'Invalid token' }, 400),
    });
    const { user } = await renderRoute('/restablecer?token=old');
    await user.type(await screen.findByLabelText('Contraseña nueva'), 'a brand new passphrase');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('El enlace venció. Pide uno nuevo.')).toBeTruthy();
  });

  it('says the link expired when the Worker already rejected it', async () => {
    fakeFetch({});
    await renderRoute('/restablecer?error=INVALID_TOKEN');
    expect(await screen.findByText('El enlace venció. Pide uno nuevo.')).toBeTruthy();
    expect(screen.queryByLabelText('Contraseña nueva')).toBeNull();
  });
});
