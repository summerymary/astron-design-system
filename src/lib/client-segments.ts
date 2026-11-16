import type { DemoSubscription } from '../data/clientProfile';

export const clientSegments = [
  { name: 'Активные клиенты', rule: 'Есть действующий абонемент' },
  { name: 'Клиенты с намерением', rule: 'Есть неактивированный абонемент' },
  { name: 'Ожидают продления', rule: 'Абонемент завершился 1–30 дней назад' },
  { name: 'Заснувшие', rule: 'Абонемент завершился 31–90 дней назад' },
  { name: 'Потерянные · уровень 1', rule: 'Абонемент завершился 91–180 дней назад' },
  { name: 'Потерянные · уровень 2', rule: 'Абонемент завершился 181–365 дней назад' },
  { name: 'Потерянные · уровень 3', rule: 'Абонемент завершился 366–1095 дней назад' },
  { name: 'Потерянные · уровень 4', rule: 'Абонемент завершился 1096 и более дней назад' },
  { name: 'Недостаточно данных', rule: 'Нет известной даты окончания либо абонемент заморожен' },
] as const;
const date = (value: string | null) => {
  const day = /^\d{2}\.\d{2}\.\d{4}$/.test(value || '')
    ? value!.split('.').reverse().join('-')
    : (value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
    ? day
    : '';
};
/** Membership state as of a day; missing history is never inferred from attendance. */
export function clientSegment(passes: DemoSubscription[], at: string) {
  const known = passes.filter((p) => !date(p.boughtAt) || date(p.boughtAt) <= at);
  const active = known.some(
    (p) =>
      p.activatedAt &&
      date(p.activatedAt) <= at &&
      (!p.endsAt || date(p.endsAt) >= at) &&
      p.status !== 'paused' &&
      p.remaining !== 0,
  );
  if (active) return { index: 0, ended: '', days: '' };
  if (
    known.some(
      (p) =>
        !p.activatedAt &&
        p.status === 'pending' &&
        (!p.endsAt || date(p.endsAt) >= at) &&
        p.remaining !== 0,
    )
  )
    return { index: 1, ended: '', days: '' };
  if (known.some((p) => p.status === 'paused' && (!p.endsAt || date(p.endsAt) >= at)))
    return { index: 8, ended: '', days: '' };
  const ended =
    known
      .map((p) => date(p.endsAt))
      .filter((d) => d && d < at)
      .sort()
      .at(-1) || '';
  if (!ended) return { index: 8, ended: '', days: '' };
  const days = Math.round((Date.parse(at) - Date.parse(ended)) / 86400000);
  const index =
    days <= 30 ? 2 : days <= 90 ? 3 : days <= 180 ? 4 : days <= 365 ? 5 : days <= 1095 ? 6 : 7;
  return { index, ended, days: String(days) };
}
