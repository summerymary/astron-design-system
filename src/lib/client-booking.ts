import type { DemoRecord } from '../data/workspace';
import type { DemoUser, Member } from '../types';
import { addDays, clock, minutes, validateEvent } from './schedule';
import { personalScopeError } from './staff-rules';
import { clientTrainers, personalTrainers } from './personal-training';

export function nearestGroupEvents(
  data: Record<string, DemoRecord[]>,
  club: string,
  at: string,
): DemoRecord[] {
  const day = at.slice(0, 10),
    now = minutes(at.slice(11, 16));
  return data.events
    .filter(
      (event) =>
        event.kind !== 'personal' &&
        event.club === club &&
        !['Отменено', 'Завершено'].includes(event.status) &&
        event.day >= day &&
        event.day <= addDays(day, 7) &&
        (event.day !== day ||
          (minutes(event.time) >= now - 30 && minutes(event.time) + Number(event.duration) > now)),
    )
    .sort((a, b) => `${a.day}T${a.time}`.localeCompare(`${b.day}T${b.time}`));
}

/** Search the entire eligible result set before any display limit. */
export function filterBookingEvents(events: DemoRecord[], query: string): DemoRecord[] {
  const normalize = (text: string) => text.toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return events.filter((event) => {
    const text = normalize(
      `${event.name} ${event.trainer} ${event.room} ${event.day} ${event.day.split('-').reverse().join('.')} ${event.time}`,
    );
    return words.every((word) => text.includes(word));
  });
}

export function createPersonalBooking(
  data: Record<string, DemoRecord[]>,
  user: DemoUser,
  member: Member,
  input: { id: string; trainerId: string; club: string; day: string; time: string; room: string },
  at: string,
): { event: DemoRecord; assignment?: DemoRecord } | string {
  if (member.archived) return 'Клиент находится в архиве.';
  if (data.events.some((event) => event.id === input.id)) return 'Эта запись уже создана.';
  const trainer = personalTrainers(data).find(
    (trainer) => trainer.id === input.trainerId && trainer.club === input.club,
  );
  if (!trainer) return 'Выберите действующего тренера выбранного клуба.';
  const assigned = clientTrainers(data, member.id);
  if (assigned.length && !assigned.some((row) => row.id === trainer.id))
    return 'Выберите тренера, за которым закреплён клиент.';
  if (`${input.day}T${input.time}` < at.slice(0, 16))
    return 'Нельзя записать персональную тренировку в прошедшее время.';
  if (minutes(input.time) < 360 || minutes(input.time) + 50 > 1390)
    return 'Выберите время с 06:00 до 22:20: тренировка длится 50 минут.';
  const assignment = assigned.some((row) => row.id === trainer.id)
    ? undefined
    : {
        id: `${trainer.id}:${member.id}`,
        trainerId: trainer.id,
        memberId: String(member.id),
        goal: '',
      };
  const event: DemoRecord = {
    ...input,
    kind: 'personal',
    name: 'Персональная тренировка',
    trainer: trainer.name,
    trainerCategory: trainer.categoryId,
    memberId: String(member.id),
    attendees: String(member.id),
    present: '',
    reserve: '',
    duration: '50',
    capacity: '1',
    booked: '1',
    capacityMode: 'Своя вместимость',
    format: 'Персональное',
    intensity: 'Средняя',
    status: 'Запланирована',
    description: '',
  };
  const problem =
    personalScopeError(event, user, [
      ...(data['personal-clients'] || []),
      ...(assignment ? [assignment] : []),
    ]) || validateEvent(event, data.events, data.rooms);
  return problem || { event, assignment };
}

export function personalBookingSlots(
  data: Record<string, DemoRecord[]>,
  user: DemoUser,
  member: Member,
  trainerId: string,
  club: string,
  day: string,
  room: string,
  at: string,
): string[] {
  const result: string[] = [];
  const start = day === at.slice(0, 10) ? Math.ceil(minutes(at.slice(11, 16)) / 5) * 5 : 360;
  for (let minute = start; minute <= 1340 && result.length < 6; minute += 15) {
    const time = clock(minute);
    if (
      typeof createPersonalBooking(
        data,
        user,
        member,
        { id: 'preview-personal-slot', trainerId, club, day, time, room },
        at,
      ) !== 'string'
    )
      result.push(time);
  }
  return result;
}

export type PersonalBookingSlot = { day: string; time: string; room: string };

export function personalSlotProblem(
  data: Record<string, DemoRecord[]>,
  trainerId: string,
  club: string,
  slot: PersonalBookingSlot,
): string | null {
  const start = minutes(slot.time),
    end = start + 50;
  if (
    !(data['trainer-availability'] || []).some(
      (window) =>
        window.trainerId === trainerId &&
        window.club === club &&
        window.day === slot.day &&
        minutes(window.time) <= start &&
        minutes(window.end) >= end,
    )
  )
    return 'Рабочее время тренера для этого слота не подтверждено.';
  if (
    (data['trainer-duty'] || []).some(
      (duty) =>
        duty.trainerId === trainerId &&
        duty.day === slot.day &&
        minutes(duty.time) < end &&
        start < minutes(duty.time) + Number(duty.duration),
    )
  )
    return 'Тренер занят дежурством. Выберите другой слот.';
  return null;
}

/** Availability is explicit: missing working hours never imply an empty calendar is free. */
export function nearestPersonalBookingSlots(
  data: Record<string, DemoRecord[]>,
  user: DemoUser,
  member: Member,
  trainerId: string,
  club: string,
  at: string,
): PersonalBookingSlot[] {
  const rooms = (data.rooms || [])
    .filter((row) => row.club === club && row.status !== 'В архиве')
    .sort(
      (a, b) =>
        Number(b.name === 'Зал персональных тренировок') -
        Number(a.name === 'Зал персональных тренировок'),
    );
  const windows = (data['trainer-availability'] || []).filter(
    (row) =>
      row.trainerId === trainerId &&
      row.club === club &&
      row.day >= at.slice(0, 10) &&
      row.day <= addDays(at.slice(0, 10), 6),
  );
  const result = new Map<string, PersonalBookingSlot>();
  for (const window of windows) {
    const from = Math.max(
      360,
      minutes(window.time),
      window.day === at.slice(0, 10) ? minutes(at.slice(11)) : 0,
    );
    for (
      let start = Math.ceil(from / 15) * 15;
      start + 50 <= Math.min(1390, minutes(window.end));
      start += 15
    ) {
      const key = `${window.day}T${clock(start)}`;
      if (result.has(key)) continue;
      for (const room of rooms) {
        const slot = { day: window.day, time: clock(start), room: room.name };
        if (
          !personalSlotProblem(data, trainerId, club, slot) &&
          typeof createPersonalBooking(
            data,
            user,
            member,
            { id: 'preview-personal-slot', trainerId, club, ...slot },
            at,
          ) !== 'string'
        ) {
          result.set(key, slot);
          break;
        }
      }
    }
  }
  return [...result.values()].sort((a, b) =>
    `${a.day}T${a.time}`.localeCompare(`${b.day}T${b.time}`),
  );
}

/** Recheck the latest schedule at click time and commit booking + assignment atomically. */
export function bookPersonalSlot(
  data: Record<string, DemoRecord[]>,
  user: DemoUser,
  member: Member,
  input: PersonalBookingSlot & { id: string; trainerId: string; club: string },
  at: string,
) {
  const problem = personalSlotProblem(data, input.trainerId, input.club, input);
  if (problem) throw new Error(problem);
  const result = createPersonalBooking(data, user, member, input, at);
  if (typeof result === 'string') throw new Error(result);
  return {
    event: result.event,
    data: {
      ...data,
      events: [...data.events, result.event],
      'personal-clients': result.assignment
        ? [...(data['personal-clients'] || []), result.assignment]
        : data['personal-clients'] || [],
    },
  };
}
