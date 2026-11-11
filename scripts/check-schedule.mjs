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
for (const record of [...data.events, ...data['training-templates']]) {
  assert.ok(['Низкая', 'Средняя', 'Высокая'].includes(record.intensity));
  assert.equal(record.color, rules.trainingIntensity(record).color);
}
assert.equal(rules.trainingIntensity({ intensity: 'Низкая', color: '#FF0000' }).color, '#26804A');
assert.equal(rules.trainingIntensity({ intensity: 'Средняя' }).color, '#D4AE17');
assert.equal(rules.trainingIntensity({ intensity: 'Высокая' }).color, '#CE3F3F');
assert.equal(rules.trainingIntensity({}).value, 'Средняя');
assert.equal(
  rules.templateEvent(
    { ...data['training-templates'][0], intensity: 'Высокая' },
    { id: 'new', club: 'Центральный', intensity: 'Низкая' },
    data.rooms,
    'Тренер',
  ).intensity,
  'Высокая',
  'Template intensity overrides stale draft values',
);
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

// Overview fits the frame unless doing so would hide class titles.
for (const samples of [busyDay, events, displayedDay, [], [displayedDay[0]]]) {
  for (const height of [100, 238, 360, 580, 820]) {
    for (const weekly of [false, true]) {
      const fit = rules.calendarGeometry(samples, 'Весь день', height, weekly);
      const comfortable = rules.calendarGeometry(samples, 'Комфортно', height, weekly);
      const larger = rules.calendarGeometry(samples, 'Крупнее', height, weekly);
      assert.ok(fit.height >= height);
      assert.ok(fit.height <= comfortable.height, 'Overview remains denser than Comfortable');
      const shortest = Math.min(50, ...samples.map((e) => Number(e.duration)));
      const readableHeight = samples.length
        ? ((rules.calendarBounds(samples).end - rules.calendarBounds(samples).start) / shortest) *
          16
        : 0;
      assert.equal(
        fit.height,
        Math.max(height, readableHeight),
        'Fit uses the available frame, reserving only enough height to keep every title readable',
      );
      assert.ok(comfortable.height >= height);
      assert.ok(
        larger.height >= comfortable.height * 1.5,
        'Larger must visibly differ from Comfortable',
      );
      const range = rules.calendarBounds(samples);
      assert.ok(
        (fit.height * 60 * fit.hourStep) / (range.end - range.start) >= 26,
        'Axis labels must remain readable without overlapping',
      );
      for (const { event } of rules.layoutEvents(samples)) {
        const bottom =
          ((rules.minutes(event.time) + Number(event.duration) - range.start) /
            (range.end - range.start)) *
          fit.height;
        assert.ok(bottom <= fit.height + 0.01, 'The last class must stay inside the fit overview');
      }
    }
  }
}

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
    'intensity',
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

// Booking, presence and removal are separate, immutable transitions.
const { changeAttendance, changeReserve, reserveSeatNotification, rosterIds } = await load(
  '../src/lib/schedule-attendance.ts',
);
const participant = { id: 2001, name: 'Test participant' };
const emptyClass = {
  ...displayedDay[0],
  id: 'booking-test',
  attendees: '',
  booked: '0',
  present: '',
  capacity: '1',
  status: 'Запись открыта',
};
const booked = changeAttendance(emptyClass, participant, 'book');
assert.equal(typeof booked, 'object');
assert.equal(booked.booked, '1');
assert.deepEqual(rosterIds(booked.attendees), ['2001']);
assert.equal(booked.status, 'Мест нет');
assert.match(changeAttendance(booked, participant, 'book'), /уже записан/);
assert.match(changeAttendance(booked, { ...participant, id: 2002 }, 'book'), /мест нет/);
assert.match(
  changeAttendance({ ...emptyClass, status: 'Отменено' }, participant, 'book'),
  /отменено/,
);
assert.match(changeAttendance(emptyClass, participant, 'present'), /не записан/);
const attended = changeAttendance(booked, participant, 'present');
assert.equal(attended.present, '2001');
assert.equal(booked.present, '');
assert.equal(changeAttendance(attended, participant, 'present').present, '2001');
assert.equal(changeAttendance(attended, participant, 'absent').present, '');
const removed = changeAttendance(attended, participant, 'remove');
assert.equal(removed.booked, '0');
assert.equal(removed.present, '');
assert.equal(removed.status, 'Запись открыта');
assert.equal(emptyClass.booked, '0');
const overlap = { ...booked, id: 'other-class', club: 'Другой клуб' };
assert.match(changeAttendance(emptyClass, participant, 'book', [overlap]), /уже записан/);
for (const event of data.events)
  assert.equal(
    Number(event.booked),
    rosterIds(event.attendees).length,
    'Roster count: ' + event.id,
  );
console.log(
  'Attendance checks passed: capacity, duplicate booking, cross-club overlap, attendance, removal, cancellation and immutable updates.',
);

// Heatmap measures occupied capacity, not an average of class percentages.
const sample = (booked, capacity, status = 'Запись открыта') => ({
  id: 'occupancy',
  booked: String(booked),
  capacity: String(capacity),
  status,
});
for (const pct of [0, 24, 25, 49, 50, 74, 75, 99, 100, 120]) {
  const actual = rules.eventOccupancy(sample(pct, 100));
  assert.equal(actual.percent, pct);
  const band = [...rules.OCCUPANCY_SCALE].reverse().find((b) => pct >= b.min);
  assert.equal(actual.background, band.background);
}
assert.equal(rules.eventOccupancy(sample(1, 0)).percent, null);
assert.equal(rules.eventOccupancy(sample(5, 10, 'Отменено')).percent, null);
assert.equal(rules.eventOccupancy(sample(-2, 10)).percent, 0);
assert.equal(rules.eventOccupancy(sample(Infinity, 10)).percent, 0);
assert.deepEqual(
  rules.occupancySummary([sample(1, 1), sample(1, 9), sample(5, 10, 'Отменено'), sample(2, 0)]),
  { count: 2, booked: 2, capacity: 10, percent: 20 },
);
assert.equal(rules.occupancySummary([]).percent, null);
console.log(
  'Occupancy checks passed: thresholds, invalid capacity, cancellation, overbooking and weighted summary.',
);

const { contrastRatio } = await load('../src/lib/theme.ts');
const fullEvent = {
  ...displayedDay[0],
  id: 'reserve-test',
  attendees: '1001',
  booked: '1',
  capacity: '1',
  present: '',
  status: 'Мест нет',
};
const waitingMember = { id: 1002, name: 'Waiting client', visits: 20 };
const waitingOriginal = structuredClone(waitingMember);
const withReserve = changeReserve(fullEvent, waitingMember, 'join');
assert.equal(withReserve.reserve, '1002');
assert.equal(withReserve.booked, '1', 'Reserve never occupies an actual seat');
assert.deepEqual(waitingMember, waitingOriginal, 'Joining reserve never consumes a pass');
assert.equal(fullEvent.reserve, undefined, 'Reserve updates are immutable');
assert.equal(typeof changeReserve(withReserve, waitingMember, 'join'), 'string');
assert.equal(typeof changeReserve(fullEvent, { id: 1001 }, 'join'), 'string');
assert.equal(
  typeof changeReserve({ ...fullEvent, attendees: '', booked: '0' }, waitingMember, 'join'),
  'string',
);
assert.equal(
  typeof changeReserve({ ...fullEvent, status: 'Отменено' }, waitingMember, 'join'),
  'string',
);
const freed = changeAttendance(withReserve, { id: 1001 }, 'remove', [withReserve]);
const notice = reserveSeatNotification(withReserve, freed, 1);
assert.ok(
  notice &&
    notice.unread === 'true' &&
    notice.eventId === fullEvent.id &&
    notice.section === 'schedule',
);
assert.equal(
  reserveSeatNotification(freed, freed, 2),
  null,
  'Repeated saving must not duplicate the notification',
);
assert.equal(
  reserveSeatNotification({ ...withReserve, reserve: '' }, { ...freed, reserve: '' }, 2),
  null,
);
assert.equal(reserveSeatNotification(withReserve, { ...freed, status: 'Отменено' }, 2), null);
const promoted = changeAttendance(freed, waitingMember, 'book', [freed]);
assert.equal(promoted.attendees, '1002');
assert.equal(promoted.reserve, '');
assert.equal(reserveSeatNotification(freed, promoted, 2), null);
assert.equal(changeReserve(withReserve, waitingMember, 'leave').reserve, '');
const reserveSeed = data.events.find((event) => event.reserve);
assert.ok(reserveSeed, 'Demo schedule includes a full class with a reserve');
assert.equal(rosterIds(reserveSeed.attendees).length, Number(reserveSeed.capacity));
console.log(
  'Reserve checks passed: full capacity, duplicate protection, no pass usage, vacancy notifications, promotion and immutable records.',
);
for (const band of rules.OCCUPANCY_SCALE)
  assert.ok(
    contrastRatio(band.foreground, band.background) >= 4.5,
    'Readable heatmap text: ' + band.label,
  );
