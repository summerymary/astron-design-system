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
