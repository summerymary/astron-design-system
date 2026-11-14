import { getClientProfile } from '../data/clientProfile';
import { membershipKinds } from '../data/membership-kinds';
import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';
import { personalBooking, personalTrainers } from './personal-training';
import { ageOnDate, registrationBookings, usePass } from './registration';
import { changeAttendance, rosterIds } from './schedule-attendance';

export type TrainingVisitRequest = {
  member: Member;
  eventId: string;
  passId: string;
  at: string;
  acknowledged?: boolean;
};

/** One immutable transaction shared by registration and the class roster. */
export function trainingVisit(data: Record<string, DemoRecord[]>, request: TrainingVisitRequest) {
  const { member, eventId, passId, at, acknowledged = false } = request;
  const source = data.events.find((row) => row.id === eventId);
  if (!source || member.archived) throw new Error('Клиент или занятие недоступны.');
  const event = personalBooking(source, data);
  if (
    event.kind === 'personal' &&
    !personalTrainers(data).some((row) => row.id === event.trainerId)
  )
    throw new Error('Персональный тренер больше недоступен. Проверьте запись.');
  if (
    (data['visit-bookings'] || []).some(
      (row) => row.memberId === String(member.id) && row.eventId === eventId,
    ) ||
    rosterIds(event.present).includes(String(member.id))
  )
    throw new Error('Посещение этого занятия уже отмечено. Повторного списания нет.');
  if (!registrationBookings([event], member.id, event.club, at).length)
    throw new Error(
      'Отметить посещение можно за 60 минут до начала и 30 минут после начала занятия.',
    );
  const profile = getClientProfile(member, data);
  const pass = profile.subscriptions.find((row) => row.id === passId);
  if (!pass) throw new Error('Выберите подходящий абонемент.');
  const trainerVerified =
    event.kind === 'personal' &&
    (data.employees || []).some(
      (row) =>
        row.name === event.trainer &&
        row.status === 'Активен' &&
        row.position?.toLocaleLowerCase('ru').includes('тренер'),
    );
  const issued = (data['issued-plans'] || []).find((row) => row.id === passId);
  const kind = membershipKinds.find((row) => row.id === pass.kindId);
  const usage = usePass(
    member,
    pass,
    Number(issued?.duration || kind?.duration || 30),
    at.slice(0, 10),
    at.slice(11, 16),
    event,
    { trainerVerified, acknowledged },
  );
  const updated = changeAttendance(event, member, 'present', data.events);
  if (typeof updated === 'string') throw new Error(updated);
  const receipt = {
    id: `${member.id}:${eventId}`,
    memberId: String(member.id),
    eventId,
    passId,
    passName: pass.name,
    date: at,
  };
  const upsert = (rows: DemoRecord[] = [], record: DemoRecord) =>
    rows.some((row) => row.id === record.id)
      ? rows.map((row) => (row.id === record.id ? record : row))
      : [...rows, record];
  return {
    data: {
      ...data,
      events: upsert(data.events, updated),
      'pass-usage': upsert(data['pass-usage'], usage),
      'visit-bookings': upsert(data['visit-bookings'], receipt),
      ...(ageOnDate(profile.birthDate, at.slice(0, 10))! < 14
        ? {
            'visit-supervision': upsert(data['visit-supervision'], {
              id: receipt.id,
              memberId: String(member.id),
              date: at,
              type: trainerVerified ? 'Запись к тренеру' : 'Подтверждение администратора',
              trainer: trainerVerified ? event.trainer : '',
              acknowledged: String(acknowledged),
            }),
          }
        : {}),
    },
    pass,
    event,
    receipt,
  };
}
