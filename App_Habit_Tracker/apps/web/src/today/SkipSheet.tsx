import type { SkipReason } from '@habit-tracker/shared';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export const SKIP_REASONS: readonly { value: SkipReason; label: string }[] = [
  { value: 'certamen', label: 'Certamen' },
  { value: 'enfermedad', label: 'Enfermedad' },
  { value: 'viaje', label: 'Viaje' },
  { value: 'descanso', label: 'Descanso' },
  { value: 'otro', label: 'Otro' },
];

interface Props {
  title: string;
  withNote: boolean;
  onSkip: (reason: SkipReason, note: string | undefined) => Promise<void>;
  // Offered when the habit already has a record for today.
  onClear?: () => Promise<void>;
  onClose: () => void;
}

// A bottom sheet to skip one habit, or the whole day, with a reason. A skipped day
// does not break the streak (RF-1.3). Escape or the backdrop closes it.
export function SkipSheet({ title, withNote, onSkip, onClear, onClose }: Props) {
  const id = useId();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const firstReason = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    firstReason.current?.focus();
  }, []);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      onClose();
    }
  };

  // Escape closes; Tab stays inside the sheet while it is open.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialog.current) return;
    const focusable = [
      ...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), textarea'),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={dialog}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onClick={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={onKeyDown}
      >
        <h2 id={`${id}-title`} className="sheet-title">
          {title}
        </h2>
        <p className="sheet-help">Elige el motivo. Un día saltado no corta la racha.</p>
        {withNote ? (
          <div className="field">
            <label htmlFor={`${id}-note`}>Nota (opcional)</label>
            <textarea
              id={`${id}-note`}
              value={note}
              maxLength={280}
              rows={2}
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          </div>
        ) : null}
        <div className="sheet-reasons">
          {SKIP_REASONS.map((reason, index) => (
            <button
              key={reason.value}
              ref={index === 0 ? firstReason : undefined}
              type="button"
              className="button"
              disabled={busy}
              onClick={() =>
                void run(() => onSkip(reason.value, note.trim() === '' ? undefined : note))
              }
            >
              {reason.label}
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          {onClear ? (
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void run(onClear)}
            >
              Quitar el registro de hoy
            </button>
          ) : null}
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
