import {
  buildHeatmap,
  formatShortDay,
  isoWeekday,
  type CheckIn,
  type CheckInStatus,
  type Habit,
  type HeatmapState,
  type LocalDate,
} from '@habit-tracker/shared';

const LABELS: Record<HeatmapState, string> = {
  done: 'hecho',
  skipped: 'saltado',
  missed: 'no hecho',
  not_scheduled: 'no aplica',
  before_start: 'antes de empezar',
  today_pending: 'pendiente',
};

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  habit: Pick<Habit, 'mode' | 'weekdays' | 'startsOn'>;
  today: LocalDate;
  // The habit's check-ins; deleted ones are ignored.
  checkIns: CheckIn[];
}

// The last 90 days as a heatmap, a week per row with Monday first (RF-1.5). Colour is
// never the only cue: every cell carries its day and state as a label.
export function HabitHistory({ habit, today, checkIns }: Props) {
  const live = checkIns.filter((checkIn) => checkIn.deletedAt === null);
  const statuses = new Map<LocalDate, CheckInStatus>(live.map((c) => [c.localDate, c.status]));
  const reasons = new Map(live.map((c) => [c.localDate, c.skipReason]));
  const cells = buildHeatmap({ habit, today, checkIns: statuses });

  return (
    <div className="heatmap-wrap">
      <div className="heatmap heatmap-weekdays" aria-hidden="true" data-testid="heatmap-weekdays">
        {DAY_LETTERS.map((letter) => (
          <span key={letter}>{letter}</span>
        ))}
      </div>
      <ol className="heatmap" aria-label="Últimos 90 días">
        {cells.map((cell, index) => {
          const reason = cell.state === 'skipped' ? reasons.get(cell.date) : null;
          const label = `${formatShortDay(cell.date)}: ${LABELS[cell.state]}${reason ? ` (${reason})` : ''}`;
          return (
            <li
              key={cell.date}
              className="heatmap-cell"
              data-state={cell.state}
              aria-label={label}
              title={label}
              style={index === 0 ? { gridColumnStart: isoWeekday(cell.date) } : undefined}
            />
          );
        })}
      </ol>
      <ul className="heatmap-legend" aria-hidden="true">
        {(['done', 'skipped', 'missed', 'not_scheduled'] as const).map((state) => (
          <li key={state}>
            <span className="heatmap-cell" data-state={state} />
            {LABELS[state]}
          </li>
        ))}
      </ul>
    </div>
  );
}
