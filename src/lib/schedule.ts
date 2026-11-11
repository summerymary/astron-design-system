import type { DemoRecord } from '../data/workspace';

export const TRAINING_INTENSITIES = [
  { value: 'Низкая', color: '#26804A', label: 'Низкая интенсивность' },
  { value: 'Средняя', color: '#D4AE17', label: 'Средняя интенсивность' },
  { value: 'Высокая', color: '#CE3F3F', label: 'Высокая интенсивность' },
] as const;
export function trainingIntensity(event: DemoRecord) {
  return (
    TRAINING_INTENSITIES.find((item) => item.value === event.intensity) || TRAINING_INTENSITIES[1]
  );
}

export const OCCUPANCY_SCALE = [
  { min: 0, label: '0–24%', background: '#F5EEF2', foreground: '#3E2533', line: '#D9C1CF' },
  { min: 25, label: '25–49%', background: '#EACBD8', foreground: '#3E2533', line: '#BF8BA3' },
  { min: 50, label: '50–74%', background: '#D596B0', foreground: '#3E1829', line: '#A55E7D' },
  { min: 75, label: '75–99%', background: '#8A3F61', foreground: '#FFFFFF', line: '#6C2D4A' },
  { min: 100, label: '100% и выше', background: '#4E1F35', foreground: '#FFFFFF', line: '#4E1F35' },
] as const;
export function eventOccupancy(event: DemoRecord) {
  const capacity = Number(event.capacity);
  const rawBooked = Number(event.booked);
  const booked = Number.isFinite(rawBooked) ? Math.max(0, rawBooked) : 0;
  const valid = event.status !== 'Отменено' && Number.isFinite(capacity) && capacity > 0;
  const percent = valid ? Math.round((booked / capacity) * 100) : null;
  const band =
    [...OCCUPANCY_SCALE].reverse().find((item) => percent !== null && percent >= item.min) ||
    OCCUPANCY_SCALE[0];
  return {
    booked,
    capacity: valid ? capacity : 0,
    percent,
    label:
      event.status === 'Отменено'
        ? 'Отменено'
        : percent === null
          ? 'Нет вместимости'
          : percent + '%',
    background: valid ? band.background : '#F0F1F3',
    foreground: valid ? band.foreground : '#60646D',
    line: valid ? band.line : '#C9CDD3',
  };
}
export function occupancySummary(events: DemoRecord[]) {
  const valid = events.map(eventOccupancy).filter((item) => item.percent !== null);
  const capacity = valid.reduce((sum, item) => sum + item.capacity, 0);
  const booked = valid.reduce((sum, item) => sum + item.booked, 0);
  return {
    count: valid.length,
    booked,
    capacity,
    percent: capacity ? Math.round((booked / capacity) * 100) : null,
  };
}

export type ScheduleColumn = { key: string; day: string; room: string; label: string };
export type EventPlacement = { event: DemoRecord; lane: number; lanes: number };
export type ScheduleTarget = { day: string; time: string; room: string; club: string };

export function minutes(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}
export function clock(value: number): string {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, '0')}:${Math.round(value % 60)
    .toString()
    .padStart(2, '0')}`;
}
export function addDays(day: string, offset: number): string {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
export function weekStart(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}
export function dayText(day: string, short = false): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: short ? 'short' : 'long',
    weekday: short ? 'short' : undefined,
  });
}
export function eventTime(event: DemoRecord): string {
  return `${event.time}–${clock(minutes(event.time) + Number(event.duration))}`;
}
export function isMovable(event: DemoRecord): boolean {
  return !['Завершено', 'Отменено'].includes(event.status);
}
export function overlaps(a: DemoRecord, b: DemoRecord): boolean {
  return (
    a.day === b.day &&
    minutes(a.time) < minutes(b.time) + Number(b.duration) &&
    minutes(b.time) < minutes(a.time) + Number(a.duration)
  );
}
export function calendarBounds(events: DemoRecord[]): { start: number; end: number } {
  const valid = events.filter(
    (event) => Number.isFinite(minutes(event.time)) && Number(event.duration) > 0,
  );
  if (!valid.length) return { start: 6 * 60, end: 23 * 60 };
  let start = Math.max(
    0,
    Math.floor(Math.min(...valid.map((event) => minutes(event.time))) / 60) * 60,
  );
  let end = Math.min(
    1440,
    Math.ceil(
      Math.max(...valid.map((event) => minutes(event.time) + Number(event.duration))) / 60,
    ) * 60,
  );
  if (end - start < 360) {
    start = Math.max(0, start - Math.floor((360 - (end - start)) / 120) * 60);
    end = Math.min(1440, start + 360);
    start = Math.max(0, end - 360);
  }
  return { start, end };
}

// Fit is an overview of the entire time range, independent of role and fullscreen.
// Larger scales deliberately scroll inside the calendar and preserve readable tiles.
export function calendarGeometry(
  events: DemoRecord[],
  scale: string,
  availableHeight: number,
  weekly: boolean,
): { height: number; hourStep: number } {
  const { start, end } = calendarBounds(events);
  const viewport = Math.max(1, Math.floor(availableHeight));
  const shortest = Math.min(
    50,
    ...events
      .map((event) => Number(event.duration))
      .filter((duration) => Number.isFinite(duration) && duration > 0),
  );
  const comfortable = Math.max(viewport, ((end - start) / shortest) * (weekly ? 72 : 52));
  const titleHeight = events.length ? ((end - start) / shortest) * 16 : 0;
  const height =
    scale === 'Весь день'
      ? Math.max(viewport, titleHeight)
      : scale === 'Крупнее'
        ? comfortable * 1.5
        : comfortable;
  // Keep axis labels apart at overview scale without reducing their font size.
  const hourStep = Math.max(1, Math.ceil(26 / ((height * 60) / (end - start))));
  return { height, hourStep };
}

// Preserve every event, including overlapping examples, by assigning parallel lanes.
export function layoutEvents(events: DemoRecord[]): EventPlacement[] {
  const sorted = [...events].sort(
    (a, b) =>
      minutes(a.time) - minutes(b.time) ||
      Number(b.duration) - Number(a.duration) ||
      a.id.localeCompare(b.id),
  );
  const result: EventPlacement[] = [];
  let cluster: EventPlacement[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    cluster.forEach((item) => {
      item.lanes = laneEnds.length;
      result.push(item);
    });
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };
  for (const event of sorted) {
    const start = minutes(event.time);
    if (cluster.length && start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = start + Number(event.duration);
    clusterEnd = Math.max(clusterEnd, laneEnds[lane]);
    cluster.push({ event, lane, lanes: 1 });
  }
  flush();
  return result;
}

export function slotAt(
  pointerY: number,
  top: number,
  height: number,
  start: number,
  end: number,
  step: number,
  grabOffset = 0,
  duration = 0,
): string {
  const raw = start + ((pointerY - top) / height) * (end - start) - grabOffset;
  return clock(Math.max(0, Math.min(1440 - duration, Math.round(raw / step) * step)));
}

export function templateEvent(
  template: DemoRecord,
  seed: DemoRecord,
  rooms: DemoRecord[],
  fallbackTrainer: string,
): DemoRecord {
  const preferred = rooms.find(
    (room) => room.club === seed.club && room.name === template.room && room.status !== 'В архиве',
  );
  const contextRoom = rooms.find(
    (room) => room.club === seed.club && room.name === seed.room && room.status !== 'В архиве',
  );
  const room =
    (seed.keepRoom === 'true' ? contextRoom || preferred : preferred || contextRoom) ||
    rooms.find((room) => room.club === seed.club && room.status !== 'В архиве');
  const roomCapacity = Number(room?.capacity || 1);
  const capacity =
    template.capacityMode === 'Своя вместимость'
      ? Math.min(roomCapacity, Number(template.capacity) || roomCapacity)
      : roomCapacity;
  return {
    ...template,
    ...seed,
    templateId: template.id,
    name: template.name,
    duration: template.duration || '50',
    trainer: template.trainer || fallbackTrainer,
    room: room?.name || '',
    capacity: String(capacity),
    capacityMode: template.capacityMode || 'По залу',
    group: template.group || '',
    intensity: template.intensity || 'Средняя',
    color: trainingIntensity(template).color,
    format: template.format || 'Групповое',
    payment: template.payment || 'Включено в абонемент',
    booking: template.booking || 'Обычная запись',
    seats: template.seats || 'Не требуется',
    waitlist: template.waitlist || 'Выключен',
    minimum: template.minimum || '0',
    description: template.description || '',
  };
}

export function moveEvent(
  event: DemoRecord,
  target: ScheduleTarget,
  rooms: DemoRecord[],
): DemoRecord {
  const room = rooms.find((room) => room.name === target.room && room.club === target.club);
  const capacity =
    event.capacityMode === 'Своя вместимость'
      ? Math.min(Number(event.capacity), Number(room?.capacity || event.capacity))
      : Number(room?.capacity || event.capacity);
  return {
    ...event,
    ...target,
    capacity: String(capacity),
    status:
      event.kind === 'personal'
        ? event.status
        : isMovable(event)
          ? Number(event.booked) >= capacity
            ? 'Мест нет'
            : 'Запись открыта'
          : event.status,
  };
}

export function sameSlot(a: DemoRecord, b: DemoRecord): boolean {
  return a.day === b.day && a.time === b.time && a.room === b.room && a.club === b.club;
}

export function validateEvent(
  event: DemoRecord,
  events: DemoRecord[],
  rooms: DemoRecord[],
): string | null {
  const start = minutes(event.time);
  const duration = Number(event.duration);
  if (!event.name?.trim()) return 'Укажите название тренировки.';
  const date = new Date(`${event.day}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(event.day) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== event.day
  )
    return 'Выберите корректную дату.';
  if (!Number.isFinite(start)) return 'Укажите время в формате ЧЧ:ММ.';
  if (!Number.isInteger(duration) || duration < 5 || start + duration > 1440)
    return 'Длительность — от 5 минут, занятие должно завершиться в этот же день.';
  if (!event.trainer?.trim()) return 'Выберите тренера.';
  const room = rooms.find(
    (room) => room.club === event.club && room.name === event.room && room.status !== 'В архиве',
  );
  if (!room) return 'Выберите действующий зал выбранного клуба.';
  if (
    !Number.isInteger(Number(event.capacity)) ||
    Number(event.capacity) < 1 ||
    Number(event.capacity) > Number(room.capacity)
  )
    return `В зале «${room.name}» не больше ${room.capacity} мест.`;
  if (Number(event.booked || 0) > Number(event.capacity))
    return 'В новом зале недостаточно мест для уже записанных клиентов.';
  const minimum = Number(event.minimum || 0);
  if (!Number.isInteger(minimum) || minimum < 0 || minimum > Number(event.capacity))
    return 'Минимум участников не может быть больше вместимости занятия.';
  const conflicts = events.filter(
    (other) => other.id !== event.id && other.status !== 'Отменено' && overlaps(event, other),
  );
  const roomConflict = conflicts.find(
    (other) => other.club === event.club && other.room === event.room,
  );
  if (roomConflict)
    return `В зале уже есть «${roomConflict.name}», ${eventTime(roomConflict)}. Выберите другое время.`;
  const trainerConflict = conflicts.find((other) => other.trainer === event.trainer);
  if (trainerConflict)
    return `У тренера уже есть «${trainerConflict.name}», ${eventTime(trainerConflict)} (${trainerConflict.room}).`;
  const clientConflict =
    event.kind === 'personal' &&
    conflicts.find((other) => (other.attendees || '').split(',').includes(event.memberId));
  if (clientConflict)
    return `У клиента уже есть запись на «${clientConflict.name}», ${eventTime(clientConflict)}. Выберите другое время.`;
  return null;
}

export function nextFreeTime(
  events: DemoRecord[],
  day: string,
  club: string,
  room: string,
  duration: number,
  trainer?: string,
): string {
  for (let start = 7 * 60; start + duration <= 1440; start += 5) {
    const candidate = { id: '', day, time: clock(start), duration: String(duration) };
    if (
      !events.some(
        (other) =>
          other.status !== 'Отменено' &&
          overlaps(candidate, other) &&
          ((other.club === club && other.room === room) || (trainer && trainer === other.trainer)),
      )
    )
      return clock(start);
  }
  return '07:00';
}
