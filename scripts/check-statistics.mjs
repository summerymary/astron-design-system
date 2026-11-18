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
const { statisticsReports, reportPending, catalogueReports } = await import(
  await load(new URL('../src/data/statistics.ts', import.meta.url))
);
const { statisticsCharts } = await import(
  await load(new URL('../src/lib/statistics-charts.ts', import.meta.url))
);
const { transferReportFilters } = await import(
  await load(new URL('../src/lib/statistics-navigation.ts', import.meta.url))
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
const contextFilters = {
  ...f,
  from: '2026-10-01',
  to: '2026-11-05',
  club: 'Парк',
  criterion: 'visit',
};
const staleFilters = { ...f, from: '2026-11-01', club: 'all' };
const transferred = transferReportFilters(
  'clients_new',
  'newclients_source',
  contextFilters,
  staleFilters,
);
assert.equal(
  transferred.club,
  'all',
  'A registration cohort must not acquire a hidden club restriction',
);
assert.equal(
  transferReportFilters('unique_visits', 'timetoabstat', contextFilters, staleFilters).club,
  'Парк',
  'A compatible visit view keeps the selected club',
);
assert.equal(
  transferReportFilters('unique_visits', 'clients_gender_age', contextFilters, staleFilters).clubs,
  'Парк',
  'Single-club scope maps into the audience multi-club control',
);
assert.equal(
  transferred.from,
  '2026-10-01',
  'Shared ranges update even after returning to a previously visited view',
);
assert.equal(
  transferred.criterion,
  'visit',
  'The sources and list use the same new-client criterion',
);
const ltvHistory = transferReportFilters('clients_ltv_bydate', 'clients_ltv', contextFilters, f);
assert.equal(ltvHistory.from, '1900-01-01');
assert.equal(ltvHistory.to, '2026-11-05');
const cumulativePeriod = transferReportFilters(
  'financeresult',
  'trener_financial_result',
  contextFilters,
  f,
);
assert.equal(cumulativePeriod.from, '2026-01-01');
assert.equal(cumulativePeriod.to, '2026-11-30');
const newCriterionRows = buildStatistics('clients_new', { ...f, criterion: 'visit' }, input)
  .blocks[0].rows;
const legacyCriterionRows = buildStatistics('newclients', { ...f, criterion: 'visit' }, input)
  .blocks[0].rows;
assert.deepEqual(
  legacyCriterionRows.map((r) => r.memberId),
  newCriterionRows.map((r) => r.memberId),
);
assert.equal(
  buildStatistics('newclients_source', { ...f, criterion: 'visit' }, input).blocks[0].rows.reduce(
    (n, r) => n + Number(r.count),
    0,
  ),
  newCriterionRows.length,
  'Source groups cover the same selected client cohort',
);
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
const financialMember = {
  ...input.members[0],
  id: 90001,
  name: 'Демо Покупатель',
  fullName: 'Демо Покупатель',
  plan: 'Групповые тренировки',
  joined: '02.11.2026',
  expires: '03.11.2026',
  birthDate: '2000-11-07',
  gender: 'Мужской',
};
const financialInput = {
  ...input,
  members: [financialMember],
  visits: [],
  data: {
    ledger: [
      {
        id: 'first',
        memberId: '90001',
        name: 'Групповые тренировки',
        category: 'Абонементы',
        date: '2026-11-02',
        club: 'Центральный',
        amount: '100',
        basePrice: '100',
        discountAmount: '0',
        method: 'Карта',
      },
      {
        id: 'second',
        memberId: '90001',
        name: 'Групповые тренировки',
        category: 'Абонементы',
        date: '2026-11-03',
        club: 'Центральный',
        amount: '300',
        basePrice: '350',
        discountAmount: '50',
        discountName: 'Демо акция',
        method: 'Лицевой счёт',
      },
      {
        id: 'gift-only',
        memberId: '90001',
        name: 'Товар',
        category: 'Товары',
        date: '2026-11-04',
        club: 'Парк',
        amount: '90',
        method: 'Подарочная карта',
      },
    ],
    'cash-events': [
      { id: 'deposit', kind: 'deposit', date: '2026-11-03', club: 'Центральный', amount: '30' },
      {
        id: 'withdrawal',
        kind: 'withdrawal',
        date: '2026-11-04',
        club: 'Центральный',
        amount: '20',
      },
      {
        id: 'refund',
        kind: 'refund',
        date: '2026-11-05',
        club: 'Центральный',
        amount: '10',
        method: 'Карта',
      },
    ],
  },
};
const financialBefore = JSON.stringify(financialInput);
const newSales = buildStatistics(
  'selling_clients_new',
  { ...f, criterion: 'purchase' },
  financialInput,
);
assert.equal(newSales.blocks[0].rows[0].count, '1', 'One first membership per new client');
assert.equal(newSales.blocks[0].rows[0].amount, '10000');
const salesBreakdown = buildStatistics('selling_stat', f, financialInput);
const planSales = salesBreakdown.blocks[0].rows.find((r) => r.name === 'Групповые тренировки');
assert.equal(planSales.card, '10000');
assert.equal(planSales.account, '30000');
assert.equal(planSales.other, '0');
assert.equal(
  salesBreakdown.blocks.find((b) => b.detail === `${planSales.detailKey}:buyers`).rows.length,
  1,
);
assert.equal(
  buildStatistics('selling_stat', { ...f, includeMemberships: '0' }, financialInput).blocks[0].rows
    .length,
  1,
);
const cashReport = buildStatistics('kassacontrol', f, financialInput);
assert.equal(
  cashReport.blocks[0].rows.reduce((n, r) => n + Number(r.income) - Number(r.expense), 0),
  10000,
  'Account/gift redemption is not another cash inflow',
);
assert.equal(
  buildStatistics('kassacontrol', { ...f, payment: 'withdrawal' }, financialInput).blocks[0].rows
    .length,
  1,
);
const buyersAge = buildStatistics('clients_sell_gender_age', f, financialInput);
assert.equal(buyersAge.blocks[0].rows[0].name, '25 лет', 'Age at end of interval before birthday');
assert.equal(buyersAge.blocks[0].rows[0].male, '49000', 'Buyer pyramid uses money, not people');
assert.equal(Number(buyersAge.blocks[1].rows[0].male), Math.round(49000 / 3));
assert.equal(
  buildStatistics('clients_sell_gender_age', f, {
    ...financialInput,
    members: [{ ...financialMember, birthDate: '1000-01-01' }],
  }).blocks[0].rows[0].name,
  'Возраст не известен',
);
const discountSummary = buildStatistics('clients_sell_discount', f, financialInput).blocks.find(
  (b) => b.title === 'Продажи по скидкам',
);
assert.deepEqual(
  discountSummary.rows.map((r) => r.name).sort(),
  ['Без скидки', 'Демо акция', 'Скидка не известна'].sort(),
);
const financeReport = buildStatistics(
  'financeresult',
  { ...f, club: 'Центральный' },
  {
    ...financialInput,
    data: {
      'finance-revenue': [
        {
          id: 'rev',
          date: '2026-11-03',
          club: 'Центральный',
          kind: 'group',
          amount: '200',
          visits: '4',
        },
      ],
      'trainer-costs': [
        { id: 'cost', date: '2026-11-03', club: 'Центральный', kind: 'group', amount: '50' },
      ],
    },
  },
);
assert.equal(financeReport.blocks[0].rows.find((r) => r.id === 'group:profit').total, '15000');
assert.equal(
  financeReport.blocks[0].rows.find((r) => r.id === 'personal:profit').total,
  '',
  'Unknown cost/revenue must not become profit zero',
);
const advance = buildStatistics('selling_clients_secondary', f, {
  ...financialInput,
  members: [{ ...financialMember, joined: '01.10.2026' }],
  data: {
    'report-pass-values': [
      { id: 'value', passId: 'S-90001-01', price: '100', club: 'Центральный' },
    ],
    'issued-plans': [
      {
        id: 'advance',
        memberId: '90001',
        name: 'Групповые тренировки',
        kindId: 'group',
        purchasePrice: '300',
        issued: '2026-10-28',
        club: 'Центральный',
        visits: '12',
      },
    ],
    'pass-usage': [
      {
        id: 'usage',
        memberId: '90001',
        passId: 'advance',
        used: '0',
        remaining: '12',
        activatedAt: '04.11.2026',
        endsAt: '04.12.2026',
      },
    ],
  },
});
assert.equal(
  advance.blocks[0].rows.find((r) => r.memberId === '90001').status,
  'Продлил',
  'Advance purchase counts when its new term exceeds old term',
);
assert.equal(JSON.stringify(financialInput), financialBefore);
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
  ['amount', 'count', 'share'],
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

// Source parity: totals must deduplicate people and days across branches.
const uniqueProbe = buildStatistics(
  'unique_visits',
  { ...f, from: '2026-11-01', to: '2026-11-02' },
  {
    ...input,
    visits: [
      {
        ...input.visits[0],
        id: 'u1',
        enteredAt: '2026-11-01T10:00',
        memberId: 1001,
        clubId: 'central',
        kind: 'gym',
      },
      {
        ...input.visits[0],
        id: 'u2',
        enteredAt: '2026-11-01T12:00',
        memberId: 1001,
        clubId: 'park',
        kind: 'gym',
      },
      {
        ...input.visits[0],
        id: 'u3',
        enteredAt: '2026-11-02T10:00',
        memberId: 1001,
        clubId: 'central',
        kind: 'personal',
      },
      {
        ...input.visits[0],
        id: 'u4',
        enteredAt: '2026-11-01T13:00',
        memberId: 1002,
        clubId: 'central',
        kind: 'group',
      },
    ],
  },
);
const networkRow = uniqueProbe.blocks[0].rows.find((r) => r.id === 'network-total');
assert.equal(networkRow.clients, '2');
assert.equal(networkRow.visits, '4');
assert.equal(
  networkRow.dailyUnique,
  '3',
  'One person/day across clubs, not a sum of branch totals',
);
assert.equal(networkRow.average, '2.00');
assert.equal(networkRow.perDay, '2.00', 'Calendar days include empty dates');
assert.equal(uniqueProbe.blocks[1].rows.find((r) => r.id === 'network-total').share, '50.00');
const emptyUnique = buildStatistics('unique_visits', f, { ...input, visits: [] });
assert.equal(emptyUnique.blocks[0].rows.find((r) => r.id === 'network-total').average, '');
assert.equal(emptyUnique.metrics[0].value, 0);

const ratingCards = catalogueReports(statisticsReports);
assert.equal(
  ratingCards.length,
  18,
  'All source routes remain available in eighteen task families',
);
assert.equal(
  ratingCards.filter((r) => ['clients_rating', 'clients_rating_visit', 'notcame'].includes(r.id))
    .length,
  1,
);
assert.ok(
  ratingCards.find((r) => r.id === 'clients_rating_visit').description.includes('пропуски'),
);
assert.equal(
  catalogueReports(statisticsReports.filter((r) => r.id === 'notcame')).length,
  1,
  'A limited catalogue must retain an available rating route',
);
const exactThreshold = buildStatistics(
  'notcame',
  { ...f, threshold: '3' },
  {
    ...input,
    data: {
      ...input.data,
      events: Array.from({ length: 3 }, (_, i) => ({
        ...event,
        id: `miss-${i}`,
        attendees: '1002,1002',
      })),
    },
  },
);
assert.equal(
  exactThreshold.blocks[0].rows[0].count,
  '3',
  'Inclusive minimum, duplicate roster IDs count once',
);

const { reportMonth, nextBirthday } = await import(
  await load(new URL('../src/lib/report-period.ts', import.meta.url))
);
assert.deepEqual(reportMonth('2024-02'), { from: '2024-02-01', to: '2024-02-29' });
assert.deepEqual(reportMonth('2026-12'), { from: '2026-12-01', to: '2026-12-31' });
assert.equal(reportMonth('2026-13'), null);
assert.equal(nextBirthday('2000-02-29', '2027-02-01'), '2027-02-28');
assert.equal(nextBirthday('2000-02-29', '2028-02-01'), '2028-02-29');
assert.equal(nextBirthday('2000-02-31', '2026-11-01'), null);
const birthdayWindow = buildStatistics(
  'birdthday',
  { ...f, from: '2000-01-01', to: '2000-01-02' },
  {
    ...input,
    at: '2026-12-20T23:59',
    data: {},
    members: [
      { ...input.members[0], id: 1, birthDate: '2000-12-20' },
      { ...input.members[0], id: 2, birthDate: '2000-01-18' },
      { ...input.members[0], id: 3, birthDate: '2000-01-19' },
      { ...input.members[0], id: 4, birthDate: '' },
    ],
  },
);
assert.deepEqual(
  birthdayWindow.blocks[0].rows.map((r) => [r.memberId, r.birthday, r.days]),
  [
    ['1', '2026-12-20', '0'],
    ['2', '2027-01-18', '29'],
  ],
  'Birthdays use the current 30-day window across years, not the old report dates',
);
const wholeMonthFilters = { ...f, ...reportMonth('2026-11') };
const wholeMonth = buildStatistics('visit_by_period', wholeMonthFilters, input);
assert.equal(wholeMonth.blocks[0].rows.length, 30);
assert.equal(wholeMonth.blocks[0].rows[6].total, '', 'Future day is unknown, never zero');
const futureMonthFilters = { ...f, ...reportMonth('2026-12') };
const futureMonth = buildStatistics('visit_by_period', futureMonthFilters, input);
assert.ok(futureMonth.metrics.every((metric) => metric.value === '—'));
assert.equal(statisticsCharts('visit_by_period', futureMonth, futureMonthFilters).length, 0);
const monthSeries = statisticsCharts('visit_by_period', wholeMonth, wholeMonthFilters)[0];
assert.equal(
  monthSeries.rows.length,
  6,
  'Line stops at today like the source; future dates stay in the table',
);
assert.equal(
  monthSeries.rows[5].values[0],
  input.visits.filter((v) => v.enteredAt.startsWith('2026-11-06')).length,
);
assert.ok(
  monthSeries.rows
    .filter((r) => r.values[0] !== null)
    .every((r) => r.values[0] === r.values.slice(1).reduce((sum, value) => sum + value, 0)),
);
const branchMonth = buildStatistics(
  'visit_by_period',
  { ...wholeMonthFilters, club: 'Парк' },
  input,
);
assert.equal(branchMonth.blocks[0].columns.length, 3, 'Day, total, selected club only');

const programVisits = [0, 1, 2].map((n) => ({
  ...input.visits[0],
  id: `pg-${n}`,
  memberId: n === 2 ? 1002 : 1001,
  kind: 'group',
  enteredAt: `2026-11-06T11:0${n}`,
  passId: n === 2 ? 'S-1002-01' : 'S-1001-01',
}));
const programData = {
  ...input.data,
  events: [{ ...event, id: 'pg-event', name: 'Пилатес', intensity: 'Низкая', group: 'Баланс' }],
  'visit-bookings': programVisits.map((visit) => ({
    id: visit.id,
    memberId: String(visit.memberId),
    date: visit.enteredAt,
    passId: visit.passId,
    eventId: 'pg-event',
  })),
};
const programReport = buildStatistics('timetoabstat', f, {
  ...input,
  visits: programVisits,
  data: programData,
});
assert.equal(
  programReport.blocks.find((b) => b.title === 'Направления групповых программ').rows[0].clients,
  '2',
);
assert.equal(
  programReport.blocks.find((b) => b.title === 'Популярность групповых программ').rows[0].name,
  'Пилатес',
);
assert.equal(
  programReport.blocks.find((b) => b.title === 'Популярность групповых программ').rows[0].count,
  '3',
);
assert.equal(
  programReport.blocks.find((b) => b.title === 'По названиям абонементов').rows[0].passes,
  '2',
  'Repeat visits do not add subscriptions',
);
assert.equal(
  programReport.blocks
    .find((b) => b.title === 'По полу')
    .rows.reduce((sum, row) => sum + Number(row.clients), 0),
  2,
);
assert.equal(
  buildStatistics(
    'timetoabstat',
    { ...f, timeFrom: '18:00', timeTo: '20:00' },
    { ...input, visits: programVisits, data: programData },
  ).metrics[0].value,
  0,
);

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

// Screenshot contracts: membership-based segmentation, never-visited selection,
// gender cohort arithmetic and permission-safe call rows.
const { clientSegment } = await import(
  await load(new URL('../src/lib/client-segments.ts', import.meta.url))
);
const pass = {
  id: 'fixture',
  name: 'Железная карта',
  kindId: 'gym',
  used: 0,
  remaining: null,
  boughtAt: '2020-01-01',
  activatedAt: '2020-01-01',
  endsAt: '2026-11-05',
  status: 'expired',
};
for (const [gap, index] of [
  [1, 2],
  [30, 2],
  [31, 3],
  [90, 3],
  [91, 4],
  [180, 4],
  [181, 5],
  [365, 5],
  [366, 6],
  [1095, 6],
  [1096, 7],
]) {
  const ended = new Date(Date.parse('2026-11-06') - gap * 86400000).toISOString().slice(0, 10);
  assert.equal(
    clientSegment([{ ...pass, endsAt: ended }], '2026-11-06').index,
    index,
    `Segment boundary ${gap}`,
  );
}
assert.equal(
  clientSegment([{ ...pass, endsAt: '2026-11-06', status: 'active' }], '2026-11-06').index,
  0,
);
assert.equal(
  clientSegment([{ ...pass, endsAt: null, activatedAt: null, status: 'pending' }], '2026-11-06')
    .index,
  1,
);
assert.equal(clientSegment([], '2026-11-06').index, 8);
assert.equal(
  clientSegment([{ ...pass, endsAt: '2026-12-01', status: 'paused' }], '2026-11-06').index,
  8,
);
assert.equal(
  clientSegment(
    [{ ...pass, boughtAt: '2026-12-01', endsAt: null, activatedAt: null, status: 'pending' }],
    '2026-11-06',
  ).index,
  8,
);
const noHistoryMember = {
  ...initialMembers[0],
  id: 9001,
  name: 'Тестов Тест Тестович',
  joined: '2026-01-01',
  expires: '2026-12-31',
  plan: 'Железная карта',
  visits: 0,
  status: 'active',
};
const neverInput = {
  ...input,
  members: [noHistoryMember],
  visits: [
    {
      ...input.visits[0],
      id: 'old-group',
      memberId: 9001,
      kind: 'group',
      enteredAt: '2026-01-02T10:00',
    },
  ],
};
assert.equal(
  buildStatistics('client_never', f, neverInput).blocks[0].rows.length,
  1,
  'Group visits do not disqualify gym+PT cohort',
);
assert.equal(
  buildStatistics('client_never', { ...f, kind: 'group' }, neverInput).blocks[0].rows.length,
  0,
  'Full history, before the period, is checked',
);
const pendingInput = {
  ...neverInput,
  visits: [],
  data: {
    ...input.data,
    'membership-overrides': [
      { id: 'o', memberId: '9001', passId: 'S-9001-01', status: 'expired', remaining: '0' },
    ],
    'issued-plans': [
      {
        id: 'pending-9001',
        memberId: '9001',
        name: 'Групповые тренировки',
        kindId: 'group',
        visits: '12',
        issued: '2026-11-01',
        boughtAt: '2026-11-01',
      },
    ],
  },
};
assert.equal(
  buildStatistics('client_never', f, pendingInput).blocks[0].rows.length,
  1,
  'Unactivated memberships qualify',
);
const ageReport = buildStatistics('clients_gender_age', f, repeated);
const ageRow = ageReport.blocks[0].rows[0];
const sex = Number(ageRow.male) ? 'male' : 'female';
assert.equal(ageRow[sex + 'Clients'], '1');
assert.equal(ageRow[sex + 'Average'], '2.00');
assert.equal(statisticsCharts('clients_gender_age', ageReport, f)[0].kind, 'pyramid');
assert.equal(
  buildStatistics('clients_gender_age', { ...f, onlyPersonal: '1' }, repeated).metrics[1].value,
  repeated.visits.filter((v) => v.kind === 'personal').length,
);
assert.equal(
  buildStatistics('clients_gender_age', { ...f, clubs: 'Речной' }, repeated).metrics[1].value,
  0,
);
assert.equal(reportAge('0986-01-01', '2026-11-06'), null, 'Impossible ages are unknown');
const calls = buildStatistics('calls', f, input);
assert.equal(calls.blocks[0].rows.length, 3);
assert.equal(buildStatistics('calls', { ...f, onlyUnknown: '1' }, input).blocks[0].rows.length, 1);
assert.equal(buildStatistics('calls', { ...f, club: 'Парк' }, input).blocks[0].rows.length, 1);
assert.ok(
  buildStatistics('calls', f, { ...input, hidePhones: true }).blocks[0].rows.every((row) =>
    row.phone.includes('•'),
  ),
);
for (const report of statisticsReports)
  assert.ok(
    buildStatistics(report.id, f, input).metrics.every((m) => !m.label.includes('Строк')),
    report.id,
  );
// Trainer report parity: full-week boundaries, explicit formats, relationships and costs.
const { reportWeek } = await import(
  await load(new URL('../src/lib/report-period.ts', import.meta.url))
);
assert.deepEqual(reportWeek('2027-01-03'), { from: '2026-12-28', to: '2027-01-03' });
assert.equal(reportWeek('2026-02-30'), null);
const coachEvent = {
  ...event,
  name: 'Тестовое занятие',
  kind: 'personal',
  trainerId: 'user-trainer',
  trainer: 'Алина Белова',
};
const coachData = { ...input.data, events: [], 'trainer-duty': [], 'personal-clients': [] };
const busy = buildStatistics(
  'gtrener_busy',
  { ...f, to: '2026-11-08' },
  {
    ...input,
    data: {
      ...coachData,
      events: [
        { ...coachEvent, id: 'mon', day: '2026-11-02', time: '07:15' },
        { ...coachEvent, id: 'sun', day: '2026-11-08', time: '19:30' },
        { ...coachEvent, id: 'sun', day: '2026-11-08', time: '19:30' },
        { ...coachEvent, id: 'next', day: '2026-11-09' },
        { ...coachEvent, id: 'cancel', day: '2026-11-08', status: 'Отменена' },
      ],
    },
  },
);
assert.equal(busy.blocks[0].columns.length, 8);
assert.equal(
  busy.metrics[0].value,
  2,
  'Week includes Sunday, excludes next Monday, cancellations and duplicate IDs',
);
assert.ok(busy.blocks[0].rows[0].day0.includes('Алина Белова'));
assert.ok(busy.blocks[0].rows[1].day6.includes('Тестовое занятие'));
const classifiedInput = {
  ...input,
  data: {
    ...coachData,
    events: [
      { ...coachEvent, id: 'individual', personalFormat: 'individual', duration: '30' },
      {
        ...coachEvent,
        id: 'spt',
        personalFormat: 'spt',
        duration: '90',
        attendees: '1001,1001,1003',
      },
    ],
  },
};
const ptRating = buildStatistics('ptrener_rating', f, classifiedInput).blocks[0].rows[0];
assert.equal(ptRating.individual, '1');
assert.equal(ptRating.spt, '1');
assert.equal(ptRating.sptClients, '2');
assert.equal(ptRating.unique, '3');
const ptHours = buildStatistics('ptrener_rating_all', f, classifiedInput).blocks[0].rows[0];
assert.equal(ptHours.personalHours, '2.0');
assert.equal(ptHours.individualHours, '0.5');
assert.equal(ptHours.sptHours, '1.5');
assert.equal(
  buildStatistics('ptrener_rating', f, { ...input, data: { ...coachData, events: [coachEvent] } })
    .blocks[0].rows[0].spt,
  '',
  'Unknown SPT must not become zero',
);
const relationships = {
  ...input,
  data: {
    ...coachData,
    'personal-clients': [{ id: 'assigned', memberId: '1001', trainerId: 'trainer-maxim' }],
    events: [
      { ...coachEvent, id: 'old-coach', day: '2026-10-01', attendees: '1001', present: '1001' },
      {
        ...coachEvent,
        id: 'new-coach',
        day: '2026-11-05',
        trainerId: 'trainer-maxim',
        attendees: '1001',
        present: '1001',
      },
      {
        ...coachEvent,
        id: 'future-present',
        day: '2026-11-07',
        attendees: '1001',
        present: '1001',
      },
    ],
  },
};
const lostCoach = buildStatistics(
  'report_pclients_stat',
  { ...f, from: '2026-10-01', to: '2026-11-08', threshold: '21', trainer: 'user-trainer' },
  relationships,
);
assert.equal(
  lostCoach.metrics[2].value,
  1,
  'Changing trainer does not erase loss from former trainer',
);
assert.equal(
  lostCoach.blocks[0].rows[0].last,
  '2026-10-01',
  'Future presence cannot improve retention',
);
const contacts = buildStatistics(
  'report_pclients_phones',
  { ...f, from: '2026-10-01' },
  { ...relationships, hidePhones: true },
);
assert.equal(contacts.blocks[0].rows.length, 1, 'Contacts deduplicate clients across trainers');
assert.ok(contacts.blocks[0].rows[0].phone.includes('•'));
assert.ok(!statisticsCsv(contacts.blocks).includes(input.members[0].phone));
const freeFixture = {
  ...input,
  data: {
    ...coachData,
    'trainer-availability': [
      {
        id: 'window',
        trainerId: 'user-trainer',
        club: 'Центральный',
        day: f.to,
        time: '08:00',
        end: '18:00',
      },
      {
        id: 'window-copy',
        trainerId: 'user-trainer',
        club: 'Центральный',
        day: f.to,
        time: '08:00',
        end: '18:00',
      },
    ],
    events: [{ ...coachEvent, day: f.to, time: '13:00', duration: '60' }],
  },
};
assert.equal(
  buildStatistics('free_trener_find', { ...f, timeFrom: '14:00', duration: '60' }, freeFixture)
    .blocks[0].rows.length,
  1,
  'Adjacent event is allowed, duplicate window is not a second coach',
);
assert.equal(
  buildStatistics('free_trener_find', { ...f, timeFrom: '13:59', duration: '60' }, freeFixture)
    .blocks[0].rows.length,
  0,
);
assert.equal(
  buildStatistics(
    'free_trener_find',
    { ...f, timeFrom: '14:00' },
    { ...freeFixture, data: { ...freeFixture.data, 'trainer-availability': [] } },
  ).blocks[0].rows.length,
  0,
  'Missing working window is not free time',
);
const financeFixture = {
  ...input,
  data: {
    ...coachData,
    ledger: [
      {
        id: 'pt-sale',
        date: f.to,
        club: 'Центральный',
        category: 'Персональный тренинг',
        name: 'Персональные тренировки',
        kindId: 'personal',
        amount: '4000',
        trainerId: 'user-trainer',
      },
      {
        id: 'gp-sale',
        date: f.to,
        club: 'Центральный',
        category: 'Абонементы',
        name: 'Групповые тренировки',
        kindId: 'group',
        amount: '9000',
        trainerId: 'user-trainer',
      },
    ],
    'trainer-costs': [
      {
        id: 'pt-cost',
        date: f.to,
        club: 'Центральный',
        trainerId: 'user-trainer',
        kind: 'personal',
        amount: '1000',
      },
      {
        id: 'gp-cost',
        date: f.to,
        club: 'Центральный',
        trainerId: 'user-trainer',
        kind: 'group',
        amount: '6000',
      },
    ],
  },
};
const finance = buildStatistics('trener_financial_result', f, financeFixture);
const coachTotal = finance.blocks[1].rows.find((r) => r.id === 'user-trainer');
assert.equal(coachTotal.amount, '400000');
assert.equal(coachTotal.expense, '100000');
assert.equal(coachTotal.percent, '25', 'PT result excludes GP sales and GP pay');
assert.equal(
  finance.blocks[1].rows.find((r) => r.id === 'trainer-maxim').percent,
  '',
  'No sales gives an unknown percentage, never NaN',
);
const groupedGp = buildStatistics(
  'gt_finance',
  { ...f, groupByTrainer: '1', reportSort: 'all_shedules' },
  {
    ...input,
    data: {
      ...coachData,
      events: [
        { ...coachEvent, kind: 'group', id: 'gp-a' },
        { ...coachEvent, kind: 'group', id: 'gp-b' },
        { ...coachEvent, id: 'pt-excluded' },
      ],
    },
  },
);
assert.equal(groupedGp.blocks[0].rows.length, 1);
assert.equal(groupedGp.blocks[0].rows[0].lessons, '2');
assert.equal(groupedGp.blocks[0].rows[0].tariff, '', 'Unknown trainer rate remains unknown');

// Follow-up screenshot contracts: distribution, observation dates and historical cohorts.
const ltvSummary = buildStatistics('clients_ltv', f, input).blocks.find(
  (b) => b.title === 'Сводка LTV',
);
const ltvAmounts = buildStatistics('clients_ltv', f, input).blocks[0].rows.map((r) =>
  Number(r.amount),
);
assert.equal(
  Number(ltvSummary.rows.find((r) => r.id === 'minimum').amount),
  Math.min(...ltvAmounts),
);
assert.equal(
  Number(ltvSummary.rows.find((r) => r.id === 'maximum').amount),
  Math.max(...ltvAmounts),
);
assert.equal(ltvSummary.rows.find((r) => r.id === 'average').amount, '140000');
const futureRevenue = buildStatistics(
  'finbyyear',
  { ...f, from: '2026-01-01', to: '2026-12-31' },
  input,
);
assert.equal(futureRevenue.blocks[0].rows.find((r) => r.id === '2026-12').amount, '');
const futureChart = statisticsCharts('finbyyear', futureRevenue, f)[0];
assert.equal(futureChart.rows.find((r) => r.id === '2026-12').values[0], null);
assert.equal(
  futureChart.reference.value,
  futureChart.rows.reduce((n, r) => n + (r.values[0] || 0), 0) / 11,
  'Future month does not lower average',
);
const mix = buildStatistics('finbyyear_by_abonements', f, input).blocks[0].rows;
assert.ok(Math.abs(mix.reduce((n, r) => n + Number(r.countShare), 0) - 100) < 0.0001);
assert.ok(Math.abs(mix.reduce((n, r) => n + Number(r.share), 0) - 100) < 0.0001);
const obligationSummary = noValuation.blocks.find(
  (b) => b.title === 'Сводка обязательств перед клиентами',
);
assert.ok(
  obligationSummary.rows
    .filter((r) => ['pending', 'active'].includes(r.id))
    .every((r) => Number(r.unknown) === 0 || r.average === ''),
  'Missing card values cannot produce a cheap average',
);
const counts = [0, 4, 5, 10, 20, 30, 40, 50, 60, 80];
const frequencyMembers = counts.map((_, i) => ({
  ...financialMember,
  id: 91001 + i,
  name: 'Частота ' + i,
  fullName: 'Частота ' + i,
  plan: 'Железная карта',
  joined: '01.10.2026',
  expires: '30.10.2026',
  visits: 1,
}));
const frequencyInput = {
  members: frequencyMembers,
  visits: counts.flatMap((n, i) =>
    Array.from({ length: n }, (_, j) => ({
      id: i + ':' + j,
      memberId: 91001 + i,
      passId: 'S-' + (91001 + i) + '-01',
      plan: 'Железная карта',
      kind: 'gym',
      clubId: 'central',
      enteredAt: '2026-10-20T12:00',
    })),
  ),
  data: {},
  at: '2026-10-30T23:59',
};
const frequencyFilters = { ...f, from: '2026-10-01', to: '2026-10-30' };
const frequency = buildStatistics('unlim_avg_visit', frequencyFilters, frequencyInput);
assert.deepEqual(
  frequency.blocks[0].rows.map((r) => Number(r.count)),
  [2, 1, 1, 1, 1, 1, 1, 2],
  'Every boundary is assigned once, including 50–60',
);
assert.equal(frequency.blocks[1].rows.find((r) => r.memberId === '91008').frequency, '50');
const doubledPass = {
  ...frequencyInput,
  members: [frequencyMembers[1]],
  visits: [{ ...frequencyInput.visits[0], memberId: 91002, passId: undefined }],
  data: {
    'issued-plans': [
      {
        id: 'overlap',
        name: 'Железная карта',
        memberId: '91002',
        type: 'Безлимитный',
        issued: '2026-10-01',
      },
    ],
    'pass-usage': [
      {
        id: 'overlap-usage',
        memberId: '91002',
        passId: 'overlap',
        used: '0',
        remaining: 'unlimited',
        activatedAt: '01.10.2026',
        endsAt: '30.10.2026',
      },
    ],
  },
};
const ambiguousFrequency = buildStatistics('unlim_avg_visit', frequencyFilters, doubledPass);
assert.equal(
  ambiguousFrequency.blocks[1].rows[0].days,
  '30',
  'Overlapping passes do not double exposure',
);
assert.equal(
  ambiguousFrequency.blocks[1].rows[0].frequency,
  '',
  'Ambiguous legacy visit is unknown rather than zero',
);
const guestMember = {
  ...financialMember,
  id: 92001,
  plan: 'Гостевой визит',
  joined: '01.01.2026',
  expires: '07.01.2026',
};
const guestInput = {
  members: [guestMember],
  visits: [],
  at: '2026-06-01T12:00',
  data: {
    'report-pass-values': [
      {
        id: 'guest-value',
        memberId: '92001',
        passId: 'S-92001-01',
        price: '0',
        club: 'Центральный',
      },
    ],
    'issued-plans': [
      {
        id: 'guest-paid',
        memberId: '92001',
        name: 'Групповые тренировки',
        kindId: 'group',
        purchasePrice: '1000',
        issued: '2026-03-01',
        club: 'Центральный',
        visits: '12',
      },
    ],
  },
};
const guestResult = buildStatistics(
  'selling_clients_afterguest',
  { ...f, from: '2026-01-01', to: '2026-06-01' },
  guestInput,
);
assert.equal(
  guestResult.blocks[0].rows[0].status,
  'Продлил',
  'Purchase after more than 30 days is not arbitrarily excluded',
);
assert.equal(guestResult.blocks.find((b) => b.title === 'Итоги по годам').rows[0].converted, '1');
const summerInput = {
  ...guestInput,
  at: '2026-11-06T12:00',
  data: {
    'issued-plans': [
      {
        id: 'summer25',
        memberId: '92001',
        name: 'Групповые тренировки',
        kindId: 'group',
        issued: '2025-06-01',
        club: 'Центральный',
        visits: '12',
      },
      {
        id: 'paid25',
        memberId: '92001',
        name: 'Групповые тренировки',
        kindId: 'group',
        issued: '2025-10-15',
        club: 'Центральный',
        purchasePrice: '1000',
        visits: '12',
      },
      {
        id: 'summer26',
        memberId: '92001',
        name: 'Групповые тренировки',
        kindId: 'group',
        issued: '2026-06-01',
        club: 'Центральный',
        visits: '12',
      },
    ],
    'report-pass-values': [
      {
        id: 'v25',
        memberId: '92001',
        passId: 'summer25',
        price: '1000',
        club: 'Центральный',
        summer: 'true',
      },
      {
        id: 'v26',
        memberId: '92001',
        passId: 'summer26',
        price: '1000',
        club: 'Центральный',
        summer: 'true',
      },
    ],
    'pass-usage': [
      {
        id: 'u25',
        memberId: '92001',
        passId: 'summer25',
        used: '12',
        remaining: '0',
        activatedAt: '01.06.2025',
        endsAt: '30.09.2025',
      },
      {
        id: 'u26',
        memberId: '92001',
        passId: 'summer26',
        used: '12',
        remaining: '0',
        activatedAt: '01.06.2026',
        endsAt: '30.09.2026',
      },
    ],
  },
};
const summerResult = buildStatistics(
  'selling_clients_secondary_summer',
  { ...f, from: '2025-01-01' },
  summerInput,
);
assert.deepEqual(
  summerResult.blocks.find((b) => b.title === 'Итоги по годам').rows.map((r) => r.name),
  ['2025', '2026'],
);
assert.equal(
  summerResult.blocks[0].rows.find((r) => r.anchor.startsWith('2026')).status,
  'Окно ещё открыто',
);
const annualFinance = buildStatistics(
  'trener_financial_result',
  { ...f, from: '2026-01-01', to: '2026-12-31' },
  financeFixture,
);
const matrix = annualFinance.blocks.find((b) => b.title === 'Накопительный результат ПТ');
assert.equal(matrix.rows.find((r) => r.id === 'user-trainer')['2026-11:percent'], '25');
assert.equal(matrix.rows.find((r) => r.id === 'user-trainer')['2026-12:amount'], '');
const emptyYearFinance = buildStatistics(
  'trener_financial_result',
  { ...f, from: '2025-01-01', to: '2025-12-31' },
  financeFixture,
);
assert.ok(
  emptyYearFinance.blocks
    .find((b) => b.title === 'Накопительный результат ПТ')
    .rows.some((r) => r.id === 'user-trainer' && r['2025-01:amount'] === ''),
  'Empty year preserves trainer and calendar structure with unknown amounts',
);
const noExpiryFrequency = buildStatistics('unlim_avg_visit', frequencyFilters, {
  ...frequencyInput,
  members: [{ ...frequencyMembers[0], expires: '' }],
});
assert.equal(
  noExpiryFrequency.metrics[2].value,
  1,
  'Missing unlimited duration stays in the unknown cohort',
);
assert.equal(noExpiryFrequency.blocks[1].rows[0].frequency, '');
const exactGp = buildStatistics('gt_finance', f, {
  ...input,
  data: {
    ...coachData,
    events: [{ ...coachEvent, id: 'recorded-gp', kind: 'group', present: '1001' }],
    'event-finance': [
      {
        id: 'event-price',
        eventId: 'recorded-gp',
        tariff: '600',
        quantityRevenue: '200',
        unlimitedRevenue: '300',
      },
    ],
  },
}).blocks[0].rows[0];
assert.equal(exactGp.tariff, '60000');
assert.equal(exactGp.amount, '50000');
assert.equal(exactGp.average, '50000');

console.log(
  `Statistics: 48 definitions, 18 catalogue entries; ${48 - Object.keys(reportPending).length} demo calculations; dates, Moscow time, uniqueness, no-shows, money, occupancy, CSV and immutability passed.`,
);
