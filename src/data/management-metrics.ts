import type { RoleHomeData, StatsTrendGraphic } from '../types';

// Fictional home-dashboard history, independent of the transaction/report demo dataset.
// Map coordinates are schematic, not real geographical locations.
export const managementNetworkClubs = [
  {
    id: 'central',
    shortName: 'Центральный',
    city: 'Йошкар-Ола',
    x: 36,
    y: 70,
    dailyRevenue: [125000, 138000, 127500, 149000, 145000, 158000],
    activeClients: [1225, 1230, 1234, 1240, 1244, 1248],
  },
  {
    id: 'park',
    shortName: 'Парк',
    city: 'Йошкар-Ола',
    x: 94,
    y: 29,
    dailyRevenue: [118000, 122000, 130000, 135000, 141000, 152000],
    activeClients: [1157, 1161, 1164, 1171, 1176, 1180],
  },
  {
    id: 'river',
    shortName: 'Речной',
    city: 'Йошкар-Ола',
    x: 151,
    y: 81,
    dailyRevenue: [112000, 125000, 122500, 114000, 146000, 155000],
    activeClients: [1166, 1170, 1174, 1183, 1188, 1192],
  },
  {
    id: 'north',
    shortName: 'Северный',
    city: 'Йошкар-Ола',
    x: 208,
    y: 28,
    dailyRevenue: [100000, 85000, 110000, 95000, 105000, 125000],
    activeClients: [920, 924, 927, 931, 935, 940],
  },
  {
    id: 'south',
    shortName: 'Южный',
    city: 'Йошкар-Ола',
    x: 260,
    y: 88,
    dailyRevenue: [90000, 95000, 85000, 110000, 100000, 105000],
    activeClients: [858, 859, 862, 868, 874, 880],
  },
  {
    id: 'east',
    shortName: 'Восточный',
    city: 'Йошкар-Ола',
    x: 299,
    y: 45,
    dailyRevenue: [105000, 115000, 110000, 125000, 120000, 125000],
    activeClients: [1034, 1037, 1041, 1048, 1055, 1060],
  },
] as const;
export const managementNetworkLinks = [
  ['central', 'park'],
  ['central', 'river'],
  ['park', 'north'],
  ['river', 'north'],
  ['river', 'south'],
  ['north', 'east'],
  ['south', 'east'],
] as const;
export const managementNetworkMetric: RoleHomeData['metrics'][number] = {
  label: 'Клубов в сети',
  value: String(managementNetworkClubs.length),
  detail: 'Йошкар-Ола · схема · демо',
  graphic: {
    kind: 'network',
    nodes: managementNetworkClubs.map(({ id, shortName, x, y }) => ({
      id,
      label: shortName,
      x,
      y,
    })),
    links: managementNetworkLinks,
    description: `Схема сети: ${managementNetworkClubs.length} клубов — ${managementNetworkClubs.map((c) => c.shortName).join(', ')}. Условные соединения, не точная карта и не маршруты поездок.`,
  },
};
export const managementDailyRevenue = Object.fromEntries(
  managementNetworkClubs.map((club) => [club.id, club.dailyRevenue]),
) as Record<string, readonly number[]>;
const days = ['1 ноя', '2 ноя', '3 ноя', '4 ноя', '5 ноя', '6 ноя'];
const cumulative = (values: readonly number[]) => {
  let total = 0;
  return values.map((value) => (total += value));
};
function metric(
  label: string,
  values: readonly number[],
  detail: string,
  unit: 'number' | 'money' | 'percent',
  domain: StatsTrendGraphic['domain'] = 'extent',
): RoleHomeData['metrics'][number] {
  const format = (value: number) =>
    value.toLocaleString('ru-RU') + (unit === 'money' ? ' ₽' : unit === 'percent' ? '%' : '');
  return {
    label,
    value: format(values[values.length - 1]),
    detail,
    graphic: {
      kind: 'trend',
      domain,
      points: values.map((value, i) => ({ label: days[i], value })),
      description: `${label}, демонстрационный ряд за 1–6 ноября 2026. ${values.map((value, i) => `${days[i]}: ${format(value)}`).join('; ')}. ${domain === 'extent' ? 'Шкала от минимума до максимума ряда.' : 'Шкала от нуля.'}`,
    },
  };
}
const networkRevenue = days.map((_, i) =>
  managementNetworkClubs.reduce((sum, club) => sum + club.dailyRevenue[i], 0),
);
const networkClients = days.map((_, i) =>
  managementNetworkClubs.reduce((sum, club) => sum + club.activeClients[i], 0),
);
export const managementMetrics = {
  networkRevenue: metric(
    'Выручка сети',
    cumulative(networkRevenue),
    'Накоплено за 1–6 ноя · демо',
    'money',
    'zero',
  ),
  activeClients: metric(
    'Активные клиенты',
    networkClients,
    `1–6 ноя: ${networkClients[0].toLocaleString('ru-RU')} → ${networkClients.at(-1)!.toLocaleString('ru-RU')} · демо`,
    'number',
  ),
  clubRevenue: metric(
    'Выручка за месяц',
    cumulative(managementDailyRevenue.central),
    'Накоплено за 1–6 ноя · 84% плана · демо',
    'money',
    'zero',
  ),
  renewals: metric('Продления', [82, 84, 83, 85, 84, 86], '1–6 ноя: 82 → 86% · демо', 'percent'),
  occupancy: metric(
    'Заполняемость',
    [64, 70, 68, 79, 73, 76],
    '1–6 ноя: 64 → 76% · демо',
    'percent',
  ),
  openIssues: metric('Вопросов в работе', [7, 5, 6, 4, 5, 4], '1–6 ноя: 7 → 4 · демо', 'number'),
};
