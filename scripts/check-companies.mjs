import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const cache = new Map();
async function load(url) {
  if (cache.has(String(url))) return cache.get(String(url));
  let code = ts.transpileModule(await readFile(url, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  for (const match of [...code.matchAll(/from ['"]([^'"]+)['"]/g)])
    code = code.replace(match[0], `from '${await load(new URL(match[1] + '.ts', url))}'`);
  const result = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  cache.set(String(url), result);
  return result;
}
const { topUpCompany, companyBalance, companyTopUpCents } = await import(
  await load(new URL('../src/lib/company-accounts.ts', import.meta.url))
);
const { cashJournal, cashBalance, filterCashJournal, cashTotals } = await import(
  await load(new URL('../src/lib/cash.ts', import.meta.url))
);
const { createWorkspaceData } = await import(
  await load(new URL('../src/data/workspace.ts', import.meta.url))
);
const { demoUsers } = await import(await load(new URL('../src/data/roles.ts', import.meta.url)));
const { canOpenModule } = await import(
  await load(new URL('../src/lib/staff-rules.ts', import.meta.url))
);
const admin = demoUsers.find((user) => user.role === 'administrator');
const data = createWorkspaceData();
const original = structuredClone(data);
const request = {
  id: 'test-company-1',
  companyId: 'company-mayak',
  clubId: 'central',
  amount: '0,29',
  method: 'Наличные',
  stamp: '2026-11-06T14:35',
  received: true,
  receipt: true,
  comment: '  ДЕМО-01  ',
};
const next = topUpCompany(data, request, admin);
assert.deepEqual(data, original, 'No mutation of input');
assert.equal(companyBalance(next, request.companyId), companyBalance(data, request.companyId) + 29);
assert.equal(companyBalance(next, 'company-vector'), 0, 'Other companies unchanged');
assert.deepEqual(next.ledger, data.ledger, 'A deposit is not a sale or client payment');
assert.deepEqual(next['personal-accounts'], data['personal-accounts']);
assert.equal(next['company-account-operations'].length, 1);
assert.equal(next['company-account-operations'][0].comment, 'ДЕМО-01');
assert.equal(next.receipts.at(-1).operationId, request.id);
assert.equal(next.logs.at(-1).operationId, request.id);
assert.equal(next.logs.at(-1).user, admin.name);
assert.equal(next.logs.at(-1).status, 'Успешно');
assert.throws(() => topUpCompany(next, request, admin), /уже проведено/);
const journal = cashJournal(next.ledger, next['cash-events']);
assert.equal(
  cashBalance(journal, 'Центральный', '2026-11-06') -
    cashBalance(cashJournal(data.ledger, data['cash-events']), 'Центральный', '2026-11-06'),
  29,
);
const companyCash = filterCashJournal(journal, '2026-11-06', 'Центральный', 'company-topup');
assert.equal(companyCash.length, 1);
assert.equal(companyCash[0].kind, 'company-topup');
assert.equal(companyCash[0].companyId, request.companyId);
assert.equal(companyCash[0].memberId, '');
assert.equal(cashTotals(companyCash).income, 29);
assert.ok(
  filterCashJournal(journal, '2026-11-06', 'Центральный', 'cash').some(
    (row) => row.id === request.id,
  ),
);
assert.ok(
  !filterCashJournal(journal, '2026-11-06', 'Центральный', 'deposit').some(
    (row) => row.id === request.id,
  ),
);
const cardRequest = {
  ...request,
  id: 'test-company-2',
  amount: '100.01',
  method: 'Безналичная оплата',
  receipt: false,
};
const card = topUpCompany(next, cardRequest, admin);
const cardJournal = cashJournal(card.ledger, card['cash-events']);
assert.equal(
  companyBalance(card, request.companyId),
  companyBalance(data, request.companyId) + 10030,
);
assert.equal(
  cashBalance(cardJournal, 'Центральный', '2026-11-06'),
  cashBalance(journal, 'Центральный', '2026-11-06'),
  'Card does not change drawer',
);
assert.equal(card.receipts.length, next.receipts.length);
assert.ok(
  filterCashJournal(cardJournal, '2026-11-06', 'Центральный', 'card').some(
    (row) => row.id === cardRequest.id,
  ),
);
for (const change of [
  { amount: '' },
  { amount: '0' },
  { amount: '-1' },
  { amount: 'NaN' },
  { amount: '1.001' },
  { amount: 'Infinity' },
  { amount: '1e3' },
  { amount: '9007199254740991' },
  { companyId: 'company-archive' },
  { companyId: 'missing' },
  { clubId: 'park' },
  { clubId: 'missing' },
  { method: 'Корпоративная' },
  { method: 'Составная оплата' },
  { received: false },
  { stamp: '' },
])
  assert.throws(() => topUpCompany(data, { ...request, ...change }, admin), JSON.stringify(change));
for (const role of [
  'trainer',
  'bartender',
  'marketer',
  'accountant',
  'network-director',
  'fitness-director',
  'sysadmin',
  'operations-director',
])
  assert.throws(() => topUpCompany(data, request, { ...admin, role }), role);
for (const role of [
  'administrator',
  'club-director',
  'network-director',
  'operations-director',
  'accountant',
])
  assert.equal(canOpenModule(role, 'companies'), true);
for (const role of ['trainer', 'bartender', 'marketer', 'fitness-director', 'sysadmin'])
  assert.equal(canOpenModule(role, 'companies'), false);
assert.doesNotThrow(() => topUpCompany(data, request, { ...admin, role: 'club-director' }));
assert.throws(
  () =>
    topUpCompany(
      { ...data, 'cash-shifts': [{ id: 'shift', club: 'Центральный', status: 'Закрыта' }] },
      request,
      admin,
    ),
  /смена закрыта/,
);
assert.throws(
  () =>
    topUpCompany(
      { ...data, 'cash-terminals': [{ id: 'terminal', club: 'Центральный', status: 'Закрыта' }] },
      cardRequest,
      admin,
    ),
  /терминала закрыта/,
);
assert.equal(companyTopUpCents('0.01'), 1);
assert.deepEqual(data, original, 'Rejected operations leave all data intact');
console.log(
  'Company checks passed: scope/roles, cents, duplicate protection, atomic cash/account/receipt/audit, card drawer isolation, archived accounts and closed shifts.',
);
