import type { CSSProperties } from 'react';
import type { DemoRecord } from '../data/workspace';
import { eventTime, trainingIntensity } from '../lib/schedule';

/** Chronological rows use exact start times, not a proportional duration axis. */
export function ScheduleDayBoard({
  events,
  rooms,
  onOpen,
  onContext,
}: {
  events: DemoRecord[];
  rooms: { key: string; label: string; room: string }[];
  onOpen: (event: DemoRecord) => void;
  onContext?: (event: DemoRecord, x: number, y: number) => void;
}) {
  const times = [...new Set(events.map((event) => event.time))].sort();
  return (
    <table className="schedule-day-board" data-ui="schedule-day-board">
      <caption className="sr-only">
        Занятия по времени начала, МСК. Продолжительность указана в каждой тренировке.
      </caption>
      <thead>
        <tr>
          <th scope="col">Начало</th>
          {rooms.map((room) => (
            <th key={room.key} scope="col">
              {room.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {times.map((time) => (
          <tr key={time}>
            <th scope="row">
              <time>{time}</time>
            </th>
            {rooms.map((room) => (
              <td key={room.key}>
                {events
                  .filter((event) => event.time === time && event.room === room.room)
                  .map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      className={`schedule-day-event ${event.status === 'Отменено' ? 'is-cancelled' : ''}`}
                      style={{ '--event-color': trainingIntensity(event).color } as CSSProperties}
                      onClick={() => onOpen(event)}
                      onContextMenu={(e) => {
                        if (onContext) {
                          e.preventDefault();
                          onContext(event, e.clientX, e.clientY);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (
                          onContext &&
                          (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))
                        ) {
                          e.preventDefault();
                          const r = e.currentTarget.getBoundingClientRect();
                          onContext(event, r.left, r.top);
                        }
                      }}
                      aria-label={`${event.name}, ${eventTime(event)}, ${event.room}, ${event.trainer}, записано ${event.booked} из ${event.capacity}`}
                    >
                      <strong>{event.name}</strong>
                      <span>
                        {eventTime(event)} · {event.trainer}
                      </span>
                      <small>
                        {event.status === 'Отменено'
                          ? 'Отменено'
                          : `${event.booked} / ${event.capacity} мест`}
                      </small>
                    </button>
                  ))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
