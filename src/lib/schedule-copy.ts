import type { DemoRecord } from '../data/workspace';
import { addDays, validateEvent, weekStart } from './schedule';

export type WeekCopyItem = { source: DemoRecord; record: DemoRecord; reason: string | null };

const validDay = (day: string) => {
  const date = new Date(`${day}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === day
  );
};

/** A pure preview: only accepted candidates participate in subsequent conflict checks. */
export function planWeekCopy(
  events: DemoRecord[],
  rooms: DemoRecord[],
  club: string,
  sourceDay: string,
  targetDay: string,
) {
  const result = {
    sourceWeek: '',
    targetWeek: '',
    items: [] as WeekCopyItem[],
    excludedPersonal: 0,
    excludedCancelled: 0,
    error: null as string | null,
  };
  if (!validDay(sourceDay) || !validDay(targetDay)) {
    result.error = 'Выберите корректную дату недели.';
    return result;
  }
  result.sourceWeek = weekStart(sourceDay);
  result.targetWeek = weekStart(targetDay);
  if (result.sourceWeek === result.targetWeek) {
    result.error = 'Источник и выбранная неделя совпадают. Выберите другую неделю.';
    return result;
  }
  const source = events
    .filter(
      (e) =>
        e.club === club && e.day >= result.sourceWeek && e.day <= addDays(result.sourceWeek, 6),
    )
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id),
    );
  const accepted = [...events];
  for (const event of source) {
    if (event.status === 'Отменено') {
      result.excludedCancelled++;
      continue;
    }
    // Personal appointments belong to a client; copying them would invent a new booking.
    if (event.kind === 'personal') {
      result.excludedPersonal++;
      continue;
    }
    const offset = Math.round(
      (Date.parse(`${event.day}T12:00:00Z`) - Date.parse(`${result.sourceWeek}T12:00:00Z`)) /
        86400000,
    );
    let id = `preview-copy:${result.targetWeek}:${event.id}`;
    while (accepted.some((e) => e.id === id)) id += ':';
    const record = {
      ...event,
      id,
      day: addDays(result.targetWeek, offset),
      booked: '0',
      attendees: '',
      present: '',
      reserve: '',
      memberId: '',
      status: 'Запись открыта',
    };
    const reason = validateEvent(record, accepted, rooms);
    result.items.push({ source: event, record, reason });
    if (!reason) accepted.push(record);
  }
  if (!result.items.length) result.error = 'В этой неделе нет групповых занятий для копирования.';
  return result;
}
