import type { DemoRecord } from '../data/workspace';
import { getClientProfile } from '../data/clientProfile';
import { getMembershipKind } from '../data/membership-kinds';
import { clientName } from './client-display';
import type { ReportFilters, ReportResult, StatisticsInput } from './statistics';

const day = (v = '') =>
  /^\d{2}\.\d{2}\.\d{4}$/.test(v) ? v.split('.').reverse().join('-') : v.slice(0, 10);
const clubNames: Record<string, string> = { central: 'Центральный', park: 'Парк', river: 'Речной' };
const localDate = (v: string) =>
  /(?:Z|[+-]\d\d:\d\d)$/.test(v)
    ? new Date(Date.parse(v) + 10800000).toISOString().slice(0, 10)
    : day(v);
const bands = [
  { id: '0', name: 'Менее 5', min: 0, max: 5 },
  { id: '1', name: '5 — менее 10', min: 5, max: 10 },
  { id: '2', name: '10 — менее 20', min: 10, max: 20 },
  { id: '3', name: '20 — менее 30', min: 20, max: 30 },
  { id: '4', name: '30 — менее 40', min: 30, max: 40 },
  { id: '5', name: '40 — менее 50', min: 40, max: 50 },
  { id: '6', name: '50 — менее 60', min: 50, max: 60 },
  { id: '7', name: '60 и более', min: 60, max: Infinity },
];
const mergedDays = (intervals: [string, string][]) => {
  const sorted = intervals
    .map(([a, b]) => [Date.parse(a), Date.parse(b)])
    .sort((a, b) => a[0] - b[0]);
  let last = -Infinity,
    total = 0;
  for (const [a, b] of sorted) {
    const start = Math.max(a, last + 86400000);
    if (b >= start) total += (b - start) / 86400000 + 1;
    last = Math.max(last, b);
  }
  return total;
};

/** Frequency in a 30-day equivalent, with exact pass attribution and nonoverlapping bands. */
export function unlimitedStatistics(
  id: string,
  f: ReportFilters,
  input: StatisticsInput,
): ReportResult | null {
  if (id !== 'unlim_avg_visit') return null;
  const out: ReportResult = { metrics: [], blocks: [], notes: [] };
  const cutoff = day(input.at) < f.to ? day(input.at) : f.to;
  const inClub = (club: string) =>
    f.club === 'all' || (clubNames[club] || club) === (clubNames[f.club] || f.club);
  const visits = [...new Map(input.visits.map((v) => [v.id, v])).values()].filter(
    (v) => localDate(v.enteredAt) >= f.from && localDate(v.enteredAt) <= cutoff && inClub(v.clubId),
  );
  const people: DemoRecord[] = [];
  for (const member of input.members.filter((m) => !m.archived)) {
    const all = getClientProfile(member, input.data).subscriptions;
    let unknownDates = false;
    const eligible = all.flatMap((p) => {
      const issued = (input.data['issued-plans'] || []).find((r) => r.id === p.id);
      const valuation = (input.data['report-pass-values'] || []).find(
        (r) => r.memberId === String(member.id) && r.passId === p.id,
      );
      if (f.club !== 'all' && !inClub(issued?.club || valuation?.club || '')) return [];
      const knownUnlimited =
        getMembershipKind(p.name, p.kindId)?.type === 'Безлимитный' ||
        issued?.type === 'Безлимитный';
      if (!knownUnlimited || p.remaining !== null || (f.plan !== 'all' && p.name !== f.plan))
        return [];
      if (!p.activatedAt || !p.endsAt) {
        if (p.status !== 'pending') unknownDates = true;
        return [];
      }
      const start = day(p.activatedAt) > f.from ? day(p.activatedAt) : f.from;
      const end = day(p.endsAt) < cutoff ? day(p.endsAt) : cutoff;
      if (start > end || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)))
        return [];
      return [{ pass: p, start, end }];
    });
    if (!eligible.length && !unknownDates) continue;
    let count = 0,
      ambiguous = 0;
    for (const v of visits.filter((v) => v.memberId === member.id)) {
      const matches = v.passId
        ? eligible.filter((e) => e.pass.id === v.passId)
        : eligible.filter((e) => e.pass.name === v.plan);
      if (!matches.length) continue;
      if (
        matches.length !== 1 ||
        (!v.passId && all.filter((p) => p.name === v.plan).length !== 1)
      ) {
        ambiguous++;
        continue;
      }
      const e = matches[0],
        d = localDate(v.enteredAt);
      if (d >= e.start && d <= e.end) count++;
      else ambiguous++;
    }
    const exposure = mergedDays(eligible.map((e) => [e.start, e.end]));
    const uncertain =
      unknownDates || ambiguous > 0 || eligible.some((e) => e.pass.status === 'paused');
    const frequency = uncertain ? null : (count / exposure) * 30;
    const band =
      frequency === null ? null : bands.find((b) => frequency >= b.min && frequency < b.max)!;
    people.push({
      id: String(member.id),
      memberId: String(member.id),
      name: clientName(member),
      count: String(count),
      days: unknownDates ? '' : String(exposure),
      frequency: frequency === null ? '' : String(Math.round(frequency * 100) / 100),
      band: band?.id || 'unknown',
      state: uncertain
        ? 'Неизвестный срок, неоднозначное списание или история заморозки'
        : 'Известная история',
      ambiguous: String(ambiguous),
    });
  }
  const known = people.filter((p) => p.band !== 'unknown');
  out.blocks.push({
    title: 'Частота визитов',
    columns: [
      { key: 'name', label: 'Посещений в пересчёте на 30 дней' },
      { key: 'count', label: 'Клиентов' },
    ],
    rows: bands.map((b) => ({
      id: b.id,
      name: b.name,
      count: String(known.filter((p) => p.band === b.id).length),
      detailKey: `unlim:${b.id}`,
    })),
  });
  const columns = [
    { key: 'name', label: 'Клиент' },
    { key: 'count', label: 'Сохранённых визитов' },
    { key: 'days', label: 'Дней действия в периоде' },
    { key: 'frequency', label: 'Визитов на 30 дней' },
    { key: 'state', label: 'История' },
  ];
  out.blocks.push({
    title: 'Визиты по безлимитным картам',
    columns,
    rows: people,
    memberLinks: true,
  });
  for (const b of bands)
    out.blocks.push({
      title: `Клиенты · ${b.name}`,
      columns,
      rows: known.filter((p) => p.band === b.id),
      memberLinks: true,
      detail: `unlim:${b.id}`,
    });
  out.metrics = [
    { label: 'Клиентов с известной частотой', value: known.length },
    { label: 'Без сохранённых визитов', value: known.filter((p) => p.count === '0').length },
    { label: 'Требуют уточнения', value: people.length - known.length },
  ];
  out.notes.push(
    'Расчёт демо: сохранённые визиты / дни действия выбранных безлимитов в периоде × 30. Пересекающиеся дни нескольких карт учитываются один раз, будущие и неактивированные карты не входят в базу. Подробная формула источника не раскрыта; пересчёт на 30 дней обозначен явно.',
  );
  out.notes.push(
    'Границы без пересечений: <5, 5–<10, 10–<20, 20–<30, 30–<40, 40–<50, 50–<60, 60+. Добавлен отсутствующий на снимке интервал 50–60. Нулевые сохранённые визиты входят в <5. При неоднозначном старом списании или неизвестной истории заморозки частота не приравнивается к нулю.',
  );
  return out;
}
