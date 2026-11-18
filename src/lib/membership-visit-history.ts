import type { DemoRecord } from '../data/workspace';
import type { Member, Visit } from '../types';
import { getClientProfile } from '../data/clientProfile';
import { replaceRecord } from './reception-operations';

export function membershipVisits(
  member: Member,
  passId: string,
  visits: Visit[],
  data: Record<string, DemoRecord[]>,
) {
  const passes = getClientProfile(member, data).subscriptions;
  const pass = passes.find((p) => p.id === passId);
  if (!pass) return [];
  return visits
    .filter(
      (v) =>
        v.memberId === member.id &&
        (v.passId
          ? v.passId === passId
          : v.plan === pass.name && passes.filter((p) => p.name === v.plan).length === 1),
    )
    .sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));
}

/** Reverses one known debit and attendance together, retaining an audit record. */
export function cancelMembershipVisit(
  data: Record<string, DemoRecord[]>,
  input: {
    member: Member;
    passId: string;
    visit: Visit;
    visits: Visit[];
    reason: string;
    stamp: string;
    canOperate: boolean;
  },
) {
  const { member, passId, visit, visits, reason, stamp, canOperate } = input;
  const pass = getClientProfile(member, data).subscriptions.find((p) => p.id === passId);
  if (!canOperate || !pass || member.archived) throw new Error('Отмена посещения недоступна.');
  if (!reason.trim()) throw new Error('Укажите причину отмены.');
  if (
    !membershipVisits(member, passId, visits, data).some(
      (v) => v.id === visit.id && v.enteredAt === visit.enteredAt,
    )
  )
    throw new Error('Посещение не относится к этому абонементу.');
  const auditId = `cancel:${visit.id}:${visit.enteredAt}`;
  if ((data['membership-history'] || []).some((r) => r.id === auditId))
    throw new Error('Посещение уже отменено.');
  const override = (data['membership-overrides'] || []).find(
    (r) => r.memberId === String(member.id) && r.passId === passId,
  );
  if (override?.transferredTo || override?.status === 'expired' || pass.used < 1)
    throw new Error('Остаток абонемента изменён. Отмена требует проверки управляющим.');
  const receipts = (data['visit-bookings'] || []).filter(
    (r) => r.memberId === String(member.id) && r.passId === passId && r.date === visit.enteredAt,
  );
  let next = replaceRecord(data, 'pass-usage', {
    id: `${member.id}:${passId}`,
    memberId: String(member.id),
    passId,
    used: String(pass.used - 1),
    remaining: pass.remaining === null ? 'unlimited' : String(pass.remaining + 1),
    activatedAt: pass.activatedAt || '',
    endsAt: pass.endsAt || '',
  });
  next = {
    ...next,
    'visit-bookings': (data['visit-bookings'] || []).filter(
      (r) => !receipts.some((receipt) => receipt.id === r.id),
    ),
    events: (data.events || []).map((e) =>
      receipts.some((r) => r.eventId === e.id)
        ? {
            ...e,
            present: (e.present || '')
              .split(',')
              .filter((id) => id !== String(member.id))
              .join(','),
          }
        : e,
    ),
  };
  return replaceRecord(next, 'membership-history', {
    id: auditId,
    passId,
    memberId: String(member.id),
    visitId: visit.id,
    date: stamp,
    name: 'Отмена посещения',
    comment: reason.trim(),
  });
}
