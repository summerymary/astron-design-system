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

const clock = await import(await load(new URL('../src/lib/demo-clock.ts', import.meta.url)));
assert.equal(clock.daysInClub('12.09.2026'), 55);
assert.equal(clock.daysInClub('01.12.2026'), 0);
assert.equal(clock.daysInClub('invalid'), 0);
clock.resetDemoClock();
assert.equal(clock.demoStamp(clock.nextDemoNow()), '2026-11-06T14:35');
assert.equal(clock.demoStamp(clock.nextDemoNow()), '2026-11-06T14:36');
clock.resetDemoClock();
assert.equal(clock.demoStamp(clock.nextDemoNow()), '2026-11-06T14:35');
console.log('Demo clock checks passed: Moscow timestamps, shared day, elapsed days and reset.');

const rules = await import(await load(new URL('../src/lib/registration.ts', import.meta.url)));
const workspace = await import(await load(new URL('../src/data/workspace.ts', import.meta.url)));
const planRules = await import(
  await load(new URL('../src/lib/workspace-rules.ts', import.meta.url))
);
const seed = workspace.createWorkspaceData();
const light = {
  ...personal,
  id: 'light',
  kindId: 'gym',
  ...seed.plans.find((p) => p.id === 'plan-light'),
  status: 'active',
};
const lunch = { ...light, ...seed.plans.find((p) => p.id === 'plan-lunch') };
const originalLight = structuredClone(light);
for (const [pass, day, time, allowed] of [
  [light, '2026-11-06', '06:29', false],
  [light, '2026-11-06', '06:30', true],
  [light, '2026-11-06', '15:59', true],
  [light, '2026-11-06', '16:00', false],
  [light, '2026-11-06', '19:59', false],
  [light, '2026-11-06', '20:00', true],
  [light, '2026-11-06', '23:09', true],
  [light, '2026-11-06', '23:10', false],
  [light, '2026-11-07', '06:59', false],
  [light, '2026-11-07', '07:00', true],
  [light, '2026-11-08', '22:09', true],
  [light, '2026-11-08', '22:10', false],
  [lunch, '2026-11-06', '11:59', false],
  [lunch, '2026-11-06', '12:00', true],
  [lunch, '2026-11-06', '14:59', true],
  [lunch, '2026-11-06', '15:00', false],
  [lunch, '2026-11-07', '16:59', false],
  [lunch, '2026-11-07', '17:00', true],
  [lunch, '2026-11-08', '22:09', true],
  [lunch, '2026-11-08', '22:10', false],
]) {
  assert.equal(
    rules.passUnavailable(pass, `${day}T${time}`) === null,
    allowed,
    `${pass.name} ${day} ${time}`,
  );
  if (allowed) assert.doesNotThrow(() => usePass(member, pass, 30, day, time));
  else assert.throws(() => usePass(member, pass, 30, day, time));
}
assert.deepEqual(light, originalLight, 'Time validation and refused use must not mutate a pass');
assert.ok(rules.passUnavailable({ ...light, accessWeekdays: 'bad' }, '2026-11-06T14:35'));
assert.ok(
  planRules.validatePlan(
    { ...seed.plans[0], accessWeekdays: '06:30–16:00, 15:00–20:00', accessWeekends: '07:00–22:10' },
    true,
  ),
);
assert.ok(planRules.validatePlan({ ...seed.plans[0], accessWeekdays: '06:30–16:00' }, true));
for (const plan of seed.plans) assert.equal(planRules.validatePlan(plan, true), null, plan.name);
const limitedProfile = getClientProfile({ ...member, id: 1006 }, seed);
assert.equal(
  limitedProfile.subscriptions.find((p) => p.id === 'issued-light').accessWeekdays,
  light.accessWeekdays,
);

const youth = { ...personal, ...seed.plans.find((p) => p.id === 'plan-youth'), status: 'active' };
for (const [birthDate, allowed] of [
  ['2012-11-07', false],
  ['2012-11-06', true],
  ['2003-11-06', true],
  ['2002-11-07', true],
  ['2002-11-06', false],
  ['', false],
  ['2012-02-30', false],
]) {
  assert.equal(
    rules.passUnavailable(youth, '2026-11-06T14:35', birthDate) === null,
    allowed,
    birthDate,
  );
  if (allowed)
    assert.doesNotThrow(() => usePass({ ...member, birthDate }, youth, 30, '2026-11-06', '14:35'));
  else assert.throws(() => usePass({ ...member, birthDate }, youth, 30, '2026-11-06', '14:35'));
}
assert.equal(rules.ageOnDate('06.11.2012', '2026-11-06'), 14);
assert.ok(planRules.validatePlan({ ...seed.plans[0], ageMin: '23', ageMax: '14' }, true));

const event = {
  id: 'booking',
  name: 'Пилатес',
  day: '2026-11-06',
  time: '15:10',
  duration: '50',
  club: 'Центральный',
  attendees: '1001',
  status: 'Запись открыта',
};
for (const [time, expected] of [
  ['14:09', 0],
  ['14:10', 1],
  ['15:10', 1],
  ['15:40', 1],
  ['15:41', 0],
])
  assert.equal(
    rules.registrationBookings([event], 1001, 'Центральный', `2026-11-06T${time}`).length,
    expected,
    time,
  );
for (const patch of [
  { club: 'Парк' },
  { day: '2026-11-07' },
  { status: 'Отменено' },
  { status: 'Завершено' },
  { attendees: '10010' },
])
  assert.equal(
    rules.registrationBookings([{ ...event, ...patch }], 1001, 'Центральный', '2026-11-06T14:35')
      .length,
    0,
  );
const groupPass = { ...personal, id: 'group', kindId: 'group' };
const gymPass = { ...personal, id: 'gym', kindId: 'gym' };
const personalEvent = { ...event, kind: 'personal', trainer: 'Алина Белова' };
assert.deepEqual(
  rules.recommendedPassIds([groupPass, personal, gymPass], event, '2026-11-06T14:35'),
  ['group'],
);
assert.deepEqual(
  rules.recommendedPassIds([groupPass, personal, gymPass], personalEvent, '2026-11-06T14:35'),
  [personal.id],
);
assert.deepEqual(
  rules.recommendedPassIds([{ ...groupPass, status: 'paused' }], event, '2026-11-06T14:35'),
  [],
);
assert.equal(
  rules.bookingPassProblem({ ...gymPass, training: 'Групповые' }, event),
  null,
  'Purpose does not depend on the chosen card colour',
);
assert.throws(() => usePass(member, gymPass, 30, '2026-11-06', '14:35', personalEvent));
console.log(
  'Eligibility checks passed: weekday/weekend windows, split intervals, boundaries, immutable rejection, ages 14–23 and booking suggestions at −60/+30 minutes.',
);
const child = { ...member, birthDate: '2014-04-12' };
assert.ok(rules.minorVisitProblem(child.birthDate, '2026-11-06'));
assert.equal(rules.minorVisitProblem(child.birthDate, '2026-11-06', { acknowledged: true }), null);
assert.equal(
  rules.minorVisitProblem(child.birthDate, '2026-11-06', { trainerVerified: true }),
  null,
);
assert.equal(
  rules.minorVisitProblem('2012-11-06', '2026-11-06'),
  null,
  'From the 14th birthday the supervision reminder no longer blocks confirmation',
);
assert.ok(rules.minorVisitProblem('', '2026-11-06'));
assert.throws(() => usePass(child, gymPass, 30, '2026-11-06', '14:35'));
assert.doesNotThrow(() =>
  usePass(child, gymPass, 30, '2026-11-06', '14:35', undefined, { acknowledged: true }),
);
assert.throws(
  () => usePass(child, gymPass, 30, '2026-11-06', '14:35', undefined, { trainerVerified: true }),
  'A flag without a personal appointment cannot bypass supervision',
);
assert.doesNotThrow(() =>
  usePass(child, personal, 30, '2026-11-06', '14:35', personalEvent, { trainerVerified: true }),
);
assert.throws(
  () => usePass(child, youth, 30, '2026-11-06', '14:35', undefined, { acknowledged: true }),
  'An adult does not override a tariff age restriction',
);
console.log(
  'Under-14 checks passed: warning acknowledgement, known trainer booking, unknown age and tariff age restrictions.',
);
