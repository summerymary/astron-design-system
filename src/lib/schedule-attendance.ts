import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';

export const rosterIds = (value = '') => [...new Set(value.split(',').filter(Boolean))];
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
    ...(event.kind === 'personal' ? { memberId: attendees[0] || '' } : {}),
    status:
      event.status === 'Завершено' || event.kind === 'personal'
        ? event.status
        : attendees.length >= Number(event.capacity)
          ? 'Мест нет'
          : 'Запись открыта',
  };
}
