import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function load(path) {
  const code = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { searchMembers, clientCard } = await load('../src/lib/member-search.ts');
const { initialMembers } = await load('../src/data/mock.ts');
const { memberCards } = await load('../src/data/admin.ts');
const saved = JSON.stringify(initialMembers);
const find = (query) =>
  searchMembers(initialMembers, memberCards, query).map((member) => member.id);
for (const query of [
  '100001',
  '100 001',
  '100-001',
  'Смирнова',
  '  смИРНОВА анНа  ',
  'Анна Андреевна',
  'Андреевна Смир',
  '+7 (999) 123-45-67',
  '8 999 123 45 67',
  '123-45-67',
])
  assert.deepEqual(find(query), [1001], query);
assert.deepEqual(
  find('4567'),
  [1001, 1002, 1003, 1004],
  'Phone fragments can match several clients',
);
assert.deepEqual(
  find('999'),
  initialMembers.map((member) => member.id),
  'Ambiguous phone prefix stays ambiguous',
);
assert.deepEqual(
  find('10000'),
  initialMembers.map((member) => member.id),
  'Card prefix supports multiple results',
);
for (const query of ['', '   ', '---', 'Неизвестный', '9990000000'])
  assert.deepEqual(find(query), [], query);
const added = {
  ...initialMembers[0],
  id: 1072,
  name: 'Пётр Ёлкин',
  fullName: 'Ёлкин Пётр Ильич',
  phone: '+7 900 010-00-01',
};
assert.equal(clientCard(added, memberCards), '100072');
assert.deepEqual(
  searchMembers([added], memberCards, 'елкин пет').map((m) => m.id),
  [1072],
);
assert.deepEqual(
  searchMembers([added], memberCards, '100072').map((m) => m.id),
  [1072],
);
assert.deepEqual(
  searchMembers([added, ...initialMembers], memberCards, '100001').map((m) => m.id),
  [1001, 1072],
  'Exact card ranks before phone fragment',
);
assert.equal(JSON.stringify(initialMembers), saved, 'Searching never changes demo clients');
console.log(
  'Client search checks passed: exact/partial cards, full names in any order, case, ё/е, formatted phones, +7/8, ambiguity, empty results and unchanged demo data.',
);
