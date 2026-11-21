import { useId, useState, type SubmitEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AUTH_MESSAGES, resetPassword } from './auth-api';

// Where the emailed link lands: the Worker checked the token and passed it along, or sent
// ?error=INVALID_TOKEN when it had already expired or been used.
export function ResetPasswordScreen() {
  const id = useId();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    token === null || params.get('error') !== null ? AUTH_MESSAGES.expired_token : null,
  );
  const [done, setDone] = useState(false);
  const usable = token !== null && params.get('error') === null;

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!usable || pending) return;
    setPending(true);
    setError(null);
    const result = await resetPassword(token, password);
    setPending(false);
    if (result.ok) setDone(true);
    else setError(AUTH_MESSAGES[result.error]);
  };

  return (
    <>
      <h1 className="page-title">Restablecer contraseña</h1>
      {done ? (
        <p role="status">Listo. Inicia sesión con tu contraseña nueva.</p>
      ) : usable ? (
        <form className="form" onSubmit={(event) => void submit(event)}>
          <div className="field">
            <label htmlFor={`${id}-new`}>Contraseña nueva</label>
            <input
              id={`${id}-new`}
              name="new-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              aria-describedby={`${id}-new-help`}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />
            <p className="field-note" id={`${id}-new-help`}>
              Al menos 12 caracteres.
            </p>
          </div>
          {error === null ? null : (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={pending}>
              Guardar contraseña
            </button>
          </div>
        </form>
      ) : (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <p>
        <Link to="/cuenta">Ir a la cuenta</Link>
      </p>
    </>
  );
}
