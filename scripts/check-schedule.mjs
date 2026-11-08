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
const rules = await load('../src/lib/schedule.ts');
const { createWorkspaceData } = await load('../src/data/workspace.ts');
const data = createWorkspaceData();
const events = data.events;
const displayedDay = events.filter((e) => e.day === '2026-11-06' && e.room === 'Большой зал');
assert.equal(displayedDay.length, 11);
assert.equal(
  events.filter((e) => e.day === '2026-11-06' && e.club === 'Центральный').length,
  14,
  'Default day keeps approximately 65% of the former 21 classes',
);
// Capacity is still checked against a separate dense day, not the default demo data.
const busyDay = Array.from({ length: 18 }, (_, index) => ({
  ...displayedDay[0],
  id: `stress-${index}`,
  time: rules.clock(360 + index * 55),
  trainer: index % 2 ? 'Максим Ветров' : 'Алина Белова',
}));
for (const event of busyDay) assert.equal(rules.validateEvent(event, busyDay, data.rooms), null);
for (const event of events)
  assert.equal(rules.validateEvent(event, events, data.rooms), null, event.name);
assert.equal(rules.layoutEvents(busyDay).length, 18, 'No classes may be collapsed or hidden');
assert.ok(rules.layoutEvents(busyDay).every((e) => e.lanes === 1));

const original = { ...displayedDay[0], attendees: '1001,1002' };
const before = structuredClone(original);
const target = { day: '2026-11-07', time: '08:00', room: 'Сайкл-студия', club: 'Центральный' };
const moved = rules.moveEvent(original, target, data.rooms);
assert.deepEqual(original, before, 'Planning a drag must never mutate the event');
assert.equal(moved.attendees, '1001,1002', 'Moves preserve participant records');
assert.equal(moved.capacity, '12', 'Room-based capacity adapts to destination');
assert.equal(rules.validateEvent(moved, events, data.rooms), null);
assert.match(
  rules.validateEvent({ ...moved, booked: '13' }, events, data.rooms),
  /недостаточно мест/,
);
assert.match(rules.validateEvent({ ...original, time: '06:10' }, events, data.rooms), /уже есть/);
assert.match(
  rules.validateEvent(
    { ...moved, id: 'new-event', day: original.day, time: original.time },
    events,
    data.rooms,
  ),
  /У тренера/,
);
assert.equal(
  rules.validateEvent(
    { ...moved, id: 'new-event', day: original.day, time: original.time },
    events.map((e) => (e.id === original.id ? { ...e, status: 'Отменено' } : e)),
    data.rooms,
  ),
  null,
  'Cancelled classes do not occupy room/trainer',
);
assert.match(rules.validateEvent({ ...moved, time: '23:30' }, events, data.rooms), /завершиться/);
assert.match(rules.validateEvent({ ...moved, time: '25:00' }, events, data.rooms), /время/);
assert.match(rules.validateEvent({ ...moved, day: '2026-02-30' }, events, data.rooms), /дату/);
assert.match(
  rules.validateEvent({ ...moved, room: 'Нет зала' }, events, data.rooms),
  /действующий зал/,
);
assert.ok(rules.sameSlot(original, { ...original, name: 'Иное название' }));
assert.ok(!rules.sameSlot(original, moved));
assert.equal(rules.isMovable({ ...original, status: 'Отменено' }), false);
assert.equal(rules.isMovable({ ...original, status: 'Завершено' }), false);

// Touching intervals are allowed, but intersecting classes get distinct lanes.
const parallel = [
  { ...original, id: 'a', time: '09:00', duration: '60' },
  { ...original, id: 'b', time: '09:30', duration: '60' },
  { ...original, id: 'c', time: '10:00', duration: '30' },
  { ...original, id: 'd', time: '10:30', duration: '30' },
];
const layout = rules.layoutEvents(parallel);
assert.deepEqual(
  layout.map((e) => e.lanes),
  [2, 2, 2, 1],
);
assert.equal(layout[0].lane, layout[2].lane, 'Nonintersecting events reuse lanes');
assert.equal(rules.overlaps(parallel[0], parallel[2]), false);
assert.deepEqual(rules.calendarBounds([]), { start: 360, end: 1380 });
const bounds = rules.calendarBounds(busyDay);
assert.ok(bounds.start <= 360 && bounds.end >= 1345);
assert.equal(rules.slotAt(200, 100, 600, 360, 1080, 15, 30, 50), '07:30');
assert.equal(rules.slotAt(-100, 100, 600, 0, 1440, 5, 0, 50), '00:00');
assert.equal(rules.slotAt(9999, 100, 600, 0, 1440, 5, 0, 50), '23:10');
assert.equal(rules.weekStart('2026-11-08'), '2026-11-02');
assert.equal(rules.addDays('2026-12-31', 1), '2027-01-01');

for (const template of data['training-templates']) {
  const draft = rules.templateEvent(
    template,
    {
      id: 'new',
      club: 'Центральный',
      day: '2026-11-07',
      time: '07:00',
      booked: '0',
      attendees: '',
    },
    data.rooms,
    'Резервный тренер',
  );
  for (const field of [
    'name',
    'duration',
    'trainer',
    'room',
    'capacity',
    'capacityMode',
    'format',
    'payment',
    'booking',
    'seats',
    'waitlist',
    'color',
    'description',
  ])
    assert.ok(draft[field], `Autofill ${field} for ${template.name}`);
  assert.equal(draft.id, 'new', 'Template ID must not replace event ID');
  assert.equal(draft.templateId, template.id);
  assert.equal(rules.validateEvent(draft, events, data.rooms), null);
}
const own = rules.templateEvent(
  { ...data['training-templates'][0], capacityMode: 'Своя вместимость', capacity: '8' },
  { id: 'own', club: 'Центральный', room: 'Сайкл-студия' },
  data.rooms,
  'Тренер',
);
assert.equal(own.capacity, '8');
const cycle = data['training-templates'].find((t) => t.name === 'Сайкл');
assert.equal(
  rules.templateEvent(
    cycle,
    { id: 'cycle', club: 'Центральный', room: 'Большой зал' },
    data.rooms,
    'Тренер',
  ).room,
  'Сайкл-студия',
  'Template fills its preferred room',
);
assert.equal(
  rules.templateEvent(
    cycle,
    { id: 'cycle-slot', club: 'Центральный', room: 'Большой зал', keepRoom: 'true' },
    data.rooms,
    'Тренер',
  ).room,
  'Большой зал',
  'An explicitly clicked calendar slot keeps its room',
);
const free = rules.nextFreeTime(
  events,
  '2026-11-06',
  'Центральный',
  'Большой зал',
  50,
  'Алина Белова',
);
assert.equal(free, '07:45');
assert.equal(rules.validateEvent({ ...original, time: free }, events, data.rooms), null);
console.log(
  'Schedule checks passed: 18/day, overlaps, moves, capacities, snapping, dates and full template autofill.',
);
