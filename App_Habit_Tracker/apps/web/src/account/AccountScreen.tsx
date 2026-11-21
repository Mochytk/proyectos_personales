import { useEffect, useId, useState, type SubmitEvent } from 'react';
import {
  AUTH_MESSAGES,
  changePassword,
  getSession,
  requestReset,
  revokeAllSessions,
  signIn,
  signOut,
  signUp,
  type AuthFailure,
  type AuthResult,
  type Session,
} from './auth-api';
import { announceSessionChange } from './session-events';

type SessionState =
  | { status: 'loading' }
  | { status: 'error'; error: AuthFailure }
  | {
      status: 'ready';
      session: Session | null;
    };

// Runs one auth call at a time and keeps its error or success message.
function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async (action: () => Promise<AuthResult>): Promise<boolean> => {
    if (pending) return false;
    setPending(true);
    setError(null);
    setDone(false);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      setError(AUTH_MESSAGES[result.error]);
      return false;
    }
    setDone(true);
    return true;
  };
  return { pending, error, done, run };
}

function ErrorText({ message }: { message: string | null }) {
  return message === null ? null : (
    <p className="field-error" role="alert">
      {message}
    </p>
  );
}

function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [open, setOpen] = useState<'forgot' | 'create' | null>(null);
  const action = useAction();

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await action.run(() => signIn(email.trim(), password))) {
      setPassword('');
      onSignedIn();
    }
  };

  return (
    <>
      <form className="form" onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor={`${id}-email`}>Correo</label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-password`}>Contraseña</label>
          <input
            id={`${id}-password`}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />
        </div>
        <ErrorText message={action.error} />
        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={action.pending}>
            Iniciar sesión
          </button>
          <button
            type="button"
            className="button"
            aria-expanded={open === 'forgot'}
            onClick={() => {
              setOpen((current) => (current === 'forgot' ? null : 'forgot'));
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
          <button
            type="button"
            className="button"
            aria-expanded={open === 'create'}
            onClick={() => {
              setOpen((current) => (current === 'create' ? null : 'create'));
            }}
          >
            Crear cuenta
          </button>
        </div>
      </form>
      {open === 'forgot' ? <ForgotPasswordForm initialEmail={email} /> : null}
      {open === 'create' ? <CreateAccountForm onSignedIn={onSignedIn} /> : null}
    </>
  );
}

// For the one account this app has: it only works while sign-up is open in Cloudflare.
function CreateAccountForm({ onSignedIn }: { onSignedIn: () => void }) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const action = useAction();

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await action.run(() => signUp(email.trim(), password))) {
      setPassword('');
      onSignedIn();
    }
  };

  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <div className="field">
        <label htmlFor={`${id}-email`}>Correo para la cuenta</label>
        <input
          id={`${id}-email`}
          name="new-email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-password`}>Contraseña para la cuenta</label>
        <input
          id={`${id}-password`}
          name="new-account-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          aria-describedby={`${id}-password-help`}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
        <p className="field-note" id={`${id}-password-help`}>
          Al menos 12 caracteres.
        </p>
      </div>
      <ErrorText message={action.error} />
      <div className="form-actions">
        <button type="submit" className="button" disabled={action.pending}>
          Crear la cuenta
        </button>
      </div>
    </form>
  );
}

function ForgotPasswordForm({ initialEmail }: { initialEmail: string }) {
  const id = useId();
  const [email, setEmail] = useState(initialEmail);
  const action = useAction();

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    await action.run(() => requestReset(email.trim()));
  };

  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <div className="field">
        <label htmlFor={`${id}-email`}>Correo de tu cuenta</label>
        <input
          id={`${id}-email`}
          name="reset-email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      </div>
      <ErrorText message={action.error} />
      {action.done ? (
        <p className="field-note" role="status">
          Si el correo tiene cuenta, te llegará un enlace que vence en 1 hora.
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="button" disabled={action.pending}>
          Enviar enlace
        </button>
      </div>
    </form>
  );
}

function ChangePasswordForm() {
  const id = useId();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const action = useAction();

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await action.run(() => changePassword(current, next))) {
      setCurrent('');
      setNext('');
    }
  };

  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <h2 className="page-subtitle">Cambiar contraseña</h2>
      <div className="field">
        <label htmlFor={`${id}-current`}>Contraseña actual</label>
        <input
          id={`${id}-current`}
          name="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(event) => {
            setCurrent(event.target.value);
          }}
        />
      </div>
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
          value={next}
          onChange={(event) => {
            setNext(event.target.value);
          }}
        />
        <p className="field-note" id={`${id}-new-help`}>
          Al menos 12 caracteres.
        </p>
      </div>
      <ErrorText message={action.error} />
      {action.done ? (
        <p className="field-note" role="status">
          Contraseña cambiada. Las otras sesiones se cerraron.
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="button" disabled={action.pending}>
          Cambiar contraseña
        </button>
      </div>
    </form>
  );
}

function SignedIn({ session, onSignedOut }: { session: Session; onSignedOut: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const action = useAction();

  const leave = async (call: () => Promise<AuthResult>) => {
    if (await action.run(call)) onSignedOut();
  };

  return (
    <>
      <p>Sesión iniciada como {session.email}</p>
      <ErrorText message={action.error} />
      <div className="form-actions">
        <button
          type="button"
          className="button"
          disabled={action.pending}
          onClick={() => void leave(signOut)}
        >
          Cerrar sesión
        </button>
        {confirming ? null : (
          <button
            type="button"
            className="button"
            onClick={() => {
              setConfirming(true);
            }}
          >
            Cerrar sesión en todos los dispositivos
          </button>
        )}
      </div>
      {confirming ? (
        <div className="form" role="group" aria-label="Confirmar">
          <p>Se cerrará la sesión aquí y en tus otros dispositivos.</p>
          <div className="form-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={action.pending}
              onClick={() => void leave(revokeAllSessions)}
            >
              Sí, cerrar todas
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      <ChangePasswordForm />
    </>
  );
}

// The app works without an account; the account only syncs your devices.
export function AccountScreen() {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void getSession().then((result) => {
      if (!active) return;
      setState(
        result.ok
          ? { status: 'ready', session: result.data }
          : { status: 'error', error: result.error },
      );
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = () => {
    setAttempt((n) => n + 1);
  };

  const changed = () => {
    announceSessionChange();
    reload();
  };

  return (
    <>
      <h1 className="page-title">Cuenta</h1>
      <p className="page-subtitle">
        La app funciona sin cuenta. La cuenta sirve para sincronizar tus dispositivos.
      </p>
      {state.status === 'loading' ? (
        <p className="async-loading" role="status">
          Cargando…
        </p>
      ) : state.status === 'error' ? (
        <div className="async-problem" role="alert">
          <p>{AUTH_MESSAGES[state.error]}</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setState({ status: 'loading' });
              reload();
            }}
          >
            Reintentar
          </button>
        </div>
      ) : state.session ? (
        <SignedIn session={state.session} onSignedOut={changed} />
      ) : (
        <SignInForm onSignedIn={changed} />
      )}
    </>
  );
}
