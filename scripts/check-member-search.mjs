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

// Creation detects identity or a complete phone, never a name alone.
{
  const { findMemberDuplicates, normalizedMemberPhone, memberContactError, memberUpdateDraft } =
    await load('../src/lib/member-duplicates.ts');
  const draft = { fullName: 'Смирнова Анна', birthDate: '1998-04-12', phone: '+7 999 900-00-00' };
  const duplicates = (value) => findMemberDuplicates(initialMembers, { ...draft, ...value });
  assert.equal(duplicates({}).length, 1);
  assert.equal(duplicates({})[0].member.id, 1001);
  assert.ok(duplicates({})[0].sameIdentity);
  assert.equal(duplicates({})[0].samePhone, false);
  for (const fullName of [
    '  СМИРНОВА   АННА  Андреевна ',
    'Анна Смирнова',
    'Смирнова Анна Другоеотчество',
  ])
    assert.equal(duplicates({ fullName })[0].member.id, 1001);
  assert.equal(duplicates({ birthDate: '' }).length, 0, 'Name alone stays silent');
  assert.equal(
    duplicates({ birthDate: '1999-04-12' }).length,
    0,
    'Different birthday stays silent',
  );
  assert.equal(duplicates({ fullName: 'Другая Анна' }).length, 0, 'Birthday alone stays silent');
  assert.equal(duplicates({ fullName: 'Смирнова' }).length, 0, 'Incomplete name stays silent');
  for (const phone of ['+7 (999) 123-45-67', '8 999 123 45 67', '9991234567']) {
    const found = duplicates({ phone, fullName: 'Другой Клиент', birthDate: '' });
    assert.equal(found[0].member.id, 1001);
    assert.ok(found[0].samePhone);
    assert.equal(found[0].sameIdentity, false);
  }
  assert.equal(
    duplicates({ phone: '1234567', fullName: 'Другой Клиент', birthDate: '' }).length,
    0,
    'Partial numbers do not trigger a match',
  );
  assert.equal(duplicates({ birthDate: '1998-02-30' }).length, 0);
  assert.equal(normalizedMemberPhone(''), '');
  assert.equal(
    memberContactError({ ...draft, phone: 'abc' }),
    'Укажите телефон: от 10 до 15 цифр.',
  );
  assert.equal(memberContactError(draft), null);
  const update = memberUpdateDraft(initialMembers[0], { ...draft, email: '', plan: 'Other' });
  assert.equal(
    update.fullName,
    initialMembers[0].fullName,
    'Short matching name must not erase a known patronymic',
  );
  assert.equal(update.email, initialMembers[0].email, 'Empty draft must not erase existing email');
  assert.equal(update.phone, draft.phone, 'New number can replace the old number after review');
  assert.equal(update.plan, undefined, 'Contact updates cannot change a membership');
  assert.equal(
    memberUpdateDraft(initialMembers[0], { ...draft, fullName: 'New Person', email: '', plan: '' })
      .fullName,
    'New Person',
  );
  const twin = {
    ...initialMembers[0],
    id: 2001,
    fullName: 'СМИРНОВА АННА Другая',
    name: 'Анна Смирнова',
    archived: true,
  };
  assert.equal(
    findMemberDuplicates([...initialMembers, twin], draft).length,
    2,
    'All matches, including archived ones, are shown',
  );
  const yo = { ...initialMembers[0], fullName: 'Фёдорова Анна Ивановна', name: 'Анна Фёдорова' };
  assert.equal(findMemberDuplicates([yo], { ...draft, fullName: 'Федорова Анна' }).length, 1);
  const hyphen = {
    ...initialMembers[0],
    fullName: 'Иванова-Петрова Анна Ивановна',
    name: 'Анна Иванова-Петрова',
  };
  assert.equal(
    findMemberDuplicates([hyphen], { ...draft, fullName: 'Иванова-Петрова Анна' }).length,
    1,
  );
  assert.equal(JSON.stringify(initialMembers), saved, 'Duplicate checking does not change records');
  console.log(
    'Client duplicate checks passed: name+DOB, changed phone, normalized full phone, silent name-only, archived/multiple matches and immutable input.',
  );
}
