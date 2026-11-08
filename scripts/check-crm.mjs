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
