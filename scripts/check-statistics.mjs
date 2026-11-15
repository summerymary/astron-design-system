import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const cache = new Map();
async function load(url) {
  const key = String(url);
  if (cache.has(key)) return cache.get(key);
  let code = ts.transpileModule(await readFile(url, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  for (const match of [...code.matchAll(/from ['"]([^'"]+)['"]/g)])
    code = code.replace(match[0], `from '${await load(new URL(match[1] + '.ts', url))}'`);
  const result = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  cache.set(key, result);
  return result;
}
const {
  buildStatistics,
  defaultReportFilters: f,
  previousReportPeriod,
  reportAge,
  statisticsCsv,
} = await import(await load(new URL('../src/lib/statistics.ts', import.meta.url)));
const { statisticsReports, reportPending } = await import(
  await load(new URL('../src/data/statistics.ts', import.meta.url))
);
const { statisticsCharts } = await import(
  await load(new URL('../src/lib/statistics-charts.ts', import.meta.url))
);
const { createWorkspaceData } = await import(
  await load(new URL('../src/data/workspace.ts', import.meta.url))
);
const { initialMembers } = await import(
  await load(new URL('../src/data/mock.ts', import.meta.url))
);
const { initialVisits } = await import(
  await load(new URL('../src/data/admin.ts', import.meta.url))
);
assert.equal(statisticsReports.length, 48);
assert.equal(new Set(statisticsReports.map((r) => r.id)).size, 48);
assert.deepEqual(
  ['clients', 'trainers', 'sales'].map(
    (g) => statisticsReports.filter((r) => r.group === g).length,
  ),
  [20, 9, 19],
);
const input = {
  members: structuredClone(initialMembers),
  visits: structuredClone(initialVisits),
  data: createWorkspaceData(),
  at: '2026-11-06T14:35',
};
const before = JSON.stringify(input);
for (const report of statisticsReports) {
  const result = buildStatistics(report.id, f, input);
  assert.ok(result.pending || result.blocks.length, report.id);
  assert.equal(Boolean(result.pending), Boolean(reportPending[report.id]), report.id);
  for (const block of result.blocks)
    for (const row of block.rows)
      for (const value of Object.values(row)) assert.equal(typeof value, 'string');
}
assert.equal(JSON.stringify(input), before, 'Reports must be read-only');
assert.ok(
  buildStatistics('report_all_clients_phones', f, {
    ...input,
    hidePhones: true,
  }).blocks[0].rows.every((r) => r.phone.includes('•')),
  'Administrator phones remain masked in tables and export',
);
assert.ok(buildStatistics('unique_visits', { ...f, from: '' }, input).error);
assert.ok(buildStatistics('unique_visits', { ...f, to: '2026-02-31' }, input).error);
assert.ok(buildStatistics('unique_visits', { ...f, from: '2026-11-07' }, input).error);
assert.ok(buildStatistics('timetoabstat', { ...f, ageFrom: '30', ageTo: '20' }, input).error);
assert.ok(buildStatistics('notcame', { ...f, threshold: '-1' }, input).error);
assert.deepEqual(previousReportPeriod('2026-11-01', '2026-11-06'), {
  from: '2026-10-26',
  to: '2026-10-31',
});
assert.equal(previousReportPeriod('', ''), null);
assert.equal(reportAge('2003-11-07', '2026-11-06'), 22);
assert.equal(reportAge('2003-11-06', '2026-11-06'), 23);
assert.equal(reportAge('', '2026-11-06'), null);
const multipleClubs = {
  ...input,
  visits: [...input.visits, { ...input.visits[0], id: 'another-club', clubId: 'park' }],
};
const unique = buildStatistics('unique_visits', f, multipleClubs);
assert.equal(
  unique.metrics[0].value,
  new Set(input.visits.map((v) => v.memberId)).size,
  'Network deduplicates across clubs',
);
assert.ok(
  unique.blocks[0].rows.reduce((n, r) => n + Number(r.clients), 0) > unique.metrics[0].value,
);
const dated = buildStatistics('unique_visits', f, {
  ...input,
  visits: [{ ...initialVisits[0], enteredAt: '2026-11-05T22:30:00Z' }],
});
assert.equal(dated.blocks[0].rows[0].visits, '1');
assert.equal(
  buildStatistics(
    'unique_visits',
    { ...f, from: '2026-11-06' },
    { ...input, visits: [{ ...initialVisits[0], enteredAt: '2026-11-05T22:30:00Z' }] },
  ).metrics[1].value,
  1,
  'UTC dates use Moscow',
);
const event = {
  id: 'past',
  day: '2026-11-05',
  time: '10:00',
  duration: '60',
  status: 'Запланирована',
  club: 'Центральный',
  attendees: '1001,1002',
  present: '1001',
  reserve: '1003',
};
const missed = buildStatistics(
  'notcame',
  { ...f, threshold: '0' },
  {
    ...input,
    data: {
      ...input.data,
      events: [
        event,
        { ...event, id: 'future', day: '2026-11-07' },
        { ...event, id: 'cancelled', status: 'Отменено' },
        { ...event, id: 'running', day: '2026-11-06', time: '14:00' },
      ],
    },
  },
);
assert.equal(missed.blocks[0].rows.length, 1);
assert.equal(missed.blocks[0].rows[0].memberId, '1002');
assert.equal(
  missed.blocks[0].rows[0].count,
  '1',
  'No future, cancelled, running, reserve or present clients counted',
);
const totalsInput = {
  ...input,
  data: {
    ...input.data,
    ledger: [
      {
        id: 'sale',
        date: '2026-11-06',
        club: 'Центральный',
        category: 'Абонементы',
        name: 'Карта',
        amount: '0.10',
        method: 'Карта',
        status: 'Оплачено',
      },
      {
        id: 'sale2',
        date: '2026-11-06',
        club: 'Центральный',
        category: 'Абонементы',
        name: 'Карта',
        amount: '0.20',
        method: 'Карта',
      },
      { id: 'bar', date: '2026-11-06', category: 'Бар', amount: '999' },
      { id: 'deposit', kind: 'deposit', date: '2026-11-06', amount: '100' },
    ],
    'cash-events': [],
  },
};
assert.equal(buildStatistics('selling_stat', f, totalsInput).blocks[0].rows[0].amount, '30');
const duplicateBuyer = {
  ...input,
  members: [input.members[0], { ...input.members[0], id: 9999 }],
  data: {
    ...input.data,
    ledger: [
      {
        id: 'ambiguous',
        date: '2026-11-06',
        category: 'Абонементы',
        club: 'Центральный',
        amount: '100',
        client: input.members[0].name,
      },
    ],
  },
};
assert.equal(
  buildStatistics('clients_rating', f, duplicateBuyer).blocks[0].rows.length,
  0,
  'Ambiguous legacy names must not be assigned to the first matching person',
);
const unknownVisit = { ...input, visits: [{ ...input.visits[0], memberId: 9999 }] };
assert.equal(
  buildStatistics('timetoabstat', { ...f, gender: 'Женский' }, unknownVisit).blocks[0].rows.length,
  0,
  'Unknown demographics must not pass a gender filter',
);
const empty = buildStatistics(
  'selling_stat',
  { ...f, from: '2020-01-01', to: '2020-01-02', compare: 'previous' },
  input,
);
assert.equal(empty.blocks[0].rows.length, 0);
assert.ok(empty.metrics.at(-1).note.includes('не рассчитывается'));
const weighted = buildStatistics('gtrener_rating', f, {
  ...input,
  data: {
    ...input.data,
    events: [
      {
        ...event,
        id: 'a',
        trainerId: 'test-trainer',
        trainer: 'Тренер',
        capacity: '2',
        booked: '2',
      },
      {
        ...event,
        id: 'b',
        trainerId: 'test-trainer',
        trainer: 'Тренер',
        capacity: '8',
        booked: '0',
      },
    ],
  },
});
assert.equal(
  weighted.blocks[0].rows[0].occupancy,
  '20',
  'Weighted occupancy, not mean percentages',
);
const mixedTrainers = {
  ...input,
  data: {
    ...input.data,
    events: [
      { ...event, id: 'legacy', trainer: 'Алина Белова' },
      { ...event, id: 'new', trainer: 'Алина Белова', trainerId: 'user-trainer' },
    ],
  },
};
const mergedTrainer = buildStatistics(
  'ptrener_rating_all',
  { ...f, trainer: 'user-trainer' },
  mixedTrainers,
);
assert.equal(
  mergedTrainer.blocks[0].rows.length,
  1,
  'Legacy names and stable IDs must not split one trainer',
);
assert.equal(
  mergedTrainer.blocks[0].rows[0].count,
  '2',
  'Trainer filter includes legacy events too',
);
const hours = buildStatistics('ptrener_rating_all', f, {
  ...input,
  data: {
    ...input.data,
    'trainer-duty': [],
    events: [
      { ...event, id: 'short', trainer: 'First', trainerId: 'first', duration: '30' },
      { ...event, id: 'long', trainer: 'Second', trainerId: 'second', duration: '90' },
    ],
  },
});
assert.equal(hours.blocks[0].rows[0].id, 'second', 'Working-hours ranking is sorted by hours');
assert.equal(buildStatistics('clients_ltv', f, input).metrics[2].value, '1 400 ₽');
assert.equal(
  buildStatistics('fail_finance_report', f, {
    ...input,
    data: { ...input.data, 'fiscal-results': [] },
  }).blocks[0].rows.length,
  0,
  'No receipt number does not imply fiscal failure',
);
// Source semantics: club liabilities, account debits and explicit fiscal results.
const liabilities = buildStatistics('fincredits', f, input);
assert.equal(liabilities.blocks[0].rows.find((r) => r.memberId === '1001').amount, '240000');
assert.ok(liabilities.blocks[2].rows.every((r) => r.plan !== 'Прокат полотенца'));
assert.ok(liabilities.notes.some((n) => n.includes('обязательства клуба')));
const noValuation = buildStatistics('fincredits', f, {
  ...input,
  data: { ...input.data, 'report-pass-values': [] },
});
assert.equal(noValuation.blocks[2].rows.length, 0);
assert.ok(noValuation.notes.some((n) => n.includes('Нет сохранённой цены')));
assert.equal(
  buildStatistics('clients_ltv_bydate', f, input).blocks[0].rows.find((r) => r.memberId === '1001')
    .amount,
  '150000',
);
assert.equal(
  buildStatistics('clients_ltv', f, input).blocks[0].rows.find((r) => r.memberId === '1001').amount,
  '300000',
);
assert.equal(
  buildStatistics('clients_ltv_bydate', { ...f, club: 'Парк' }, input).blocks[0].rows.length,
  1,
);
const discounts = buildStatistics('clients_sell_discount', f, input).blocks[0].rows;
assert.equal(discounts[0].original, '420000');
assert.equal(discounts[0].discount, '30000');
assert.equal(discounts[0].amount, '390000');
assert.equal(discounts.length, 1, 'Unknown historical discounts are excluded');
assert.equal(
  buildStatistics('feedbacks', { ...f, operator: 'Другой' }, input).blocks[0].rows.length,
  0,
);
assert.equal(
  buildStatistics(
    'ptrener_rating_all',
    { ...f, countPersonal: '0', countGroup: '0' },
    input,
  ).blocks[0].rows.reduce((n, r) => n + Number(r.dutyHours), 0),
  6,
);
const availability = {
  ...input,
  data: {
    ...input.data,
    events: [{ ...event, trainerId: 'user-trainer', day: f.to, time: '14:30', club: 'Парк' }],
  },
};
assert.ok(
  !buildStatistics(
    'free_trener_find',
    { ...f, club: 'Центральный', timeFrom: '14:00' },
    availability,
  ).blocks[0].rows.some((r) => r.name === 'Алина Белова'),
  'Cross-club conflicts also block a coach',
);
assert.equal(
  buildStatistics('free_trener_find', { ...f, timeFrom: '23:00', duration: '120' }, input).blocks
    .length,
  0,
);
assert.ok(buildStatistics('selling_clients_secondary', { ...f, renewalDays: '0' }, input).error);
const { shiftMonths } = await import(
  await load(new URL('../src/lib/statistics-details.ts', import.meta.url))
);
assert.equal(shiftMonths('2026-11-30', 3), '2027-02-28');
assert.equal(shiftMonths('2023-11-30', 3), '2024-02-29');
const life = buildStatistics('client_lifetime', { ...f, threshold: '1' }, input);
assert.equal(life.blocks[0].rows.filter((r) => !r.end).length, life.metrics[1].value);
assert.equal(
  buildStatistics('clients_segmetation', { ...f, segment: '0' }, input).blocks[1].rows.some(
    (r) => r.segment !== 'Активные клиенты',
  ),
  false,
);
const noPrice = buildStatistics(
  'selltovosit',
  { ...f, from: '2026-09-01' },
  { ...input, data: { ...input.data, 'report-pass-values': [] } },
);
assert.ok(noPrice.blocks[0].rows.length > 0);
assert.ok(
  noPrice.blocks[0].rows.every((r) => r.amount === '' && r.average === ''),
  'Missing price must not become a zero price',
);
assert.ok(
  buildStatistics('trener_financial_result', f, input).blocks[0].rows.every(
    (r) => r.month === '2026-11',
  ),
);
assert.equal(JSON.stringify(input), before, 'Detailed calculations must remain read-only');

// Chart contracts preserve the source's dimensions; chart values are the table's raw units.
const chartBefore = JSON.stringify(input);
for (const report of statisticsReports) {
  const output = buildStatistics(report.id, f, input);
  const saved = JSON.stringify(output);
  const charts = statisticsCharts(report.id, output, f);
  assert.equal(JSON.stringify(output), saved, 'Charts must not mutate tables');
  assert.equal(new Set(charts.map((c) => c.id)).size, charts.length, report.id);
  for (const chart of charts)
    for (const row of chart.rows) {
      assert.equal(row.values.length, chart.series.length);
      assert.ok(row.values.every((v) => v === null || (Number.isFinite(v) && v >= 0)));
    }
}
const distribution = statisticsCharts('unique_visits', unique, f)[0];
assert.equal(
  distribution.rows.reduce((n, r) => n + r.values[0], 0),
  unique.metrics[0].value,
  'Club-count distribution partitions people, not visits or clubs',
);
assert.ok(distribution.rows.some((r) => r.id === '2'));
for (const id of ['clients_rating', 'clients_rating_visit']) {
  const out = buildStatistics(id, f, input);
  assert.equal(
    statisticsCharts(id, out, f)[0].rows[0].values[0],
    Number(out.blocks[0].rows[0].value),
    'Client ratings cannot disappear because rows link to profiles',
  );
}
const parameterReport = buildStatistics('timetoabstat', f, input);
assert.equal(
  statisticsCharts('timetoabstat', parameterReport, f).length,
  7,
  'All source dimensions, including program and both pass dimensions',
);
const sexChart = statisticsCharts('timetoabstat', parameterReport, f).find(
  (c) => c.title === 'По полу',
);
assert.equal(
  sexChart.rows.reduce((n, r) => n + r.values[0], 0),
  new Set(input.visits.map((v) => v.memberId)).size,
  'Sex distribution counts clients, not their repeat visits',
);
const repeated = { ...input, visits: [input.visits[0], { ...input.visits[0], id: 'repeat' }] };
assert.equal(
  statisticsCharts(
    'clients_gender_age',
    buildStatistics('clients_gender_age', f, repeated),
    f,
  )[0].rows[0].values.reduce((n, v) => n + v, 0),
  2,
);
const uniqueFilter = { ...f, uniqueOnly: '1' };
assert.equal(
  statisticsCharts(
    'clients_gender_age',
    buildStatistics('clients_gender_age', uniqueFilter, repeated),
    uniqueFilter,
  )[0].rows[0].values.reduce((n, v) => n + v, 0),
  1,
);
const ageVisits = {
  ...input,
  members: [{ ...input.members[0], birthDate: '2008-11-06' }],
  visits: [input.visits[0]],
};
assert.equal(
  buildStatistics('timetoabstat', f, ageVisits).blocks.find((b) => b.title === 'По возрасту')
    .rows[0].name,
  '18–23',
);
const hoursChart = statisticsCharts('ptrener_rating_all', hours, f)[0];
assert.deepEqual(
  hoursChart.series.map((s) => s.key),
  ['personalHours', 'groupHours', 'dutyHours'],
);
const planCharts = statisticsCharts(
  'finbyyear_by_abonements',
  buildStatistics('finbyyear_by_abonements', f, input),
  f,
);
assert.deepEqual(
  planCharts.map((c) => c.series[0].key),
  ['amount', 'count'],
);
const chronological = { ...f, from: '2026-09-01' };
const revenue = statisticsCharts(
  'finbyyear',
  buildStatistics('finbyyear', chronological, input),
  chronological,
)[0];
assert.deepEqual(
  revenue.rows.map((r) => r.id),
  ['2026-09', '2026-10', '2026-11'],
);
assert.equal(
  revenue.reference.value,
  revenue.rows.reduce((n, r) => n + r.values[0], 0) / 3,
  'Average includes explicit months without saved sales',
);
const daily = statisticsCharts(
  'visit_by_period',
  buildStatistics('visit_by_period', f, input),
  f,
)[0];
assert.equal(daily.kind, 'lines');
assert.equal(daily.rows.length, 6);
assert.equal(
  daily.rows.reduce((n, r) => n + r.values[0], 0),
  input.visits.length,
);
assert.ok(
  daily.rows.every((r) => r.values[0] === r.values.slice(1).reduce((n, v) => n + v, 0)),
  'Daily total must equal club series',
);
const statuses = {
  metrics: [],
  notes: [],
  blocks: [
    {
      title: 'Покупка следующей карты',
      columns: [],
      rows: [
        { id: 'a', status: 'Продлил', anchor: '2026-01-01' },
        { id: 'b', status: 'Не продлил', anchor: '2026-02-01' },
        { id: 'c', status: 'Окно ещё открыто', anchor: '2026-03-01' },
      ],
    },
  ],
};
assert.deepEqual(
  statisticsCharts('selling_clients_secondary', statuses, f)[0].rows.map((r) => r.values[0]),
  [1, 1, 1],
  'Open windows are separate from failure',
);
assert.equal(JSON.stringify(input), chartBefore);

const csv = statisticsCsv([
  {
    title: 'Тест',
    columns: [{ key: 'name', label: 'Имя' }],
    rows: [
      { id: '1', name: '=1+1' },
      { id: '2', name: 'a;"b' },
    ],
  },
]);
assert.ok(csv.startsWith('\uFEFF'));
assert.ok(csv.includes("'=1+1"));
assert.ok(csv.includes('a;""b'));
assert.ok(
  statisticsCsv([
    {
      title: 'Test',
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ id: '1', name: '  =1+1' }],
    },
  ]).includes("'  =1+1"),
);
console.log(
  `Statistics: 48 catalogue entries; ${48 - Object.keys(reportPending).length} demo calculations; dates, Moscow time, uniqueness, no-shows, money, occupancy, CSV and immutability passed.`,
);
