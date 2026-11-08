import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const code = ts.transpileModule(
  await readFile(new URL('../src/lib/checkout.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } },
).outputText;
const { saleTotal, paymentPlan } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
const empty = { cash: 0, card: 0, gift: 0, credit: 0 };
assert.deepEqual(saleTotal(250, 3, 10), { base: 750, discount: 75, total: 675 });
assert.deepEqual(saleTotal(0.1, 3, 0), { base: 0.3, discount: 0, total: 0.3 });
assert.deepEqual(saleTotal(99.99, 3, 15), { base: 299.97, discount: 45, total: 254.97 });
for (const args of [
  [250, 0, 0],
  [250, 1.5, 0],
  [250, 1000, 0],
  [-1, 1, 0],
  [NaN, 1, 0],
  [1, 1, -1],
  [1, 1, 101],
])
  assert.throws(() => saleTotal(...args));
assert.deepEqual(paymentPlan(675, 'Наличные', empty), { ...empty, cash: 675 });
assert.deepEqual(paymentPlan(675, 'Безналичная оплата', empty), { ...empty, card: 675 });
assert.deepEqual(paymentPlan(675, 'В кредит', empty), { ...empty, credit: 675 });
assert.deepEqual(paymentPlan(675, 'Подарочная карта', empty, 675), { ...empty, gift: 675 });
assert.throws(() => paymentPlan(675, 'Подарочная карта', empty));
assert.throws(() => paymentPlan(675, 'Подарочная карта', empty, 674.99));
const split = { cash: 100, card: 200, gift: 75, credit: 300 };
assert.deepEqual(paymentPlan(675, 'Составная оплата', split, 75), split);
assert.deepEqual(split, { cash: 100, card: 200, gift: 75, credit: 300 });
assert.throws(() => paymentPlan(675, 'Составная оплата', { ...split, cash: 99.99 }, 75));
assert.throws(() => paymentPlan(675, 'Составная оплата', { ...split, gift: 74.999 }, 75));
assert.throws(() => paymentPlan(675, 'Составная оплата', { ...split, cash: -1 }, 75));
assert.throws(() => paymentPlan(675, 'Составная оплата', { ...split, card: NaN }, 75));
assert.throws(() => paymentPlan(675, 'Составная оплата', split, 74));
assert.deepEqual(paymentPlan(0.3, 'Составная оплата', { ...empty, cash: 0.1, card: 0.2 }), {
  ...empty,
  cash: 0.1,
  card: 0.2,
});
console.log(
  'Checkout checks passed: discounts and cent rounding, quantities, five methods, split totals, debt and gift balance.',
);
