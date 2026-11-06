import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const { inventoryStock, leadTransitions, leadTask, validatePlan } = await load(
  '../src/lib/workspace-rules.ts',
);
const { createWorkspaceData } = await load('../src/data/workspace.ts');
const data = createWorkspaceData();
const stages = data.pipelines[0].stages.split('\n');
assert.deepEqual(leadTransitions('Связались', stages), ['Пробное назначено']);
assert.deepEqual(leadTransitions('Нет ответа', stages), ['Связались']);
assert.deepEqual(leadTransitions('Пробное пройдено', stages), ['Покупка']);
assert.deepEqual(leadTransitions('Покупка', stages), []);
assert.deepEqual(leadTransitions('Неизвестный этап', stages), []);
assert.deepEqual(leadTransitions('Первый', ['Первый', 'Второй']), ['Второй']);
assert.equal(leadTask('Покупка', 'Позвонить'), '');
assert.equal(leadTask('Связались', 'Позвонить'), 'Подобрать пробное занятие');

const document = structuredClone(data.inventory[0]);
const product = structuredClone(data.products[0]);
assert.equal(inventoryStock(document, product), 72);
assert.equal(product.stock, '48', 'Preview must not mutate stock');
assert.equal(document.status, 'Черновик', 'Preview must not post the document');
assert.equal(inventoryStock({ ...document, type: 'Списание', qty: '48' }, product), 0);
assert.throws(() => inventoryStock({ ...document, type: 'Списание', qty: '49' }, product));
assert.throws(() => inventoryStock({ ...document, qty: '-1' }, product));
assert.throws(() => inventoryStock({ ...document, qty: 'NaN' }, product));
assert.throws(() => inventoryStock({ ...document, status: 'Проведён' }, product));
assert.throws(() =>
  inventoryStock({ ...document, type: 'Перемещение', from: 'Бар', to: 'Бар' }, product),
);
assert.equal(
  inventoryStock({ ...document, type: 'Перемещение', from: 'Склад', to: 'Бар' }, product),
  48,
);

const plan = data.plans[0];
assert.equal(validatePlan(plan, true), null);
assert.equal(validatePlan({ ...plan, price: '0' }, true), null, 'Free plans are valid');
assert.equal(
  validatePlan({ ...plan, price: '', duration: '' }, false),
  null,
  'An incomplete draft can be saved',
);
assert.equal(validatePlan({ ...plan, name: ' ' }, false)?.step, 'Основное');
assert.equal(validatePlan({ ...plan, price: '-1' }, true)?.step, 'Продажа');
assert.equal(validatePlan({ ...plan, discount: '101' }, false)?.step, 'Продажа');
assert.equal(validatePlan({ ...plan, duration: '0' }, true)?.step, 'Срок и визиты');
assert.equal(
  validatePlan({ ...plan, type: 'По посещениям', visits: '0' }, true)?.step,
  'Срок и визиты',
);
for (const rows of Object.values(data))
  assert.equal(
    new Set(rows.map((row) => row.id)).size,
    rows.length,
    'Collection IDs must be unique',
  );
const second = createWorkspaceData();
second.products[0].stock = '0';
assert.equal(
  createWorkspaceData().products[0].stock,
  '48',
  'Reset must create independent demo data',
);
console.log(
  'Workspace checks passed: CRM transitions, plan draft/publication validation, inventory non-negative stock and repeat-post protection, independent demo reset.',
);
