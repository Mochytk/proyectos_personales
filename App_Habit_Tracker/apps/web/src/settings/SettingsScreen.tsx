import { formatDisplayDate, type StyleSetting } from '@habit-tracker/shared';
import { useState } from 'react';
import { useToday } from '../app/useToday';
import { useDb } from '../db/DatabaseProvider';
import { updateSettings, type SettingsPatch } from '../db/settings-repo';
import { AsyncState } from '../ui/AsyncState';
import { useTimedLiveQuery } from '../ui/useTimedLiveQuery';

const CUTOFF_HOURS = [0, 1, 2, 3, 4, 5, 6];

const STYLES: { value: StyleSetting; label: string }[] = [
  { value: 'cuaderno', label: 'Cuaderno' },
  { value: 'linea', label: 'Línea' },
  { value: 'disco', label: 'Disco' },
  { value: 'rotate', label: 'Rotar cada semana' },
];

function timeZones(current: string): string[] {
  const zones = Intl.supportedValuesOf('timeZone');
  return zones.includes(current) ? zones : [current, ...zones];
}

// Every change is saved as soon as it is made; there is no "Guardar" here.
export function SettingsScreen() {
  const db = useDb();
  const today = useToday();
  const query = useTimedLiveQuery(() => db.userSettings.toCollection().first(), [db]);
  // A change shows at once, until the saved row moves on from the version it was made on.
  const [pending, setPending] = useState<{ patch: SettingsPatch; base: string } | null>(null);
  const saved = query.data;
  const settings =
    saved && (pending?.base === saved.updatedAt ? { ...saved, ...pending.patch } : saved);

  const save = (patch: SettingsPatch) => {
    if (!saved) return;
    setPending((current) => ({
      patch: { ...(current?.base === saved.updatedAt ? current.patch : {}), ...patch },
      base: saved.updatedAt,
    }));
    void updateSettings(db, patch);
  };

  return (
    <>
      <h1 className="page-title">Ajustes</h1>
      <AsyncState status={query.state} onRetry={query.retry}>
        {settings ? (
          <div className="form">
            <div className="field">
              <label htmlFor="day-cutoff">Hora de corte</label>
              <select
                id="day-cutoff"
                value={settings.dayCutoffHour}
                aria-describedby="day-cutoff-help"
                onChange={(event) => {
                  save({ dayCutoffHour: Number(event.target.value) });
                }}
              >
                {CUTOFF_HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {`${String(hour).padStart(2, '0')}:00`}
                  </option>
                ))}
              </select>
              <p className="field-note" id="day-cutoff-help">
                Lo que marques antes de esta hora cuenta para el día anterior.
              </p>
              <p className="field-note" role="status">
                Ahora cuenta como el {formatDisplayDate(today)}.
              </p>
            </div>

            <div className="field">
              <label htmlFor="time-zone">Zona horaria</label>
              <select
                id="time-zone"
                value={settings.timeZone}
                aria-describedby="time-zone-help"
                onChange={(event) => {
                  save({ timeZone: event.target.value });
                }}
              >
                {timeZones(settings.timeZone).map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
              <p className="field-note" id="time-zone-help">
                Cambiarla solo afecta a los registros nuevos.
              </p>
            </div>

            <fieldset className="field">
              <legend id="style-legend">Estilo</legend>
              <div className="choices" role="radiogroup" aria-labelledby="style-legend">
                {STYLES.map((style) => (
                  <label key={style.value} className="choice">
                    <input
                      type="radio"
                      name="style"
                      value={style.value}
                      checked={settings.style === style.value}
                      onChange={() => {
                        save({ style: style.value });
                      }}
                    />
                    {style.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}
      </AsyncState>
    </>
  );
}
