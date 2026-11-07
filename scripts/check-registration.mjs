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
  for (const match of [...code.matchAll(/from ['"]([^'"]+)['"]/g)]) {
    const target = new URL(match[1] + '.ts', url);
    const replacement = await load(target);
    code = code.replace(match[0], `from '${replacement}'`);
  }
  const result = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  cache.set(key, result);
  return result;
}
const { getClientProfile } = await import(
  await load(new URL('../src/data/clientProfile.ts', import.meta.url))
);
const { usePass, passUnavailable } = await import(
  await load(new URL('../src/lib/registration.ts', import.meta.url))
);
const member = {
  id: 1001,
  name: 'Анна Смирнова',
  plan: 'Железная карта',
  visits: 24,
  status: 'active',
  joined: '12.09.2026',
  expires: '12.12.2026',
};
const profile = getClientProfile(member);
const personal = profile.subscriptions.find((pass) => pass.kindId === 'personal');
assert.equal(personal.remaining, 3);
const original = structuredClone(personal);
const usage = usePass(member, personal, 30, '2026-11-06');
assert.equal(usage.remaining, '2');
assert.deepEqual(personal, original);
const updated = getClientProfile(
  { ...member, visits: 25, initialPassVisits: 24 },
  { 'pass-usage': [usage] },
);
assert.equal(updated.subscriptions.find((pass) => pass.id === personal.id).remaining, 2);
assert.equal(updated.subscriptions[0].remaining, null);
assert.equal(updated.subscriptions[0].used, 24);
assert.throws(() => usePass(member, { ...personal, status: 'paused' }, 30, '2026-11-06'));
assert.throws(() => usePass(member, { ...personal, remaining: 0 }, 30, '2026-11-06'));
assert.ok(passUnavailable({ ...personal, kindId: undefined }));
const data = {
  'issued-plans': [
    {
      id: 'new',
      memberId: '1001',
      name: 'Новая групповая карта',
      kindId: 'group',
      type: 'По посещениям',
      visits: '12',
      duration: '60',
      issued: '2026-11-06',
    },
  ],
};
const pending = getClientProfile(member, data).subscriptions[0];
assert.equal(pending.status, 'pending');
assert.equal(passUnavailable(pending), null);
const first = usePass(member, pending, 60, '2026-11-06');
const second = getClientProfile(member, { ...data, 'pass-usage': [first] }).subscriptions[0];
assert.equal(second.remaining, 11);
assert.equal(second.status, 'active');
assert.equal(second.activatedAt, '06.11.2026');
assert.equal(second.endsAt, '04.01.2027');
const last = { ...personal, remaining: 1 };
const lastUse = usePass(member, last, 30, '2026-11-06');
assert.equal(
  getClientProfile(member, { 'pass-usage': [lastUse] }).subscriptions.find(
    (pass) => pass.id === last.id,
  ).status,
  'expired',
);
console.log(
  'Registration checks passed: selected pass usage, independent balances, activation, expiry, unavailable passes and immutable history.',
);
