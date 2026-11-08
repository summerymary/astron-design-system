import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function moduleURL(path) {
  const url = path instanceof URL ? path : new URL(path, import.meta.url);
  const source = await readFile(url, 'utf8');
  let compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  for (const match of [...compiled.matchAll(/from ['"]([^'"]+)['"]/g)]) {
    const dependency = await moduleURL(new URL(match[1] + '.ts', url));
    compiled = compiled.replace(match[0], `from '${dependency}'`);
  }
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
}
async function load(path) {
  return import(await moduleURL(path));
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
  'Catalog checks passed: word search, record isolation, ё/е, valid demo terms and readable colour groups.',
);
const { saleCatalog, searchSaleCatalog, saleSections, planSaleSection } = await load(
  '../src/lib/sale-catalog.ts',
);
const original = structuredClone(data);
const catalog = saleCatalog(data);
assert.equal(saleSections.length, 5);
assert.equal(new Set(catalog.map((item) => item.record.id)).size, catalog.length);
assert.equal(catalog.filter((item) => item.sectionId === 'personal').length, 1);
assert.equal(catalog.filter((item) => item.sectionId === 'corporate').length, 1);
assert.equal(catalog.filter((item) => item.sectionId === 'exceptions').length, 2);
assert.equal(searchSaleCatalog(catalog, 'ЖЕЛЕЗНАЯ', null).length, 2);
assert.equal(searchSaleCatalog(catalog, 'железная', 'memberships').length, 1);
assert.equal(searchSaleCatalog(catalog, 'корпоративная', 'personal').length, 0);
assert.equal(
  searchSaleCatalog(catalog, 'волос резинки', 'goods-services')[0].record.id,
  'retail-bands',
);
assert.equal(searchSaleCatalog(catalog, 'полотенца', null)[0].type, 'service');
assert.equal(searchSaleCatalog(catalog, 'нет совпадений', null).length, 0);
assert.ok(!catalog.some((entry) => data.products.some((bar) => bar.id === entry.record.id)));
assert.equal(searchSaleCatalog(catalog, 'коктейль', null).length, 0);
assert.equal(
  saleCatalog({ ...data, plans: data.plans.map((row) => ({ ...row, status: 'Черновик' })) }).some(
    (item) => item.type === 'plan',
  ),
  false,
);
assert.equal(
  saleCatalog({
    ...data,
    'retail-products': data['retail-products'].map((row) => ({ ...row, status: 'В архиве' })),
  }).some((item) => item.type === 'product'),
  false,
);
for (const plan of data.plans) assert.equal(validatePlan(plan, true), null);
const customPlan = {
  ...data.plans[0],
  id: 'custom-unlimited-type',
  name: 'Плавание · квартал',
  kind: 'Бассейн и аквааэробика',
  saleSection: 'corporate',
  corporate: 'Нет',
  kindId: 'group',
};
assert.equal(
  validatePlan(customPlan, true),
  null,
  'Arbitrary tariff names and purposes are supported',
);
assert.equal(planSaleSection(customPlan), 'corporate');
assert.equal(
  planSaleSection({ ...customPlan, kindId: 'personal' }),
  'corporate',
  'Colour does not change catalog section',
);
assert.equal(
  planSaleSection({ ...customPlan, saleSection: 'memberships', corporate: 'Да' }),
  'memberships',
);
assert.equal(planSaleSection({ ...customPlan, saleSection: 'exceptions' }), 'exceptions');
assert.equal(
  saleCatalog({ ...data, plans: [...data.plans, customPlan] }).filter(
    (entry) => entry.sectionId === 'corporate',
  ).length,
  2,
);
assert.deepEqual(data, original, 'Catalog browsing and search must not change source records');
console.log(
  'Sale catalog checks passed: section isolation, name search, published/active records and bar exclusion.',
);
