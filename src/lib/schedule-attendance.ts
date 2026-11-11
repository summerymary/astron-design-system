import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';

export const rosterIds = (value = '') => [...new Set(value.split(',').filter(Boolean))];
export function changeReserve(
  event: DemoRecord,
  member: Member,
  action: 'join' | 'leave',
): DemoRecord | string {
  if (['Отменено', 'Завершено'].includes(event.status)) return 'Резерв для этого занятия закрыт.';
  const id = String(member.id),
    reserve = rosterIds(event.reserve);
  if (action === 'leave')
    return { ...event, reserve: reserve.filter((value) => value !== id).join(',') };
  if (member.archived) return 'Клиент находится в архиве.';
  if (rosterIds(event.attendees).includes(id)) return 'Клиент уже записан на занятие.';
  if (reserve.includes(id)) return 'Клиент уже находится в резерве.';
  if (rosterIds(event.attendees).length < Number(event.capacity))
    return 'Есть свободные места — запишите клиента в основной список.';
  return { ...event, reserve: [...reserve, id].join(',') };
}
export function reserveSeatNotification(
  before: DemoRecord | undefined,
  after: DemoRecord,
  sequence: number,
): DemoRecord | null {
  if (
    !before ||
    ['Отменено', 'Завершено'].includes(after.status) ||
    !rosterIds(after.reserve).length
  )
    return null;
  const free = (event: DemoRecord) =>
    Math.max(0, Number(event.capacity) - rosterIds(event.attendees).length);
  if (!(free(after) > free(before))) return null;
  return {
    id: `reserve-seat-${after.id}-${sequence}`,
    name: 'Освободилось место — есть резерв',
    type: 'Резерв',
    status: 'Новое',
    unread: 'true',
    important: 'true',
    section: 'schedule',
    eventId: after.id,
    club: after.club,
    time: `${after.day} · ${after.time}`,
    text: `${after.name} · ${after.day} в ${after.time} · ${after.club}. Свободно мест: ${free(after)}. В резерве: ${rosterIds(after.reserve).length}.`,
  };
}
export function changeAttendance(
  event: DemoRecord,
  member: Member,
  action: 'book' | 'remove' | 'present' | 'absent',
  events: DemoRecord[] = [],
): DemoRecord | string {
  if (event.status === 'Отменено') return 'Занятие отменено. Запись и отметки недоступны.';
  let attendees = rosterIds(event.attendees);
  let present = rosterIds(event.present);
  const id = String(member.id);
  if (action === 'book') {
    if (event.status === 'Завершено') return 'Занятие уже завершено.';
    if (member.archived) return 'Клиент находится в архиве.';
    if (attendees.includes(id)) return 'Клиент уже записан на это занятие.';
    if (attendees.length >= Number(event.capacity)) return 'Свободных мест нет.';
    const minute = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    const collision = events.find(
      (other) =>
        other.id !== event.id &&
        other.day === event.day &&
        other.status !== 'Отменено' &&
        rosterIds(other.attendees).includes(id) &&
        minute(other.time) < minute(event.time) + Number(event.duration) &&
        minute(event.time) < minute(other.time) + Number(other.duration),
    );
    if (collision)
      return `Клиент уже записан на «${collision.name}» в ${collision.time}, ${collision.club}. Выберите другое время.`;
    attendees = [...attendees, id];
  } else {
    if (!attendees.includes(id)) return 'Клиент не записан на занятие.';
    if (action === 'remove') {
      attendees = attendees.filter((value) => value !== id);
      present = present.filter((value) => value !== id);
    } else if (action === 'present') present = [...new Set([...present, id])];
    else present = present.filter((value) => value !== id);
  }
  return {
    ...event,
    attendees: attendees.join(','),
    booked: String(attendees.length),
    present: present.join(','),
    reserve: rosterIds(event.reserve)
      .filter((value) => !attendees.includes(value))
      .join(','),
    ...(event.kind === 'personal' ? { memberId: attendees[0] || '' } : {}),
    status:
      event.status === 'Завершено' || event.kind === 'personal'
        ? event.status
        : attendees.length >= Number(event.capacity)
          ? 'Мест нет'
          : 'Запись открыта',
  };
}
