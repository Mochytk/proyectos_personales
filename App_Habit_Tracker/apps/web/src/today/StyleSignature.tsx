import type { VisualStyle } from '@habit-tracker/shared';
import { isResolved, type TodayModel } from './today-model';

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  style: VisualStyle;
  model: TodayModel;
}

// The one element of its own each style draws (ADR 0009). The picture is decorative
// detail on top of the list; its label says the same in words.
export function StyleSignature({ style, model }: Props) {
  if (style === 'cuaderno') {
    const elapsed = model.week.filter((day) => day.state !== 'future' && day.state !== 'rest');
    const complete = elapsed.filter((day) => day.state === 'complete').length;
    return (
      <div
        className="signature signature-week"
        role="img"
        aria-label={`Semana: ${String(complete)} de ${String(elapsed.length)} días completos`}
      >
        {model.week.map((day, index) => (
          <span key={day.date} className="week-day" data-state={day.state}>
            {DAY_LETTERS[index]}
          </span>
        ))}
      </div>
    );
  }

  if (style === 'linea') {
    const done = model.groups.filter((group) => group.rows.every(isResolved)).length;
    return (
      <div
        className="signature signature-rail"
        role="img"
        aria-label={`Recorrido de hoy: ${String(done)} de ${String(model.groups.length)} estaciones`}
      >
        {model.groups.map((group) => (
          <span
            key={group.anchor.id}
            className="station"
            data-color={group.colorIndex}
            data-done={group.rows.every(isResolved)}
          />
        ))}
      </div>
    );
  }

  const rows = model.groups.flatMap((group) =>
    group.rows.map((row) => ({ row, colorIndex: group.colorIndex })),
  );
  const plates = rows.filter(({ row }) => row.checkIn?.status === 'done');
  return (
    <div
      className="signature signature-bar"
      role="img"
      aria-label={`Discos de hoy: ${String(plates.length)} de ${String(rows.length)}`}
    >
      <span className="bar" />
      {plates.map(({ row, colorIndex }) => (
        <span key={row.habit.id} className="plate" data-color={colorIndex} />
      ))}
    </div>
  );
}
