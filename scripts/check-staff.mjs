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
  canCreateEvent,
  canCancelEvent,
  canDeleteEvent,
  canCopySchedule,
  personalScopeError,
  noteError,
} = await load('../src/lib/staff-rules.ts');
const { managementNavigationGroups } = await load('../src/data/management-navigation.ts');
const { adminSections } = await load('../src/data/admin.ts');
const { createWorkspaceData } = await load('../src/data/workspace.ts');
const { validateEvent, moveEvent } = await load('../src/lib/schedule.ts');
const { shiftStaffColors, shiftStaffKey } = await load('../src/lib/shift-colors.ts');
const data = createWorkspaceData();
const { adminEmployee, ownAdminRecords, adminPaySummary } = await load(
  '../src/lib/admin-account.ts',
);
const accountUser = {
  id: 'user-admin',
  name: 'Александра Крылова',
  email: 'admin@example.com',
  role: 'administrator',
};
const accountEmployee = adminEmployee(data.employees, accountUser);
assert.equal(accountEmployee.id, 'emp-1');
assert.equal(adminEmployee(data.employees, { ...accountUser, role: 'trainer' }), undefined);
assert.equal(
  adminEmployee(data.employees, { ...accountUser, id: 'unknown', email: '' }),
  undefined,
  'Never link a personal account by display name',
);
assert.deepEqual(ownAdminRecords(data.shifts, ''), []);
const account = adminPaySummary(
  ownAdminRecords(data.shifts, accountEmployee.id),
  ownAdminRecords(data['employee-bonuses'], accountEmployee.id),
  ownAdminRecords(data['employee-payments'], accountEmployee.id),
  '2026-11-01',
  '2026-11-30',
);
assert.equal(account.hours, 56);
assert.equal(account.confirmedHours, 32);
assert.equal(account.earned, 8000);
assert.equal(account.approvedBonus, 1200);
assert.equal(account.pendingBonus, 500);
assert.equal(account.paid, 5000);
assert.equal(account.balance, 4200);
assert.equal(account.forecast, 15200);
const fractional = {
  id: 'short-night',
  start: '2026-10-31T23:30',
  end: '2026-11-01T01:15',
  rate: '250',
  status: 'Завершена',
};
assert.equal(
  adminPaySummary([fractional], [], [], '2026-11-01', '2026-11-30').earned,
  312.5,
  'Pay clips a night shift at month boundaries',
);
assert.equal(
  adminPaySummary([{ ...fractional, status: 'Отменена' }], [], [], '2026-11-01', '2026-11-30')
    .hours,
  0,
);
assert.equal(
  adminPaySummary([{ ...fractional, rate: '' }], [], [], '2026-11-01', '2026-11-30').missingRates,
  1,
  'Missing rate is not zero pay',
);
for (const role of [
  'administrator',
  'trainer',
  'bartender',
  'marketer',
  'accountant',
  ...managementRoles,
])
  assert.equal(canOpenModule(role, 'admin-account'), role === 'administrator');
const { shiftProblem, shiftHours, shiftsOnDay, shiftPeriodHours } =
  await load('../src/lib/shifts.ts');
const shift = data.shifts.find((row) => row.id === 'shift-1');
assert.equal(shiftHours(shift), 8);
for (const row of data.shifts) assert.equal(shiftProblem(row, data.shifts), null, row.id);
const next = {
  ...shift,
  id: 'next-shift',
  employeeId: 'another-admin',
  name: 'Следующий администратор',
  start: '2026-11-06T14:30',
  end: '2026-11-06T18:30',
};
assert.equal(shiftProblem(next, [shift]), null, 'Contiguous shifts hand over the same computer');
assert.match(shiftProblem({ ...next, start: '2026-11-06T14:00' }, [shift]), /уже занято/);
assert.equal(
  shiftProblem({ ...next, workplace: 'Место 2', start: shift.start, end: shift.end }, [shift]),
  null,
  'Two administrators may work concurrently',
);
assert.match(
  shiftProblem({ ...shift, id: 'double', club: 'Другой клуб' }, [shift]),
  /У сотрудника уже есть смена/,
);
assert.match(shiftProblem({ ...next, end: next.start }, []), /позже начала/);
assert.match(shiftProblem({ ...next, start: '', end: '' }, []), /позже начала/);
assert.equal(
  shiftProblem({ ...next, reception: 'Ресепшен 02', start: shift.start, end: shift.end }, [shift]),
  null,
);
assert.match(
  shiftProblem(
    { ...shift, id: 'legacy-double', employeeId: '', name: `  ${shift.name.toUpperCase()}  ` },
    [shift],
  ),
  /У сотрудника уже есть смена/,
);
const night = { ...shift, id: 'night', start: '2026-11-08T22:00', end: '2026-11-09T02:00' };
assert.equal(shiftHours(night), 4);
assert.equal(shiftsOnDay([night], '2026-11-08')[0].to, 1440);
assert.equal(shiftsOnDay([night], '2026-11-09')[0].to, 120);
assert.equal(
  shiftPeriodHours([night], '2026-11-02', '2026-11-08'),
  2,
  'Clip totals at period boundary',
);
assert.equal(
  shiftPeriodHours(data.shifts, '2026-11-06', '2026-11-06'),
  24,
  'Parallel shifts sum as person-hours',
);
const colors = shiftStaffColors(data.employees, data.shifts);
assert.equal(new Set(colors.values()).size, colors.size, 'Demo employees have distinct colours');
assert.deepEqual(
  [...shiftStaffColors([...data.employees].reverse(), [...data.shifts].reverse())],
  [...colors],
  'Colours must not depend on roster/history order',
);
for (const row of data.shifts) {
  const key = shiftStaffKey(row, data.employees);
  assert.equal(colors.get(key), shiftStaffColors(data.employees, data.shifts).get(key));
  assert.equal(
    shiftStaffKey({ ...row, name: `  ${row.name.toUpperCase()}  ` }, data.employees),
    key,
  );
}
assert.equal(
  shiftStaffKey({ id: 'renamed-shift', name: 'Новое имя', employeeId: 'emp-1' }, data.employees),
  'emp-1',
  'Saved employee identity survives renaming',
);
const trainer = { id: 'user-trainer', name: 'Алина Белова', role: 'trainer', clubIds: ['central'] };
const admin = { id: 'user-admin', name: 'Александра Крылова', role: 'administrator' };
const bartender = { id: 'user-bartender', name: 'Никита Романов', role: 'bartender' };
for (const section of ['crm', 'leads', 'pipelines', 'segments', 'retention', 'statistics'])
  assert.ok(canOpenModule('marketer', section), `Marketing: ${section}`);
for (const section of [
  'cash',
  'services',
  'products',
  'statistics',
  'payroll',
  'inventory',
  'memberships',
])
  assert.ok(canOpenModule('accountant', section), `Accounting: ${section}`);
for (const section of ['cash', 'payroll', 'services', 'rbac'])
  assert.equal(canOpenModule('marketer', section), false);
for (const section of ['crm', 'trainer-clients', 'schedule', 'bar', 'rbac', 'registration'])
  assert.equal(canOpenModule('accountant', section), false);
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
assert.equal(managerSections.includes('trainer-clients'), false);
assert.equal(
  managerSections.includes('statistics'),
  false,
  'Statistics is a separate sidebar item',
);
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
  assert.equal(
    canOpenModule(role, 'trainer-clients'),
    false,
    'Only trainers see their own personal clients',
  );
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
assert.equal(canManageEvent(session, admin), false);
assert.equal(canCreateEvent(admin), false);
assert.equal(canDeleteEvent(session, admin), false);
assert.equal(canCopySchedule(admin), false);
assert.equal(canCopySchedule(trainer), false);
assert.equal(canCopySchedule(bartender), false);
assert.equal(canCancelEvent(session, admin), false);
assert.equal(canCancelEvent({ ...session, status: 'Отменено' }, admin), false);
assert.equal(
  personalScopeError(session, admin, data['personal-clients']),
  null,
  'Reception can create an assigned personal appointment, while general creation stays forbidden',
);
assert.ok(personalScopeError({ ...session, kind: 'group' }, admin, data['personal-clients']));
for (const role of managementRoles) {
  const manager = { ...admin, role };
  assert.ok(canManageEvent(session, manager));
  assert.ok(canDeleteEvent(session, manager));
  assert.ok(canCopySchedule(manager));
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
