import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const cache = new Map();
async function load(url) {
  const key = String(url);
  if (cache.has(key)) return cache.get(key);
  let code = ts.transpileModule(await readFile(url, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  for (const match of [...code.matchAll(/from ['"]([^'"]+)['"]/g)])
    code = code.replace(match[0], `from '${await load(new URL(match[1] + '.ts', url))}'`);
  const result = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  cache.set(key, result);
  return result;
}
const { retailSale, issueGift, redeemGift, paidOperation, cardNumberError } = await import(
  await load(new URL('../src/lib/reception-operations.ts', import.meta.url))
);
const { changeMembership } = await import(
  await load(new URL('../src/lib/membership-operations.ts', import.meta.url))
);
const { getClientProfile } = await import(
  await load(new URL('../src/data/clientProfile.ts', import.meta.url))
);
const { createWorkspaceData } = await import(
  await load(new URL('../src/data/workspace.ts', import.meta.url))
);
const { searchMembers } = await import(
  await load(new URL('../src/lib/member-search.ts', import.meta.url))
);
const data = createWorkspaceData();
const { membershipVisits, cancelMembershipVisit } = await import(
  await load(new URL('../src/lib/membership-visit-history.ts', import.meta.url))
);
const historyMember = {
  id: 90001,
  name: 'Тест',
  email: '',
  phone: '',
  plan: 'Групповые тренировки',
  status: 'active',
  joined: '01.11.2026',
  expires: '01.12.2026',
  visits: 2,
};
const historyVisit = {
  id: 'test-visit',
  memberId: 90001,
  passId: 'S-90001-01',
  enteredAt: '2026-11-05T12:00',
  kind: 'group',
  plan: historyMember.plan,
  clubId: 'central',
};
const historyData = {
  events: [{ id: 'class', present: '90001,90002' }],
  'visit-bookings': [
    {
      id: 'receipt',
      memberId: '90001',
      passId: historyVisit.passId,
      eventId: 'class',
      date: historyVisit.enteredAt,
    },
  ],
};
const cancellation = {
  member: historyMember,
  passId: historyVisit.passId,
  visit: historyVisit,
  visits: [historyVisit],
  reason: 'Ошибочная отметка',
  stamp: '2026-11-06T14:00',
  canOperate: true,
};
const cancelled = cancelMembershipVisit(historyData, cancellation);
assert.equal(getClientProfile(historyMember, cancelled).subscriptions[0].used, 1);
assert.equal(getClientProfile(historyMember, cancelled).subscriptions[0].remaining, 11);
assert.equal(cancelled.events[0].present, '90002', 'Cancel only this attendance');
assert.equal(cancelled['visit-bookings'].length, 0);
assert.equal(cancelled['membership-history'][0].comment, cancellation.reason);
assert.equal(historyData.events[0].present, '90001,90002', 'Cancellation is immutable');
assert.throws(() => cancelMembershipVisit(cancelled, cancellation), /уже отменено/);
assert.throws(
  () => cancelMembershipVisit(historyData, { ...cancellation, canOperate: false }),
  /недоступна/,
);
assert.throws(() => cancelMembershipVisit(historyData, { ...cancellation, reason: '' }), /причину/);
assert.equal(
  membershipVisits(
    historyMember,
    historyVisit.passId,
    [{ ...historyVisit, memberId: 90002 }],
    historyData,
  ).length,
  0,
);
const ambiguousHistory = {
  ...historyData,
  'issued-plans': [
    {
      id: 'same-name',
      memberId: '90001',
      name: historyMember.plan,
      visits: '12',
      issued: '2026-11-03',
    },
  ],
};
assert.equal(
  membershipVisits(
    historyMember,
    historyVisit.passId,
    [{ ...historyVisit, passId: undefined }],
    ambiguousHistory,
  ).length,
  0,
  'Legacy same-name purchases cannot steal each other’s visits',
);
const before = structuredClone(data);
const payment = {
  method: 'Безналичная оплата',
  parts: { cash: 0, card: 0, gift: 0, credit: 0 },
  receipt: true,
};
const sale = {
  id: 'reception-test',
  date: '2026-11-06',
  time: '14:38',
  club: 'Центральный',
  cashier: 'Демо',
};
const bought = retailSale(data, { 'retail-socks': 2, 'retail-slippers': 1 }, sale, payment);
assert.equal(bought.ledger.at(-1).amount, '850');
assert.equal(bought.ledger.at(-1).memberId, '');
assert.equal(bought['retail-products'].find((row) => row.id === 'retail-socks').stock, '22');
assert.equal(bought.receipts.at(-1).saleId, sale.id);
assert.deepEqual(data, before, 'Failed checkout or preview must not mutate input');
assert.throws(() => retailSale(data, { 'retail-socks': 999 }, sale, payment));
assert.throws(() => retailSale(data, { 'retail-socks': 1.5 }, sale, payment));
assert.throws(() => retailSale(data, { 'retail-socks': -1 }, sale, payment));
assert.throws(() => retailSale(data, { 'product-1': 1 }, sale, payment), /ресепшене/);
assert.throws(() => retailSale(bought, { 'retail-socks': 1 }, sale, payment), /уже проведена/);
const gift = {
  ...sale,
  id: 'gift-test',
  name: 'TEST-01',
  nominal: '12.29',
  comment: 'Пример',
  ownerId: '1001',
};
const issued = issueGift(data, gift, payment);
assert.equal(issued['gift-cards'].at(-1).balance, '12.29');
assert.equal(issued.ledger.at(-1).kind, 'gift-issue');
assert.throws(() => issueGift(issued, { ...gift, id: 'other', name: 'test-01' }, payment));
const used = redeemGift(issued, gift.id, 2.29, {
  id: 'debit-test',
  name: 'Списание',
  date: sale.date,
});
assert.equal(used['gift-cards'].at(-1).balance, '10');
assert.equal(used['gift-history'].at(-1).amount, '-2.29');
assert.equal(used.ledger.length, issued.ledger.length, 'Gift redemption is not new cash income');
assert.throws(() => redeemGift(used, gift.id, 11, { id: 'too-much' }));
assert.throws(() => redeemGift(used, gift.id, 1.001, { id: 'fractional-cent' }));
assert.throws(() => redeemGift(used, gift.id, 1, { id: 'debit-test' }));
assert.equal(
  redeemGift(used, gift.id, 10, { id: 'last' })['gift-cards'].at(-1).status,
  'Использована',
);
assert.throws(
  () => issueGift(data, { ...gift, ownerId: '' }, undefined, 'club-director'),
  /владельца/,
);
assert.equal(issueGift(data, gift, undefined, 'club-director').ledger.length, data.ledger.length);
for (const role of [
  'administrator',
  'trainer',
  'bartender',
  'marketer',
  'accountant',
  'system-administrator',
]) {
  assert.throws(() => issueGift(data, gift, undefined, role), /только директорам/);
}
assert.throws(() => issueGift(data, gift), /только директорам/);
const order = data['gift-orders'][0];
const online = issueGift(data, {
  ...gift,
  id: 'online-test',
  orderId: order.id,
  nominal: order.amount,
  ownerId: '',
});
assert.equal(online.ledger.length, data.ledger.length, 'Paid online order cannot charge again');
assert.throws(() =>
  issueGift(online, { ...gift, id: 'reissue', orderId: order.id, nominal: order.amount }),
);
const member = {
  id: 1001,
  phone: '+7 900 123-45-67',
  name: 'Анна Смирнова',
  fullName: 'Смирнова Анна Андреевна',
  visits: 24,
  plan: 'Железная карта',
  status: 'active',
  joined: '12.09.2026',
  expires: '12.12.2026',
};
const other = { ...member, id: 1002 };
assert.equal(
  cardNumberError('100002', member, [member, other], { 1001: '100001', 1002: '100002' }),
  'Этот номер карты уже используется другим клиентом.',
);
assert.equal(cardNumberError('200001', member, [member, other], { 1001: '100001' }), null);
const changed = { ...member, cardNumber: '200001' };
assert.equal(searchMembers([changed], { 1001: '100001' }, '200001').length, 1);
assert.equal(searchMembers([changed], { 1001: '100001' }, '100001').length, 0);
const restored = paidOperation(data, { ...sale, name: 'Восстановление карты' }, 100, payment);
assert.equal(restored.ledger.at(-1).amount, '100');
const pass = getClientProfile(member, data).subscriptions.find((row) => row.kindId === 'personal');
const input = {
  member,
  passId: pass.id,
  kind: 'freeze',
  until: '2026-11-13',
  reason: 'По заявлению',
  today: '2026-11-06',
  stamp: '2026-11-06T14:38',
  actionId: 'freeze-1',
  canOperate: true,
};
const frozen = changeMembership(data, input);
assert.equal(
  getClientProfile(member, frozen).subscriptions.find((row) => row.id === pass.id).status,
  'paused',
);
const thawed = changeMembership(frozen, {
  ...input,
  kind: 'unfreeze',
  actionId: 'thaw-1',
  today: '2026-11-08',
});
assert.equal(
  getClientProfile(member, thawed).subscriptions.find((row) => row.id === pass.id).remaining,
  pass.remaining,
);
const transferred = changeMembership(data, {
  ...input,
  kind: 'transfer',
  actionId: 'transfer-1',
  target: other,
});
assert.equal(
  getClientProfile(member, transferred).subscriptions.find((row) => row.id === pass.id).remaining,
  0,
);
const received = getClientProfile(other, transferred).subscriptions.find(
  (row) => row.id === 'transferred:transfer-1',
);
assert.equal(received.remaining, pass.remaining);
assert.equal(received.endsAt, pass.endsAt);
assert.throws(() =>
  changeMembership(transferred, {
    ...input,
    kind: 'transfer',
    actionId: 'transfer-2',
    target: other,
  }),
);
assert.throws(() => changeMembership(data, { ...input, canOperate: false }));
console.log(
  'Reception checks passed: atomic retail stock/payment, gift issue/debit/online idempotency, card replacement/search, membership lifecycle.',
);

const frozenTransfer = changeMembership(frozen, {
  ...input,
  kind: 'transfer',
  actionId: 'frozen-transfer',
  target: other,
});
assert.equal(
  getClientProfile(other, frozenTransfer).subscriptions.find(
    (row) => row.id === 'transferred:frozen-transfer',
  ).status,
  'paused',
);

// Extended payment methods share the same atomic stock/payment operation.
const paymentData = {
  ...createWorkspaceData(),
  'gift-cards': [
    { id: 'gift-payment-test', name: 'DEMO-TEST', balance: '1000', status: 'Активна' },
  ],
  'gift-history': [],
};
const productForPayment = paymentData['retail-products'].find((row) => row.status === 'Активен');
const saleForPayment = {
  id: 'extended-gift-sale',
  date: '2026-11-06',
  time: '15:00',
  club: 'Центральный',
  cashier: 'Тестовый сотрудник',
};
const productTotal = Number(productForPayment.price);
const extendedGift = { ...payment, method: 'Подарочная карта', giftId: 'gift-payment-test' };
const giftSale = retailSale(
  paymentData,
  { [productForPayment.id]: 1 },
  saleForPayment,
  extendedGift,
);
assert.equal(Number(giftSale['gift-cards'][0].balance), 1000 - productTotal);
assert.equal(giftSale['gift-history'].length, 1);
assert.equal(Number(giftSale.ledger.at(-1).giftAmount), productTotal);
assert.equal(giftSale.ledger.at(-1).cashAmount, '0');
assert.equal(giftSale.ledger.at(-1).cardAmount, '0');
assert.throws(() =>
  retailSale(giftSale, { [productForPayment.id]: 1 }, saleForPayment, extendedGift),
);
assert.throws(() =>
  retailSale(paymentData, { [productForPayment.id]: 1 }, saleForPayment, {
    ...extendedGift,
    giftId: 'missing',
  }),
);
assert.throws(
  () =>
    retailSale(paymentData, { [productForPayment.id]: 1 }, saleForPayment, {
      ...payment,
      method: 'В кредит',
    }),
  /клиента/,
);
const creditSale = retailSale(
  paymentData,
  { [productForPayment.id]: 1 },
  { ...saleForPayment, id: 'credit-retail' },
  { ...payment, method: 'В кредит', memberId: '1001', client: 'Демо-клиент' },
);
assert.equal(creditSale.ledger.at(-1).memberId, '1001');
assert.equal(creditSale.ledger.at(-1).amount, '0');
assert.equal(Number(creditSale.receivables.at(-1).amount), productTotal);
assert.equal(creditSale.receivables.at(-1).memberId, '1001');
assert.equal(creditSale.ledger.at(-1).status, 'В долг');
const mixedSale = retailSale(
  paymentData,
  { [productForPayment.id]: 1 },
  { ...saleForPayment, id: 'mixed-retail' },
  {
    ...extendedGift,
    method: 'Составная оплата',
    parts: { cash: 0.29, card: 0, gift: productTotal - 1, credit: 0.71 },
    memberId: '1001',
    client: 'Демо-клиент',
  },
);
assert.equal(mixedSale.receivables.at(-1).amount, '0.71');
assert.equal(mixedSale.ledger.at(-1).cashAmount, '0.29');
assert.equal(
  Math.round(Number(mixedSale['gift-cards'][0].balance) * 100),
  Math.round((1001 - productTotal) * 100),
);
const { barSale } = await import(
  await load(new URL('../src/lib/reception-operations.ts', import.meta.url))
);
const barProduct = paymentData.products.find((row) => row.status === 'Активен');
const barPayment = barSale(
  paymentData,
  { [barProduct.id]: 1 },
  { ...saleForPayment, id: 'credit-bar' },
  { ...payment, method: 'В кредит', memberId: '1001', client: 'Демо-клиент' },
);
assert.equal(barPayment.ledger.at(-1).category, 'Бар');
assert.equal(barPayment.receivables.at(-1).memberId, '1001');
assert.equal(
  Number(barPayment.products.find((row) => row.id === barProduct.id).stock),
  Number(barProduct.stock) - 1,
);
assert.equal(paymentData['gift-cards'][0].balance, '1000', 'Payment input remains immutable');
console.log(
  'Extended payments passed: gift debit, named credit, mixed kopecks, no cash inflow for gift/debt, replay protection, and atomic bar stock.',
);

const creditGift = issueGift(
  paymentData,
  {
    id: 'gift-on-credit',
    name: 'DEMO-CREDIT',
    nominal: '300',
    date: '2026-11-06',
    time: '15:00',
    club: 'Центральный',
    cashier: 'Тестовый сотрудник',
  },
  { ...payment, method: 'В кредит', memberId: '1001', client: 'Демо-клиент' },
);
assert.equal(creditGift['gift-cards'].find((row) => row.id === 'gift-on-credit').balance, '300');
assert.equal(creditGift.receivables.at(-1).memberId, '1001');
assert.equal(creditGift.receivables.at(-1).amount, '300');
const creditRestore = paidOperation(
  paymentData,
  {
    ...saleForPayment,
    id: 'restore-credit',
    name: 'Восстановление карты',
    memberId: '1001',
    client: 'Клиент карты',
  },
  100,
  { ...payment, method: 'В кредит', memberId: '1002', client: 'Другой клиент' },
);
assert.equal(
  creditRestore.receivables.at(-1).memberId,
  '1001',
  'A fixed card owner takes priority over draft recipient',
);
assert.equal(creditRestore.receivables.at(-1).amount, '100');

// Reissue is a same-client recalculation, independent of legacy recipient transfers.
const {
  quoteMembershipReissue: quoteReissue,
  reissueMembership,
  membershipPurchasePrice,
} = await import(await load(new URL('../src/lib/membership-reissue.ts', import.meta.url)));
const { clientFinanceRows, clientFinanceTotals, accountBalance, financeCents } = await import(
  await load(new URL('../src/lib/client-finance.ts', import.meta.url))
);
const reissueMember = { ...member, id: 90090, plan: 'Без абонемента', birthDate: '1980-01-01' };
const reissueData = {
  ...createWorkspaceData(),
  plans: [
    {
      id: 'target',
      name: 'Новый групповой',
      kindId: 'group',
      training: 'Групповые',
      type: 'По посещениям',
      visits: '10',
      duration: '30',
      price: '5000',
      status: 'Опубликован',
    },
  ],
  'issued-plans': [
    {
      id: 'source',
      memberId: '90090',
      name: 'Исходный групповой',
      kindId: 'group',
      training: 'Групповые',
      type: 'По посещениям',
      visits: '10',
      issued: '2026-11-01',
      purchasePrice: '6000',
    },
  ],
  'pass-usage': [
    {
      id: 'usage',
      memberId: '90090',
      passId: 'source',
      used: '2',
      remaining: '8',
      activatedAt: '2026-11-01',
      endsAt: '2026-11-30',
    },
  ],
};
const reissueInput = {
  passId: 'source',
  planId: 'target',
  mode: 'visits',
  today: '2026-11-06',
  purchasePrice: '',
  singlePrice: '1000',
  manualCredit: '3500',
  trainerId: '',
};
const quote = quoteReissue(reissueData, reissueMember, reissueInput);
assert.equal(quote.credit, 480000);
assert.equal(quote.due, 20000);
assert.equal(
  quoteReissue(reissueData, reissueMember, { ...reissueInput, mode: 'days' }).credit,
  500000,
  '25 of 30 days, including today and end',
);
assert.equal(
  quoteReissue(reissueData, reissueMember, { ...reissueInput, mode: 'single' }).credit,
  400000,
);
assert.equal(
  quoteReissue(reissueData, reissueMember, { ...reissueInput, mode: 'single', singlePrice: '4000' })
    .credit,
  0,
);
assert.equal(
  quoteReissue(reissueData, reissueMember, { ...reissueInput, mode: 'manual' }).credit,
  350000,
);
assert.throws(() =>
  quoteReissue(reissueData, reissueMember, {
    ...reissueInput,
    mode: 'manual',
    manualCredit: '6001',
  }),
);
assert.throws(() => financeCents('1.001'));
assert.throws(() => financeCents(''));
assert.equal(financeCents('0'), 0);
const unknownPrice = {
  ...reissueData,
  'issued-plans': reissueData['issued-plans'].map((row) => ({ ...row, purchasePrice: '' })),
};
assert.equal(membershipPurchasePrice(unknownPrice, 90090, 'source').cents, null);
assert.throws(() => quoteReissue(unknownPrice, reissueMember, reissueInput));
assert.equal(
  quoteReissue(unknownPrice, reissueMember, { ...reissueInput, purchasePrice: '6000' }).credit,
  480000,
);
const pausedReissue = {
  ...reissueData,
  'membership-overrides': [
    { id: '90090:source', memberId: '90090', passId: 'source', status: 'paused' },
  ],
};
assert.throws(
  () => quoteReissue(pausedReissue, reissueMember, { ...reissueInput, mode: 'days' }),
  /замороз/,
);
const pendingReissue = { ...reissueData, 'pass-usage': [] };
assert.equal(
  quoteReissue(pendingReissue, reissueMember, { ...reissueInput, mode: 'days' }).credit,
  600000,
);
const operator = {
  id: 'operator',
  name: 'Демо оператор',
  role: 'administrator',
  clubIds: ['central'],
};
const runInput = {
  ...reissueInput,
  id: 'test-reissue',
  stamp: '2026-11-06T15:00',
  reason: 'Переход на другой тариф',
  club: 'Центральный',
  expected: quote.signature,
  payment,
};
const originalReissue = structuredClone(reissueData);
const reissued = reissueMembership(reissueData, reissueMember, runInput, operator, true);
assert.deepEqual(reissueData, originalReissue, 'Atomic operation must not mutate source');
const oldPass = getClientProfile(reissueMember, reissued).subscriptions.find(
  (row) => row.id === 'source',
);
const newPass = getClientProfile(reissueMember, reissued).subscriptions.find(
  (row) => row.id === 'reissued:test-reissue',
);
assert.equal(oldPass.status, 'expired');
assert.equal(oldPass.remaining, 0);
assert.equal(oldPass.used, 2, 'Retain consumed history');
assert.equal(newPass.status, 'pending');
assert.equal(newPass.used, 0);
assert.equal(newPass.remaining, 10);
assert.equal(reissued['issued-plans'].at(-1).memberId, '90090');
assert.equal(reissued.ledger.at(-1).amount, '200', 'Only supplement is new payment');
assert.equal(reissued.ledger.at(-1).kind, 'membership-reissue');
assert.equal(accountBalance(0, 90090, reissued), 0, 'Full credit immediately applied to target');
assert.equal(reissued.receipts.at(-1).saleId, 'test-reissue');
assert.throws(() => reissueMembership(reissued, reissueMember, runInput, operator, true), /уже/);
assert.throws(
  () => reissueMembership(reissued, reissueMember, { ...runInput, id: 'repeat' }, operator, true),
  /незаверш/,
);
assert.throws(() => reissueMembership(reissueData, reissueMember, runInput, operator, false));
assert.throws(() =>
  reissueMembership(reissueData, reissueMember, runInput, { ...operator, role: 'trainer' }, true),
);
assert.throws(() =>
  reissueMembership(reissueData, reissueMember, runInput, { ...operator, clubIds: ['east'] }, true),
);
assert.throws(() =>
  reissueMembership(reissueData, reissueMember, { ...runInput, reason: ' ' }, operator, true),
);
assert.throws(() => quoteReissue(reissueData, { ...reissueMember, id: 90091 }, reissueInput));
assert.throws(() => quoteReissue(reissueData, { ...reissueMember, archived: true }, reissueInput));
assert.throws(() =>
  quoteReissue(reissueData, reissueMember, { ...reissueInput, today: '2026-12-01' }),
);
const stale = {
  ...reissueData,
  'pass-usage': reissueData['pass-usage'].map((row) => ({ ...row, used: '3', remaining: '7' })),
};
assert.throws(() => reissueMembership(stale, reissueMember, runInput, operator, true), /заново/);
const cheaper = {
  ...reissueData,
  plans: reissueData.plans.map((row) => ({ ...row, price: '3000' })),
};
const cheapQuote = quoteReissue(cheaper, reissueMember, reissueInput);
const cheapResult = reissueMembership(
  cheaper,
  reissueMember,
  { ...runInput, expected: cheapQuote.signature },
  operator,
  true,
);
assert.equal(accountBalance(100, 90090, cheapResult), 1900);
assert.equal(
  cheapResult.ledger.length,
  cheaper.ledger.length,
  'No zero payment or duplicate income',
);
assert.equal((cheapResult.receipts || []).length, (cheaper.receipts || []).length);
const debtResult = reissueMembership(
  reissueData,
  reissueMember,
  { ...runInput, payment: { ...payment, method: 'В кредит' } },
  operator,
  true,
);
assert.equal(debtResult.ledger.at(-1).amount, '0');
assert.equal(debtResult.receivables.at(-1).amount, '200');
const debtInput = { ...reissueInput, passId: 'reissued:test-reissue', mode: 'days' };
assert.throws(() => quoteReissue(debtResult, reissueMember, debtInput), /задолженность/);
const giftFailure = {
  ...runInput,
  payment: { ...payment, method: 'Подарочная карта', giftId: 'missing' },
};
assert.throws(() => reissueMembership(reissueData, reissueMember, giftFailure, operator, true));
assert.deepEqual(reissueData, originalReissue, 'Failed payment leaves old plan and history intact');
const ambiguousMember = { ...reissueMember, id: 90091 };
const financeData = {
  ...reissued,
  ledger: [
    {
      id: 'exact',
      memberId: '90090',
      client: 'Другое имя',
      name: 'Покупка',
      amount: '100',
      creditAmount: '20',
      date: '2026-11-06',
      time: '10:00',
    },
    {
      id: 'other',
      memberId: '90091',
      client: reissueMember.name,
      name: 'Чужая',
      amount: '999',
      date: '2026-11-06',
    },
    {
      id: 'ambiguous',
      client: reissueMember.name,
      name: 'Неоднозначная',
      amount: '999',
      date: '2026-11-06',
    },
    { id: 'unknown', memberId: '90090', name: 'Сумма неизвестна', amount: '', date: '' },
  ],
  'cash-events': [
    {
      id: 'cash-duplicate',
      kind: 'sale',
      saleId: 'exact',
      memberId: '90090',
      amount: '100',
      date: '2026-11-06',
    },
  ],
  receivables: [],
};
const financeRows = clientFinanceRows(
  reissueMember,
  [reissueMember, ambiguousMember],
  financeData,
  1200,
);
assert.equal(
  financeRows.filter((row) => row.group === 'purchase').length,
  2,
  'Exact id wins; ambiguous name and cash duplicate excluded',
);
assert.equal(financeRows.find((row) => row.sourceId === 'unknown').stamp, '');
assert.equal(financeRows.find((row) => row.group === 'opening').stamp, '');
assert.equal(financeRows.find((row) => row.group === 'opening').type, 'Входящий остаток ЛС');
assert.equal(
  clientFinanceTotals(reissueMember, [reissueMember, ambiguousMember], financeData).paid,
  null,
);
assert.equal(
  clientFinanceTotals(reissueMember, [reissueMember, ambiguousMember], financeData).debt,
  20,
);
assert.equal(clientFinanceTotals(reissueMember, [reissueMember], debtResult).debt, 200);
assert.equal(
  clientFinanceRows(reissueMember, [reissueMember], cheapResult, 0).filter(
    (row) => row.group === 'account',
  ).length,
  2,
);
console.log(
  'Reissue/finance checks passed: four formulas, cents, same-client atomic replacement, supplement/credit/surplus, stale/replay/role checks, identity and unknown history.',
);
const personalTarget = {
  ...reissueData,
  plans: reissueData.plans.map((row) => ({
    ...row,
    kindId: 'personal',
    training: 'Персональные',
    trainerCategory: 'trainer',
  })),
};
assert.throws(() => quoteReissue(personalTarget, reissueMember, reissueInput), /тренера/);
const activeTrainer = personalTarget['trainer-profiles'].find(
  (row) => row.categoryId === 'trainer' && row.status === 'Активен',
);
assert.equal(
  quoteReissue(personalTarget, reissueMember, { ...reissueInput, trainerId: activeTrainer.id })
    .trainer.id,
  activeTrainer.id,
);
assert.throws(
  () =>
    quoteReissue(
      {
        ...personalTarget,
        plans: personalTarget.plans.map((row) => ({ ...row, trainerCategory: 'master' })),
      },
      reissueMember,
      { ...reissueInput, trainerId: activeTrainer.id },
    ),
  /категории/,
);
assert.throws(
  () =>
    quoteReissue(
      {
        ...reissueData,
        plans: reissueData.plans.map((row) => ({ ...row, ageMin: '14', ageMax: '23' })),
      },
      reissueMember,
      reissueInput,
    ),
  /возраст/,
);
assert.throws(
  () =>
    reissueMembership(
      { ...reissueData, plans: reissueData.plans.map((row) => ({ ...row, price: '5001' })) },
      reissueMember,
      runInput,
      operator,
      true,
    ),
  /заново/,
);
assert.throws(
  () =>
    quoteReissue(
      { ...reissueData, plans: reissueData.plans.map((row) => ({ ...row, status: 'Черновик' })) },
      reissueMember,
      reissueInput,
    ),
  /опубликованный/,
);
assert.equal(
  quoteReissue(
    {
      ...reissueData,
      'issued-plans': reissueData['issued-plans'].map((row) => ({ ...row, purchasePrice: '0' })),
    },
    reissueMember,
    reissueInput,
  ).credit,
  0,
);
