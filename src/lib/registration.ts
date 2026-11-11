import { getClientProfile } from '../data/clientProfile';
import type { DemoSubscription } from '../data/clientProfile';
import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';
import { accessWindowError, parseAccessHours } from './workspace-rules';
import { demoStamp, registrationNow } from './demo-clock';

export function accessWindowLabel(
  pass: Pick<DemoSubscription, 'accessWeekdays' | 'accessWeekends'> | DemoRecord,
): string {
  return pass.accessWeekdays || pass.accessWeekends
    ? `Пн–Пт ${pass.accessWeekdays || 'нет'}; Сб–Вс ${pass.accessWeekends || 'нет'}`
    : '';
}
export function ageOnDate(birthDate: string, day: string): number | null {
  const birth = /^\d{2}\.\d{2}\.\d{4}$/.test(birthDate)
    ? birthDate.split('.').reverse().join('-')
    : birthDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${birth}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== birth || birth > day)
    return null;
  return (
    Number(day.slice(0, 4)) - Number(birth.slice(0, 4)) - (day.slice(5) < birth.slice(5) ? 1 : 0)
  );
}
export function passUnavailable(
  pass: DemoSubscription,
  at = demoStamp(registrationNow()),
  birthDate = '',
): string | null {
  if (pass.status === 'paused') return 'Абонемент заморожен';
  if (pass.status === 'expired' || pass.remaining === 0) return 'Абонемент завершён';
  if (!pass.kindId) return 'Дополнительная услуга — не абонемент для прохода';
  if (pass.ageMin || pass.ageMax) {
    const age = ageOnDate(birthDate, at.split('T')[0]);
    if (age === null) return 'Укажите корректную дату рождения клиента';
    if (
      !pass.ageMin ||
      !pass.ageMax ||
      !Number.isInteger(Number(pass.ageMin)) ||
      !Number.isInteger(Number(pass.ageMax)) ||
      Number(pass.ageMin) > Number(pass.ageMax) ||
      Number(pass.ageMin) < 0 ||
      Number(pass.ageMax) > 120
    )
      return 'Проверьте возрастные условия тарифа';
    if (age < Number(pass.ageMin) || age > Number(pass.ageMax))
      return `Доступ только в возрасте ${pass.ageMin}–${pass.ageMax} лет`;
  }
  if (accessWindowError(pass)) return 'Проверьте настройку часов доступа';
  if (pass.accessWeekdays || pass.accessWeekends) {
    const [day, time] = at.split('T');
    const date = new Date(`${day}T12:00:00Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== day ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')
    )
      return 'Не удалось определить время посещения';
    const weekend = [0, 6].includes(date.getUTCDay());
    const hours = (weekend ? pass.accessWeekends : pass.accessWeekdays)!;
    if (!parseAccessHours(hours)!.some(([start, end]) => time >= start && time < end))
      return `Доступ ${weekend ? 'в выходные' : 'по будням'}: ${hours}`;
  }
  return null;
}

// Arrival window is a prototype default awaiting club confirmation.
export const BOOKING_ARRIVAL_MINUTES = 60;
export const BOOKING_LATE_MINUTES = 30;
const timeMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};
export function registrationBookings(
  events: DemoRecord[],
  memberId: number,
  club: string,
  at: string,
  leadMinutes = BOOKING_ARRIVAL_MINUTES,
): DemoRecord[] {
  const [day, time] = at.split('T');
  const now = timeMinutes(time || '');
  return events
    .filter(
      (event) =>
        event.club === club &&
        event.day === day &&
        !['Отменено', 'Завершено'].includes(event.status) &&
        (event.attendees || '').split(',').includes(String(memberId)) &&
        now >= timeMinutes(event.time) - leadMinutes &&
        now <= timeMinutes(event.time) + BOOKING_LATE_MINUTES &&
        now < timeMinutes(event.time) + Number(event.duration),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
}
export function bookingPassProblem(pass: DemoSubscription, event?: DemoRecord): string | null {
  if (!event) return null;
  const kind = event.kind === 'personal' ? 'personal' : 'group';
  const training = pass.training?.toLocaleLowerCase('ru');
  const matches = training
    ? training.includes(kind === 'personal' ? 'персональ' : 'группов')
    : pass.kindId === kind;
  return matches
    ? null
    : kind === 'personal'
      ? 'Для этой записи нужен абонемент на персональные тренировки'
      : 'Для этой записи нужен абонемент на групповые занятия';
}
export function recommendedPassIds(
  passes: DemoSubscription[],
  event: DemoRecord | undefined,
  at: string,
  birthDate = '',
): string[] {
  return event
    ? passes
        .filter((pass) => !passUnavailable(pass, at, birthDate) && !bookingPassProblem(pass, event))
        .map((pass) => pass.id)
    : [];
}

export function minorVisitProblem(
  birthDate: string,
  day: string,
  supervision: { acknowledged?: boolean; trainerVerified?: boolean } = {},
): string | null {
  const age = ageOnDate(birthDate, day);
  if (age === null) return 'Укажите дату рождения клиента, чтобы проверить условия посещения.';
  if (age < 14 && !supervision.trainerVerified && !supervision.acknowledged)
    return 'Клиенту нет 14 лет. Заниматься можно только с тренером или ответственным взрослым.';
  return null;
}

export function usePass(
  member: Member,
  pass: DemoSubscription,
  duration: number,
  today: string,
  time = demoStamp(registrationNow()).slice(11, 16),
  event?: DemoRecord,
  supervision: { acknowledged?: boolean; trainerVerified?: boolean } = {},
): DemoRecord {
  const problem =
    passUnavailable(pass, `${today}T${time}`, getClientProfile(member).birthDate) ||
    bookingPassProblem(pass, event) ||
    minorVisitProblem(getClientProfile(member).birthDate, today, {
      ...supervision,
      trainerVerified:
        !!event && event.kind === 'personal' && !!event.trainer && supervision.trainerVerified,
    });
  if (problem) throw new Error(problem);
  const activatedAt = pass.activatedAt || today.split('-').reverse().join('.');
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + Math.max(0, duration - 1));
  return {
    id: `${member.id}:${pass.id}`,
    memberId: String(member.id),
    passId: pass.id,
    used: String(pass.used + 1),
    remaining: pass.remaining === null ? 'unlimited' : String(pass.remaining - 1),
    activatedAt,
    endsAt: pass.endsAt || end.toISOString().slice(0, 10).split('-').reverse().join('.'),
  };
}
