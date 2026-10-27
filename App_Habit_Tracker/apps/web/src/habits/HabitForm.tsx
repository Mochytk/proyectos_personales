import { fieldErrors, type Anchor, type Habit, type IsoWeekday } from '@habit-tracker/shared';
import { useId, useRef, useState, type SubmitEvent } from 'react';
import { Link } from 'react-router';
import type { NewHabit } from '../db/habits-repo';
import { WEEKDAYS } from './schedule-label';

export type HabitValues = Pick<
  NewHabit,
  'name' | 'description' | 'mode' | 'weeklyQuota' | 'weekdays' | 'anchorId'
>;

interface Props {
  habit?: Habit;
  anchors: Anchor[];
  hasCheckIns: boolean;
  onSave: (values: HabitValues) => Promise<void>;
}

const ALL_DAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

// In the order they appear, so focus lands on the first field with a problem.
const FIELD_ORDER = ['name', 'description', 'anchorId', 'weekdays', 'weeklyQuota'];

function sameDays(a: readonly IsoWeekday[], b: readonly IsoWeekday[]): boolean {
  return a.length === b.length && a.every((day) => b.includes(day));
}

// Validation lives in the shared schema: the form shows the messages the repository's
// parse produces, so the rules are written once.
export function HabitForm({ habit, anchors, hasCheckIns, onSave }: Props) {
  const id = useId();
  const [name, setName] = useState(habit?.name ?? '');
  const [description, setDescription] = useState(habit?.description ?? '');
  const [anchorId, setAnchorId] = useState(habit?.anchorId ?? anchors[0]?.id ?? '');
  const [mode, setMode] = useState(habit?.mode ?? 'daily');
  const [weekdays, setWeekdays] = useState<IsoWeekday[]>(habit?.weekdays ?? ALL_DAYS);
  const [quota, setQuota] = useState(habit?.weeklyQuota?.toString() ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const daysChanged =
    habit !== undefined && mode === 'daily' && !sameDays(habit.weekdays, weekdays);

  const toggleDay = (day: IsoWeekday) => {
    setWeekdays((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b),
    );
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave({
        name,
        description: description.trim() === '' ? null : description,
        anchorId,
        mode,
        weekdays: mode === 'daily' ? weekdays : ALL_DAYS,
        weeklyQuota: mode === 'weekly_quota' && quota !== '' ? Number(quota) : null,
      });
    } catch (error) {
      const fields = fieldErrors(error);
      if (!fields) throw error;
      setErrors(fields);
      const first = FIELD_ORDER.find((field) => fields[field] !== undefined);
      if (first) document.getElementById(`${id}-${first}`)?.focus();
      savingRef.current = false;
      setSaving(false);
    }
  };

  const errorProps = (field: string) =>
    errors[field] === undefined
      ? {}
      : { 'aria-invalid': true, 'aria-describedby': `${id}-${field}-error` };
  const errorText = (field: string) =>
    errors[field] === undefined ? null : (
      <p className="field-error" id={`${id}-${field}-error`}>
        {errors[field]}
      </p>
    );

  return (
    <form className="form" onSubmit={(event) => void submit(event)} noValidate>
      <div className="field">
        <label htmlFor={`${id}-name`}>Nombre</label>
        <input
          id={`${id}-name`}
          name="name"
          value={name}
          maxLength={60}
          autoComplete="off"
          onChange={(event) => {
            setName(event.target.value);
          }}
          {...errorProps('name')}
        />
        {errorText('name')}
      </div>

      <div className="field">
        <label htmlFor={`${id}-description`}>Descripción (opcional)</label>
        <textarea
          id={`${id}-description`}
          name="description"
          value={description}
          maxLength={280}
          rows={2}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          {...errorProps('description')}
        />
        {errorText('description')}
      </div>

      <div className="field">
        <label htmlFor={`${id}-anchorId`}>Ancla</label>
        <select
          id={`${id}-anchorId`}
          name="anchorId"
          value={anchorId}
          onChange={(event) => {
            setAnchorId(event.target.value);
          }}
          {...errorProps('anchorId')}
        >
          {anchors.map((anchor) => (
            <option key={anchor.id} value={anchor.id}>
              {anchor.name}
            </option>
          ))}
        </select>
        {errorText('anchorId')}
      </div>

      <fieldset className="field">
        <legend>Frecuencia</legend>
        <div className="choices">
          <label className="choice">
            <input
              type="radio"
              name={`${id}-mode`}
              checked={mode === 'daily'}
              onChange={() => {
                setMode('daily');
              }}
            />
            Días fijos
          </label>
          <label className="choice">
            <input
              type="radio"
              name={`${id}-mode`}
              checked={mode === 'weekly_quota'}
              onChange={() => {
                setMode('weekly_quota');
              }}
            />
            Cuota semanal
          </label>
        </div>
      </fieldset>

      {mode === 'daily' ? (
        <fieldset className="field">
          <legend>Días</legend>
          <div className="weekdays">
            {WEEKDAYS.map(({ day, name: dayName, short }, index) => (
              <label key={day} className="weekday">
                <input
                  type="checkbox"
                  id={index === 0 ? `${id}-weekdays` : undefined}
                  name="weekdays"
                  value={day}
                  aria-label={dayName}
                  checked={weekdays.includes(day)}
                  onChange={() => {
                    toggleDay(day);
                  }}
                />
                <span aria-hidden="true">{short}</span>
              </label>
            ))}
          </div>
          {errorText('weekdays')}
          {daysChanged && hasCheckIns ? (
            <p className="field-note" role="status">
              Si cambias los días, la racha se recalcula con los días nuevos.
            </p>
          ) : null}
        </fieldset>
      ) : (
        <div className="field">
          <label htmlFor={`${id}-weeklyQuota`}>Veces por semana</label>
          <input
            id={`${id}-weeklyQuota`}
            name="weeklyQuota"
            type="number"
            inputMode="numeric"
            min={1}
            max={7}
            value={quota}
            onChange={(event) => {
              setQuota(event.target.value);
            }}
            {...errorProps('weeklyQuota')}
          />
          {errorText('weeklyQuota')}
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={saving}>
          Guardar
        </button>
        <Link to="/habitos" className="button">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
