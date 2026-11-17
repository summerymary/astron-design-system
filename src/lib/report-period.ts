/** Calendar-only report dates; no browser timezone conversion. */
export function reportMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, number] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function reportNextDay(day: string, offset: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
}

export function nextBirthday(birth: string, from: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !Number.isFinite(Date.parse(birth)) || birth > from)
    return null;
  if (new Date(birth).toISOString().slice(0, 10) !== birth) return null;
  for (const year of [Number(from.slice(0, 4)), Number(from.slice(0, 4)) + 1]) {
    // Demo convention: a 29 February birthday falls on 28 February in a common year.
    let date = `${year}-${birth.slice(5)}`;
    if (birth.slice(5) === '02-29' && new Date(date).getUTCMonth() !== 1) date = `${year}-02-28`;
    if (date >= from) return date;
  }
  return null;
}

/** Monday–Sunday, based on a date, without timezone-dependent weekday shifts. */
export function reportWeek(day: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(Date.parse(day)) ||
    new Date(day).toISOString().slice(0, 10) !== day
  )
    return null;
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  const from = reportNextDay(day, -(weekday === 0 ? 6 : weekday - 1));
  return { from, to: reportNextDay(from, 6) };
}
