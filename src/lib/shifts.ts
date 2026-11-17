import type { DemoRecord } from '../data/workspace';

export const SHIFT_WORKPLACES = ['Место 1', 'Место 2'];
const stamp = (value = '') => Date.parse(`${value.length === 16 ? `${value}:00` : value}Z`);
export const shiftHours = (row: DemoRecord) => (stamp(row.end) - stamp(row.start)) / 3600000;
const identity = (row: DemoRecord) =>
  row.employeeId || row.name.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
const normalizedName = (row: DemoRecord) =>
  (row.name || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');

/** Endpoints are exclusive: 14:00 → 14:00 is a handover, not an overlap. */
export function shiftProblem(record: DemoRecord, shifts: DemoRecord[]) {
  if (
    !record.name ||
    !record.club ||
    !record.reception ||
    !SHIFT_WORKPLACES.includes(record.workplace)
  )
    return 'Выберите сотрудника, клуб, ресепшен и рабочее место.';
  if (
    !Number.isFinite(stamp(record.start)) ||
    !Number.isFinite(stamp(record.end)) ||
    record.end <= record.start
  )
    return 'Окончание смены должно быть позже начала.';
  for (const row of shifts) {
    if (row.id === record.id || row.start >= record.end || row.end <= record.start) continue;
    if (
      identity(row) === identity(record) ||
      ((!row.employeeId || !record.employeeId) && normalizedName(row) === normalizedName(record))
    )
      return `У сотрудника уже есть смена ${row.start.slice(11, 16)}–${row.end.slice(11, 16)} (${row.club}).`;
    if (
      row.club === record.club &&
      row.reception === record.reception &&
      row.workplace === record.workplace
    )
      return `${record.workplace} уже занято: ${row.name}, ${row.start.slice(11, 16)}–${row.end.slice(11, 16)}. Выберите другое место или время.`;
  }
  return null;
}

/** Clip overnight shifts to the visible calendar day; totals use the same intervals. */
export function shiftsOnDay(rows: DemoRecord[], day: string) {
  const start = stamp(`${day}T00:00`);
  return rows
    .flatMap((row) => {
      const from = Math.max(start, stamp(row.start));
      const to = Math.min(start + 86400000, stamp(row.end));
      return to > from ? [{ row, from: (from - start) / 60000, to: (to - start) / 60000 }] : [];
    })
    .sort((a, b) => a.from - b.from);
}

export function shiftPeriodHours(rows: DemoRecord[], from: string, to: string) {
  const start = stamp(`${from}T00:00`),
    end = stamp(`${to}T00:00`) + 86400000;
  return rows.reduce(
    (sum, row) =>
      sum +
      Math.max(0, Math.min(end, stamp(row.end)) - Math.max(start, stamp(row.start))) / 3600000,
    0,
  );
}
