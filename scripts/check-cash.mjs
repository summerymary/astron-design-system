import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const code = ts.transpileModule(
  await readFile(new URL('../src/lib/cash.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  },
).outputText;
const {
  cashJournal,
  cashFlow,
  cashTotals,
  cashBalance,
  filterCashJournal,
  validateCashMovement,
  cashCents,
} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const base = {
  id: 'example',
  name: 'Пример',
  date: '2026-11-06',
  club: 'Центральный',
  method: 'Наличные',
  amount: '100',
};
const ledger = [
  { ...base, id: 'cash', amount: '0.1' },
  { ...base, id: 'card', method: 'Карта', amount: '200' },
  { ...base, id: 'bar', category: 'Бар', amount: '99999' },
  {
    ...base,
    id: 'split',
    method: 'Составная оплата',
    amount: '300.2',
    cashAmount: '0.2',
    cardAmount: '100',
    giftAmount: '200',
    creditAmount: '50',
  },
  { ...base, id: 'gift', method: 'Подарочная карта', amount: '1000' },
  { ...base, id: 'credit', method: 'В кредит', amount: '0', total: '2000' },
  { ...base, id: 'web', method: 'Сайт', amount: '300' },
];
const movements = [
  { ...base, id: 'deposit', kind: 'deposit', amount: '500' },
  { ...base, id: 'withdrawal', kind: 'withdrawal', amount: '100' },
  { ...base, id: 'refund', kind: 'refund', amount: '50' },
  { ...base, id: 'card-refund', kind: 'refund', method: 'Карта', amount: '20' },
  { ...base, id: 'future', date: '2026-11-07', amount: '100' },
  { ...base, id: 'other-club', club: 'Парк', amount: '100' },
];
const journal = cashJournal(ledger, movements);
assert.equal(
  journal.some((row) => row.id === 'bar'),
  false,
);
const rows = filterCashJournal(journal, '2026-11-06', 'Центральный', 'all');
assert.equal(rows.length, 10);
assert.deepEqual(cashTotals(rows), {
  income: 110030,
  expense: 17000,
  website: 30000,
  gift: 120000,
  credit: 205000,
});
assert.deepEqual(cashFlow(journal.find((row) => row.id === 'credit')), { income: 0, expense: 0 });
assert.deepEqual(cashFlow(journal.find((row) => row.id === 'gift')), { income: 0, expense: 0 });
assert.equal(cashBalance(journal, 'Центральный', '2026-11-06', 100000), 135030);
assert.equal(cashBalance(journal, 'Парк', '2026-11-06', 100000), 110000);
assert.equal(cashBalance(journal, 'Центральный', '2026-11-05', 100000), 100000);
for (const [filter, expected] of Object.entries({
  cash: ['cash', 'split'],
  card: ['card', 'split'],
  refund: ['refund'],
  withdrawal: ['withdrawal'],
  deposit: ['deposit'],
  website: ['web'],
  'card-refund': ['card-refund'],
  credit: ['credit', 'split'],
  gift: ['gift', 'split'],
  split: ['split'],
})) {
  assert.deepEqual(
    filterCashJournal(journal, '2026-11-06', 'Центральный', filter)
      .map((row) => row.id)
      .sort(),
    expected.sort(),
  );
}
assert.equal(filterCashJournal(journal, '2026-11-06', 'all', 'all').length, rows.length + 1);
assert.equal(validateCashMovement('0.3', 'Размен', 'deposit', 0), 30);
assert.equal(validateCashMovement('100', 'Инкассация', 'withdrawal', 10000), 10000);
for (const [amount, reason, kind, balance] of [
  ['', 'Размен', 'deposit', 0],
  ['0', 'Размен', 'deposit', 0],
  ['-1', 'Размен', 'deposit', 0],
  ['NaN', 'Размен', 'deposit', 0],
  ['Infinity', 'Размен', 'deposit', 0],
  ['0.001', 'Размен', 'deposit', 0],
  ['1.001', 'Размен', 'deposit', 0],
  ['100', '  ', 'deposit', 0],
  ['100.01', 'Инкассация', 'withdrawal', 10000],
])
  assert.throws(() => validateCashMovement(amount, reason, kind, balance));
assert.equal(cashCents('0.29'), 29);
assert.throws(() => cashCents(-1));
assert.throws(() => cashCents(1e20));
console.log(
  'Cash checks passed: bar isolation, cash/card/site/gift/debt/split, refunds, filters, date/club balances, cent arithmetic and withdrawal validation.',
);
