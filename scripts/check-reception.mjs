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
