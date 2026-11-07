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
const { matchesSearch, searchDirectories, directorySnippet } = await load(
  '../src/lib/directory-search.ts',
);
const { membershipKinds, getMembershipKind } = await load('../src/data/membership-kinds.ts');
const { createWorkspaceData } = await load('../src/data/workspace.ts');
const { validatePlan } = await load('../src/lib/workspace-rules.ts');
const { contrastRatio } = await load('../src/lib/theme.ts');
const entries = [
  {
    id: 'rooms',
    title: 'Залы',
    description: 'Вместимость и места',
    group: 'Клубы',
    records: [{ id: 'room-1', title: 'Тренажёрный зал', details: 'Вместимость: 20 · Центральный' }],
  },
  {
    id: 'training-templates',
    title: 'Шаблоны занятий',
    description: 'Формат и длительность',
    group: 'Занятия',
    records: [
      { id: 'yoga', title: 'Мягкая йога', details: 'Алина Белова · 55 минут' },
      { id: 'cycle', title: 'Сайкл', details: 'Максим Орлов · 45 минут' },
    ],
  },
];
const copy = structuredClone(entries);
assert.deepEqual(searchDirectories(entries, '   '), []);
assert.deepEqual(searchDirectories(entries, '???'), []);
assert.equal(searchDirectories(entries, '  ЙОГА  ')[0].records[0].id, 'yoga');
assert.equal(searchDirectories(entries, '55 йога')[0].records.length, 1);
assert.equal(searchDirectories(entries, 'занятия Белова')[0].records[0].id, 'yoga');
assert.equal(searchDirectories(entries, 'тренажерный центральный')[0].records[0].id, 'room-1');
assert.equal(searchDirectories(entries, 'вместим')[0].id, 'rooms');
assert.equal(
  searchDirectories(entries, 'йога Орлов').length,
  0,
  'Words must belong to the same result',
);
assert.equal(searchDirectories(entries, 'нет совпадений').length, 0);
assert.equal(matchesSearch('Групповые тренировки · 12 занятий', 'тренировки групп'), true);
assert.deepEqual(entries, copy, 'Search is read-only');
assert.equal(
  directorySnippet('Клуб: Центральный · Вместимость: 20 · Тренер: Алина', 'вместимость'),
  'Вместимость: 20',
);
assert.equal(directorySnippet('А · Б · В · Г', 'нет'), 'А · Б · В…');

const data = createWorkspaceData();
assert.equal(data.plans.length, 5);
assert.equal(new Set(data.plans.map((plan) => plan.kindId)).size, 5);
for (const kind of membershipKinds) {
  const plan = data.plans.find((plan) => plan.kindId === kind.id);
  assert.ok(plan, `Missing ${kind.id} example`);
  assert.equal(plan.color, kind.foreground);
  assert.equal(plan.type, kind.type);
  assert.equal(plan.visits, kind.visits);
  assert.equal(validatePlan(plan, true), null);
  assert.equal(getMembershipKind(plan.name)?.id, kind.id);
  for (const surface of ['#FFFFFF', '#FAF9F6', '#FDFCF9']) {
    assert.ok(
      contrastRatio(
        kind.foreground,
        kind.background === 'transparent' ? surface : kind.background,
      ) >= 4.5,
      `${kind.id} text must remain readable`,
    );
  }
}
assert.equal(getMembershipKind('Индивидуальный тариф', 'personal').id, 'personal');
assert.equal(getMembershipKind('Прокат полотенца'), undefined);
assert.equal(getMembershipKind('Тренажерный зал · 1 месяц').id, 'gym');
assert.equal(membershipKinds.find((kind) => kind.id === 'guest').background, 'transparent');
console.log(
  'Catalog checks passed: word search, record isolation, ё/е, five membership types, valid demo terms and readable category colours.',
);
