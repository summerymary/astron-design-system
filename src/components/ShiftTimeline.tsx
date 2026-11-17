import type { CSSProperties } from 'react';
import type { DemoRecord } from '../data/workspace';
import { shiftStaffColors, shiftStaffKey } from '../lib/shift-colors';
import { SHIFT_WORKPLACES, shiftsOnDay, shiftPeriodHours } from '../lib/shifts';
import { reportNextDay } from '../lib/report-period';

const formatHours = (hours: number) => hours.toLocaleString('ru', { maximumFractionDigits: 2 });
const time = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export const shiftDate = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('ru', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    timeZone: 'UTC',
  });

/** One fixed lane per computer. Consecutive bars show handover; parallel lanes show cover. */
export function ShiftTimeline({
  rows,
  employees = [],
  allShifts = rows,
  from,
  to,
  onDay,
}: {
  rows: DemoRecord[];
  employees?: DemoRecord[];
  allShifts?: DemoRecord[];
  from?: string;
  to?: string;
  onDay?: (day: string) => void;
}) {
  const colors = shiftStaffColors(employees, allShifts);
  const visibleStaff = [...new Map(rows.map((row) => [shiftStaffKey(row, employees), row.name]))];
  const start = from || rows.map((row) => row.start.slice(0, 10)).sort()[0];
  const end =
    to ||
    rows
      .map((row) => row.end.slice(0, 10))
      .sort()
      .at(-1);
  const days: string[] = [];
  if (start && end) for (let day = start; day <= end; day = reportNextDay(day, 1)) days.push(day);
  const segments = days.flatMap((day) => shiftsOnDay(rows, day));
  const first = Math.floor(Math.min(360, ...segments.map((item) => item.from)) / 60) * 60;
  const last = Math.ceil(Math.max(1380, ...segments.map((item) => item.to)) / 60) * 60;
  const ticks = Array.from({ length: (last - first) / 60 + 1 }, (_, index) => first + index * 60);
  return (
    <section className="shift-journal" data-ui="shift-timeline">
      <ul className="shift-staff-legend" aria-label="Цвета администраторов">
        {visibleStaff.map(([key, name]) => (
          <li key={key} style={{ '--shift-staff-color': colors.get(key) } as CSSProperties}>
            <span aria-hidden="true" />
            {name}
          </li>
        ))}
      </ul>
      <div
        className="shift-timeline-scroll"
        tabIndex={0}
        aria-label="Журнал смен по дням и рабочим местам"
      >
        <table className="shift-timeline">
          <colgroup>
            <col className="shift-date-column" />
            <col className="shift-reception-column" />
            <col />
            <col className="shift-hours-column" />
          </colgroup>
          <caption className="sr-only">
            Смены администраторов. Две дорожки — два компьютера. Время московское. Нажмите день для
            полного списка смен.
          </caption>
          <thead>
            <tr>
              <th scope="col">День</th>
              <th scope="col">Место</th>
              <th scope="col" className="shift-scale-cell">
                <div className="shift-time-axis">
                  {ticks.map((tick) => (
                    <span
                      key={tick}
                      style={{ left: `${((tick - first) / (last - first)) * 100}%` }}
                    >
                      {time(tick)}
                    </span>
                  ))}
                </div>
              </th>
              <th scope="col" className="shift-hours-cell">
                Часы
              </th>
            </tr>
          </thead>
          <tbody>
            {days.flatMap((day) => {
              const daily = shiftsOnDay(rows, day);
              const lanes = [
                ...SHIFT_WORKPLACES,
                ...(daily.some(({ row }) => !SHIFT_WORKPLACES.includes(row.workplace))
                  ? ['Не указано']
                  : []),
              ];
              return lanes.map((workplace, laneIndex) => {
                const items = daily.filter(
                  ({ row }) =>
                    (SHIFT_WORKPLACES.includes(row.workplace) ? row.workplace : 'Не указано') ===
                    workplace,
                );
                // Legacy conflicts stay visible instead of overlapping or being silently hidden.
                const ends: number[] = [];
                const tracks = items.map((item) => {
                  let index = ends.findIndex((value) => value <= item.from);
                  if (index < 0) index = ends.length;
                  ends[index] = item.to;
                  return index;
                });
                return (
                  <tr
                    key={`${day}:${workplace}`}
                    className={laneIndex === 0 ? 'shift-day-start' : ''}
                  >
                    {laneIndex === 0 && (
                      <th scope="rowgroup" rowSpan={lanes.length} className="shift-date-cell">
                        {onDay ? (
                          <button
                            className="shift-day-link"
                            onClick={() => onDay(day)}
                            aria-label={`Смены за ${shiftDate(day)}`}
                          >
                            {shiftDate(day)}
                          </button>
                        ) : (
                          shiftDate(day)
                        )}
                      </th>
                    )}
                    <th scope="row" className="shift-reception-cell">
                      {workplace}
                    </th>
                    <td className="shift-scale-cell">
                      <div
                        className="shift-time-lane"
                        style={
                          {
                            height: `${Math.max(1, ends.length) * 48}px`,
                            '--shift-hours': (last - first) / 60,
                          } as CSSProperties
                        }
                      >
                        {!items.length && <span className="shift-lane-empty">Нет смен</span>}
                        {items.map(({ row, from: begin, to: finish }, index) => {
                          const style = {
                            '--shift-staff-color': colors.get(shiftStaffKey(row, employees)),
                            top: `${tracks[index] * 48}px`,
                            left: `${((begin - first) / (last - first)) * 100}%`,
                            width: `${((finish - begin) / (last - first)) * 100}%`,
                          } as CSSProperties;
                          const content = (
                            <>
                              <strong>{row.name}</strong>
                              <span className="shift-entry-time">
                                {time(begin)}–{time(finish)}
                              </span>
                            </>
                          );
                          return onDay ? (
                            <button
                              key={row.id}
                              className="shift-time-entry"
                              style={style}
                              title={`${row.name} · ${time(begin)}–${time(finish)}`}
                              aria-label={`${row.name}, ${shiftDate(day)}, ${time(begin)}–${time(finish)}, ${workplace}`}
                              onClick={() => onDay(day)}
                            >
                              {content}
                            </button>
                          ) : (
                            <div
                              key={row.id}
                              className="shift-time-entry"
                              style={style}
                              title={`${row.name} · ${time(begin)}–${time(finish)}`}
                            >
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="shift-hours-cell">
                      {formatHours(
                        items.reduce((sum, item) => sum + (item.to - item.from) / 60, 0),
                      )}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>Всего за период · человеко-часы</th>
              <td className="shift-hours-cell">
                {start && end ? formatHours(shiftPeriodHours(rows, start, end)) : 0}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
