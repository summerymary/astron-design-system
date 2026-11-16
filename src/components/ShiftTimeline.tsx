import type { CSSProperties } from 'react';
import type { DemoRecord } from '../data/workspace';

/** A month journal, with one dated row per reception lane and exact shift intervals. */
export function ShiftTimeline({
  rows,
  onOpen,
}: {
  rows: DemoRecord[];
  onOpen?: (row: DemoRecord) => void;
}) {
  const days = [...new Set(rows.map((row) => row.start.slice(0, 10)))].sort();
  const minute = (value: string) => Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16));
  const first = Math.floor(Math.min(360, ...rows.map((row) => minute(row.start))) / 60) * 60;
  const last =
    Math.ceil(
      Math.max(
        1380,
        ...rows.map((row) =>
          row.end.slice(0, 10) > row.start.slice(0, 10) ? 1440 : minute(row.end),
        ),
      ) / 60,
    ) * 60;
  const ticks = Array.from(
    { length: Math.floor((last - first) / 60) + 1 },
    (_, index) => first + index * 60,
  );
  const hours = (items: DemoRecord[]) =>
    items
      .reduce((sum, row) => sum + (Date.parse(row.end) - Date.parse(row.start)) / 3600000, 0)
      .toLocaleString('ru', { maximumFractionDigits: 2 });
  return (
    <div
      className="shift-timeline-scroll"
      tabIndex={0}
      aria-label="Журнал смен по дням и времени"
      data-ui="shift-timeline"
    >
      <table className="shift-timeline">
        <caption className="sr-only">
          Рабочие смены. Время московское. Интервалы содержат имя сотрудника и точные часы.
        </caption>
        <thead>
          <tr>
            <th>Дата</th>
            <th>Ресепшен</th>
            <th>
              <div className="shift-time-axis">
                {ticks.map((tick) => (
                  <span key={tick} style={{ left: `${((tick - first) / (last - first)) * 100}%` }}>
                    {String(Math.floor(tick / 60)).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
            </th>
            <th>Часов</th>
          </tr>
        </thead>
        <tbody>
          {days.flatMap((day) => {
            const daily = rows.filter((row) => row.start.startsWith(day));
            return [...new Set(daily.map((row) => row.reception || 'Сотрудники'))]
              .sort()
              .map((lane, index) => {
                const shifts = daily
                  .filter((row) => (row.reception || 'Сотрудники') === lane)
                  .sort((a, b) => a.start.localeCompare(b.start));
                const ends: number[] = [];
                const tracks = shifts.map((row) => {
                  const start = minute(row.start);
                  let track = ends.findIndex((end) => end <= start);
                  if (track < 0) track = ends.length;
                  ends[track] = row.end.slice(0, 10) > day ? 1440 : minute(row.end);
                  return track;
                });
                return (
                  <tr key={`${day}:${lane}`}>
                    <th scope="row">
                      {index === 0 && (
                        <>
                          <strong>
                            {new Date(`${day}T12:00:00Z`).toLocaleDateString('ru', {
                              day: 'numeric',
                              month: 'short',
                              timeZone: 'UTC',
                            })}
                          </strong>
                          <small>
                            {new Date(`${day}T12:00:00Z`).toLocaleDateString('ru', {
                              weekday: 'long',
                              timeZone: 'UTC',
                            })}
                          </small>
                        </>
                      )}
                    </th>
                    <td>{lane}</td>
                    <td>
                      <div
                        className="shift-time-lane"
                        style={
                          {
                            height: `${ends.length * 48}px`,
                            '--shift-hours': (last - first) / 60,
                          } as CSSProperties
                        }
                      >
                        {shifts.map((row, index) => {
                          const start = minute(row.start),
                            end = row.end.slice(0, 10) > day ? 1440 : minute(row.end);
                          const style = {
                            top: `${tracks[index] * 48}px`,
                            left: `${((start - first) / (last - first)) * 100}%`,
                            width: `${((end - start) / (last - first)) * 100}%`,
                          } as CSSProperties;
                          const content = (
                            <>
                              <strong>
                                {row.start.slice(11, 16)}–{row.end.slice(11, 16)}
                              </strong>
                              <span>{row.name}</span>
                            </>
                          );
                          return onOpen ? (
                            <button
                              key={row.id}
                              style={style}
                              className="shift-time-entry"
                              onClick={() => onOpen(row)}
                              aria-label={`${row.name}, ${day}, ${row.start.slice(11, 16)}–${row.end.slice(11, 16)}, ${row.status}`}
                            >
                              {content}
                            </button>
                          ) : (
                            <div key={row.id} style={style} className="shift-time-entry">
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td>{hours(shifts)}</td>
                  </tr>
                );
              });
          })}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>Всего за выбранный месяц</th>
            <td>{hours(rows)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
