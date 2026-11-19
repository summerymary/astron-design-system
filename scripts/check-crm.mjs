import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
async function load(path) {
  const compiled = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const { parseStages, mainScenarioStages, scenarioIssue, stageMeaning, stageAction } =
  await load('../src/lib/crm.ts');
const { leadTransitions } = await load('../src/lib/workspace-rules.ts');
const { createWorkspaceData } = await load('../src/data/workspace.ts');
const data = createWorkspaceData();
const original = data.pipelines[0];
assert.deepEqual(parseStages(' Новая \r\n\n Связались \n'), ['Новая', 'Связались']);
assert.deepEqual(mainScenarioStages(original.stages), [
  'Новая',
  'Связались',
  'Пробное назначено',
  'Пробное пройдено',
  'Покупка',
]);
assert.equal(scenarioIssue(original, original, data.pipelines, data.leads), null);
assert.equal(
  scenarioIssue({ ...original, name: 'Новый процесс' }, original, data.pipelines, data.leads),
  null,
);
assert.match(scenarioIssue({ ...original, name: ' ' }, null, [], []), /название/);
assert.match(
  scenarioIssue(
    { ...original, id: 'new', name: original.name.toUpperCase() },
    null,
    data.pipelines,
    [],
  ),
  /названием/,
);
assert.match(
  scenarioIssue({ ...original, stages: 'Новая\nНет ответа\nОтказ' }, null, [], []),
  /два основных/,
);
assert.match(
  scenarioIssue({ ...original, stages: 'Новая\nновая\nПокупка' }, null, [], []),
  /повторяться/,
);
assert.match(
  scenarioIssue({ ...original, stages: 'Обращение\nСвязались\nПокупка' }, original, [], []),
  /Первый статус/,
);
assert.match(
  scenarioIssue({ ...original, stages: 'Новая\nПокупка' }, original, data.pipelines, [
    { id: 'lead-test', pipeline: original.name, stage: 'Связались' },
  ]),
  /используется/,
);
assert.equal(
  scenarioIssue(
    { ...original, stages: 'Новая\nСвязались\nПокупка' },
    original,
    [],
    [{ id: 'refused', pipeline: original.name, stage: 'Отказ' }],
  ),
  null,
);
assert.equal(
  scenarioIssue(
    { ...original, stages: 'Новая\nСвязались\nПокупка' },
    original,
    [],
    [{ id: 'elsewhere', pipeline: 'Другой сценарий', stage: 'Убрано' }],
  ),
  null,
);
assert.deepEqual(leadTransitions('Связались', ['Новая', 'Связались', 'Нет ответа', 'Покупка']), [
  'Покупка',
]);
assert.deepEqual(leadTransitions('Новая', parseStages(original.stages)), [
  'Связались',
  'Нет ответа',
]);
assert.deepEqual(
  leadTransitions('Связались', [
    'Новая',
    'Связались',
    'Подготовить предложение',
    'Пробное назначено',
    'Покупка',
  ]),
  ['Подготовить предложение'],
);
assert.deepEqual(leadTransitions('Обращение', ['Обращение', 'Контакт', 'Нет ответа', 'Покупка']), [
  'Контакт',
  'Нет ответа',
]);
for (const stage of [...parseStages(original.stages), 'Отказ'])
  assert.ok(stageMeaning(stage).length > 20);
assert.ok(stageAction('Связались').includes('связаться'));
assert.ok(stageMeaning('Свой статус').includes('Свой статус'));
console.log(
  'CRM checks passed: main and special statuses, readable actions, scenario validation, used-stage protection, unique names and forward transitions.',
);

const web = await load('../src/lib/web-analytics.ts');
const treeRules = await load('../src/lib/report-tree.ts');
const sample = web.createWebSample('2026-11-06');
const sampleSnapshot = JSON.stringify(sample);
const filters = {
  from: '2026-10-31',
  to: '2026-11-06',
  source: 'all',
  device: 'all',
  robots: false,
};
assert.deepEqual(sample, web.createWebSample('2026-11-06'), 'Demo observations are deterministic');
assert.equal(sample.from, '2026-09-08');
assert.equal(new Set(sample.visits.map((v) => v.id)).size, sample.visits.length);
for (const v of sample.visits)
  for (const o of v.offers) assert.ok(o.views >= o.cart && o.cart >= o.purchases);
const scoped = web.webScope(sample, filters);
assert.equal(scoped.covered, true);
assert.equal(scoped.partial, false);
assert.ok(scoped.visits.every((v) => !v.robot && v.day >= filters.from && v.day <= filters.to));
assert.ok(web.webScope(sample, { ...filters, robots: true }).visits.length > scoped.visits.length);
const mobileAds = web.webScope(sample, { ...filters, device: 'mobile', source: 'ads' });
assert.ok(
  mobileAds.visits.length > 0 &&
    mobileAds.visits.every((v) => v.device === 'mobile' && v.source === 'ads'),
);
assert.equal(
  web.webScope(sample, { ...filters, from: '2026-12-01', to: '2026-12-31' }).covered,
  false,
);
assert.equal(web.webScope(sample, { ...filters, to: '2026-12-31' }).partial, true);
assert.ok(web.webFilterError({ ...filters, from: '2026-02-30' }));
assert.ok(web.webFilterError({ ...filters, from: '', to: '' }));
assert.ok(web.webFilterError({ ...filters, from: '2026-11-07' }));
assert.deepEqual(web.webDays('2026-10-31', '2026-11-02'), [
  '2026-10-31',
  '2026-11-01',
  '2026-11-02',
]);
const sourceRows = web.webSourceRows(scoped.visits);
const sourceTotal = web.webVisitMetrics(scoped.visits);
assert.equal(
  sourceRows.reduce((n, s) => n + s.visits, 0),
  sourceTotal.visits,
);
assert.equal(sourceTotal.visitors, new Set(scoped.visits.map((v) => v.visitor)).size);
assert.ok(
  sourceRows.every((s) => s.visitors < s.visits),
  'Repeat demo visits must be deduplicated inside a source too',
);
assert.ok(
  sourceTotal.visitors < sourceRows.reduce((n, s) => n + s.visitors, 0),
  'Unique people cannot be summed across channels',
);
assert.equal(sourceTotal.conversion, (sourceTotal.buyers * 100) / sourceTotal.visits);
assert.equal(web.webVisitMetrics([]).conversion, null);
const days = web.webDays(filters.from, filters.to);
const trend = web.webSourceTrend(
  scoped.visits,
  days,
  web.webSources.map((s) => s.id),
  'visits',
);
assert.equal(
  trend.reduce((n, row) => n + row.values.reduce((a, b) => a + b, 0), 0),
  sourceTotal.visits,
);
const selectedSource = web.webSources.filter((s) => s.id === 'social');
assert.equal(selectedSource[0].tone, web.webSources.find((s) => s.id === 'social').tone);
const testVisit = {
  ...sample.visits[0],
  visitor: 'same-person',
  pages: [{ material: 'first', seconds: 10, read: true, scroll: true, next: false }],
  offers: [{ offer: 'iron', views: 1, cart: 1, purchases: 1 }],
};
const missingVisit = {
  ...testVisit,
  id: 'unknown',
  pages: [{ material: 'card', seconds: null, read: null, scroll: null, next: null }],
  offers: [{ offer: 'light', views: 2, cart: 0, purchases: 0 }],
};
const materialMetrics = web.webMaterialMetrics([testVisit, missingVisit], ['first', 'card']);
assert.equal(materialMetrics.visitors, 1);
assert.equal(materialMetrics.views, 2);
assert.equal(materialMetrics.seconds, 10, 'Unknown timing must not be treated as zero');
assert.deepEqual(materialMetrics.read, { value: 100, known: 1 });
assert.equal(web.webMaterialMetrics([missingVisit], ['card']).read.value, null);
assert.equal(web.webMaterialMetrics([], ['first']).seconds, null);
assert.equal(web.webMaterialRows(scoped.visits, 'ТРЕНИРОВКУ')[0].id, 'bag');
const offerTree = web.webOfferTree([testVisit, missingVisit]);
assert.equal(offerTree.total.visitors, 1);
assert.equal(offerTree.nodes.find((n) => n.name === 'Абонементы').values.visitors, 1);
const searched = web.webOfferTree(scoped.visits, 'железная КАРТА');
assert.deepEqual(searched.ids, ['iron']);
assert.equal(searched.nodes[0].name, 'Абонементы');
assert.equal(searched.nodes[0].children[0].name, 'Клубные карты');
assert.equal(web.webOfferTree(scoped.visits, 'не существует').nodes.length, 0);
const sortable = [
  {
    id: 'parent',
    name: 'Группа',
    values: { views: 2 },
    children: [
      { id: 'a', name: 'А', values: { views: 1 } },
      { id: 'b', name: 'Б', values: { views: 8 } },
      { id: 'c', name: 'В', values: { views: null } },
    ],
  },
];
const sorted = treeRules.sortReportTree(sortable, { key: 'views', asc: false });
assert.deepEqual(
  sorted[0].children.map((n) => n.id),
  ['b', 'a', 'c'],
);
assert.deepEqual(
  sortable[0].children.map((n) => n.id),
  ['a', 'b', 'c'],
);
assert.deepEqual(
  treeRules.sortReportTree(sortable, { key: 'views', asc: true })[0].children.map((n) => n.id),
  ['a', 'b', 'c'],
);
assert.deepEqual(treeRules.flattenReportTree(sorted).at(-1).path, ['Группа', 'В']);
assert.ok(
  web
    .webCsv(['Название'], [['Текст; с "кавычками"\nи переносом']])
    .includes('"Текст; с ""кавычками""\nи переносом"'),
);
assert.equal(
  JSON.stringify(sample),
  sampleSnapshot,
  'Report calculations do not mutate observations',
);
console.log(
  'Web analytics checks passed: coverage, robots/devices/sources, unique unions, daily counts, weighted known measurements, hierarchy/search/sibling sort, CSV and immutability.',
);
