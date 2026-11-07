import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const {
  canOpenModule,
  managementRoles,
  isManagementRole,
  personalClients,
  canManageEvent,
  personalScopeError,
  noteError,
} = await load('../src/lib/staff-rules.ts');
const { managementNavigationGroups } = await load('../src/data/management-navigation.ts');
const { adminSections } = await load('../src/data/admin.ts');
const { createWorkspaceData } = await load('../src/data/workspace.ts');
const { validateEvent, moveEvent } = await load('../src/lib/schedule.ts');
const data = createWorkspaceData();
const trainer = { id: 'user-trainer', name: 'Алина Белова', role: 'trainer', clubIds: ['central'] };
const admin = { id: 'user-admin', name: 'Александра Крылова', role: 'administrator' };
const bartender = { id: 'user-bartender', name: 'Никита Романов', role: 'bartender' };
assert.ok(canOpenModule('trainer', 'schedule'));
assert.ok(canOpenModule('trainer', 'trainer-clients'));
for (const section of [
  'members',
  'cash',
  'crm',
  'inventory',
  'training-templates',
  'bar',
  'bar-sales',
])
  assert.equal(canOpenModule('trainer', section), false, section);
for (const section of ['bar', 'bar-catalog', 'bar-sales', 'settings'])
  assert.ok(canOpenModule('bartender', section));
for (const section of [
  'members',
  'cash',
  'crm',
  'schedule',
  'trainer-clients',
  'inventory',
  'employees',
])
  assert.equal(canOpenModule('bartender', section), false, section);
assert.equal(canOpenModule('administrator', 'collagen'), false);
assert.ok(canOpenModule('administrator', 'crm'));
const managerSections = managementNavigationGroups.flatMap((group) => group.items);
const omitted = ['members', 'bar', 'bar-catalog', 'bar-sales', 'bar-categories', 'bar-collections'];
assert.ok(
  managerSections.length <= 18,
  'Management navigation should contain only key destinations',
);
for (const id of managerSections)
  assert.ok(adminSections.some((section) => section.id === id) && !omitted.includes(id));
for (const id of [
  'schedule',
  'registration',
  'services',
  'crm',
  'employees',
  'directories',
  'service-settings',
])
  assert.ok(managerSections.includes(id));
assert.equal(
  new Set(managerSections).size,
  managerSections.length,
  'Management menu must not repeat sections',
);
assert.equal(managementRoles.length, 5);
for (const role of managementRoles) {
  assert.ok(isManagementRole(role));
  for (const section of managerSections)
    assert.ok(canOpenModule(role, section), `${role}: ${section}`);
  assert.ok(canOpenModule(role, 'members'));
  assert.equal(canOpenModule(role, 'collagen'), false);
}
for (const role of ['administrator', 'trainer', 'bartender', 'marketer'])
  assert.equal(isManagementRole(role), false);
const members = [
  { id: 1001, name: 'А' },
  { id: 1003, name: 'Б' },
  { id: 1006, name: 'В' },
  { id: 1004, name: 'Другой клиент' },
];
assert.deepEqual(
  personalClients(data, members, trainer.id).map((m) => m.id),
  [1001, 1003, 1006],
);
assert.deepEqual(personalClients(data, members, 'other-trainer'), []);
assert.equal(
  personalClients(
    data,
    members.map((m) => ({ ...m, archived: m.id === 1001 })),
    trainer.id,
  ).length,
  2,
);
const session = data.events.find((e) => e.id === 'personal-demo-1');
assert.ok(canManageEvent(session, trainer));
assert.ok(canManageEvent(session, admin));
for (const role of managementRoles) {
  const manager = { ...admin, role };
  assert.ok(canManageEvent(session, manager));
  assert.equal(personalScopeError(session, manager, data['personal-clients']), null);
}
assert.equal(canManageEvent(session, bartender), false);
assert.equal(canManageEvent({ ...session, trainerId: 'other-trainer' }, trainer), false);
assert.equal(
  canManageEvent(
    data.events.find((e) => e.id === 'event-day-0'),
    trainer,
  ),
  false,
);
assert.equal(canManageEvent({ ...session, status: 'Завершено' }, trainer), false);
assert.equal(canManageEvent({ ...session, status: 'Отменено' }, admin), false);
assert.equal(personalScopeError(session, trainer, data['personal-clients']), null);
assert.match(
  personalScopeError({ ...session, trainer: 'Другой тренер' }, trainer, data['personal-clients']),
  /своего имени/,
);
assert.match(
  personalScopeError(
    { ...session, memberId: '1004', attendees: '1004' },
    trainer,
    data['personal-clients'],
  ),
  /закреплённого/,
);
assert.match(
  personalScopeError({ ...session, attendees: '1001,1003' }, trainer, data['personal-clients']),
  /одного клиента/,
);
assert.match(personalScopeError(session, bartender, data['personal-clients']), /не добавляет/);
assert.equal(
  noteError('Техника стала увереннее.', trainer.id, '1001', data['personal-clients']),
  null,
);
assert.match(noteError('   ', trainer.id, '1001', data['personal-clients']), /текст/);
assert.match(noteError('a'.repeat(2001), trainer.id, '1001', data['personal-clients']), /2000/);
assert.match(noteError('Запись', trainer.id, '1004', data['personal-clients']), /не закреплён/);
assert.match(
  noteError('Запись', 'other-trainer', '1001', data['personal-clients']),
  /не закреплён/,
);
for (const event of data.events)
  assert.equal(validateEvent(event, data.events, data.rooms), null, event.id);
const planned = moveEvent(
  session,
  { day: '2026-11-07', time: '08:00', room: session.room, club: session.club },
  data.rooms,
);
assert.equal(planned.memberId, '1001');
assert.equal(planned.attendees, '1001');
assert.equal(session.day, '2026-11-06');
const another = {
  ...session,
  id: 'other-personal',
  trainer: 'Другой тренер',
  trainerId: 'other',
  room: 'Большой зал',
  time: session.time,
};
assert.match(validateEvent(session, [session, another], data.rooms), /У клиента/);
const changed = createWorkspaceData();
changed['trainer-notes'][0].text = 'Изменено';
changed.events.push({ ...session, id: 'new-session' });
changed['bar-cart'].push({ id: 'current', items: '{"water":1}' });
const reset = createWorkspaceData();
assert.notEqual(reset['trainer-notes'][0].text, 'Изменено');
assert.equal(reset['bar-cart'].length, 0);
assert.ok(!reset.events.some((e) => e.id === 'new-session'));
console.log(
  'Staff checks passed: scoped routes, personal assignments, trainer ownership, notes, participant conflicts and independent reset.',
);
