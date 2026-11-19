import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';
import { getClientProfile } from '../data/clientProfile';
import { addDays } from './schedule';
import { replaceRecord } from './reception-operations';

type ChangeKind = 'freeze' | 'unfreeze' | 'finish' | 'transfer';
export function changeMembership(
  current: Record<string, DemoRecord[]>,
  input: {
    member: Member;
    passId: string;
    kind: ChangeKind;
    target?: Member | null;
    until: string;
    reason: string;
    today: string;
    stamp: string;
    actionId: string;
    canOperate: boolean;
  },
): Record<string, DemoRecord[]> {
  const { member, kind, target, until, reason, today, stamp, actionId, canOperate } = input;
  const pass = getClientProfile(member, current).subscriptions.find(
    (row) => row.id === input.passId,
  );
  if (!pass || !canOperate || pass.status === 'expired')
    throw new Error('Операция недоступна для завершённого абонемента.');
  if (!reason.trim()) throw new Error('Укажите основание операции.');
  if ((current['membership-history'] || []).some((row) => row.id === actionId))
    throw new Error('Операция уже выполнена.');
  if (
    kind === 'freeze' &&
    (pass.status === 'paused' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(until) ||
      until <= today ||
      until > addDays(today, 90))
  )
    throw new Error('Выберите окончание заморозки в пределах следующих 90 дней.');
  if (kind === 'unfreeze' && pass.status !== 'paused') throw new Error('Абонемент не заморожен.');
  if (kind === 'transfer' && (!target || target.id === member.id || target.archived))
    throw new Error('Выберите другого действующего клиента.');
  const latest = (current['membership-overrides'] || []).find(
    (row) => row.id === `${member.id}:${pass.id}`,
  );
  if (latest?.transferredTo || latest?.status === 'expired')
    throw new Error('Абонемент уже изменён. Закройте окно и проверьте состояние.');
  const days =
    kind === 'freeze' ? Math.round((Date.parse(until) - Date.parse(today)) / 86400000) : 0;
  const actualDays = latest?.freezeStartedAt
    ? Math.max(0, Math.round((Date.parse(today) - Date.parse(latest.freezeStartedAt)) / 86400000))
    : 0;
  const freezeEnd = pass.endsAt
    ? addDays(pass.endsAt.split('.').reverse().join('-'), days).split('-').reverse().join('.')
    : '';
  const unfreezeEnd = latest?.originalEndsAt
    ? addDays(latest.originalEndsAt.split('.').reverse().join('-'), actualDays)
        .split('-')
        .reverse()
        .join('.')
    : pass.endsAt || '';
  let next = replaceRecord(current, 'membership-overrides', {
    ...latest,
    id: `${member.id}:${pass.id}`,
    memberId: String(member.id),
    passId: pass.id,
    status:
      kind === 'freeze'
        ? 'paused'
        : kind === 'unfreeze'
          ? pass.activatedAt
            ? 'active'
            : 'pending'
          : 'expired',
    ...(kind === 'finish' || kind === 'transfer' ? { remaining: '0' } : {}),
    ...(kind === 'freeze'
      ? {
          freezeStartedAt: today,
          originalEndsAt: pass.endsAt || '',
          freezeUntil: until,
          endsAt: freezeEnd,
        }
      : {}),
    ...(kind === 'unfreeze' ? { freezeUntil: '', freezeStartedAt: '', endsAt: unfreezeEnd } : {}),
    ...(kind === 'transfer' ? { transferredTo: String(target!.id) } : {}),
    reason: reason.trim(),
  });
  if (kind === 'transfer') {
    const id = `transferred:${actionId}`;
    next = replaceRecord(next, 'issued-plans', {
      id,
      name: pass.name,
      memberId: String(target!.id),
      kindId: pass.kindId || '',
      type: pass.remaining === null ? 'Безлимитный' : 'Посещения',
      visits: String(pass.remaining || 0),
      issued: today,
      duration: '30',
      training: pass.training || '',
      trainerId: pass.trainerId || '',
      trainerCategory: pass.trainerCategory || '',
      accessWeekdays: pass.accessWeekdays || '',
      accessWeekends: pass.accessWeekends || '',
      ageMin: pass.ageMin || '',
      ageMax: pass.ageMax || '',
      transferFrom: pass.id,
    });
    next = replaceRecord(next, 'pass-usage', {
      id: `${target!.id}:${id}`,
      memberId: String(target!.id),
      passId: id,
      used: '0',
      remaining: pass.remaining === null ? 'unlimited' : String(pass.remaining),
      activatedAt: pass.activatedAt || '',
      endsAt: pass.endsAt || '',
    });
    if (pass.status === 'paused')
      next = replaceRecord(next, 'membership-overrides', {
        id: `${target!.id}:${id}`,
        memberId: String(target!.id),
        passId: id,
        status: 'paused',
        endsAt: pass.endsAt || '',
        freezeStartedAt: latest?.freezeStartedAt || today,
        originalEndsAt: latest?.originalEndsAt || pass.endsAt || '',
        freezeUntil: latest?.freezeUntil || '',
      });
    if (pass.kindId === 'personal' && pass.trainerId)
      next = replaceRecord(next, 'personal-clients', {
        id: `${pass.trainerId}:${target!.id}`,
        trainerId: pass.trainerId,
        memberId: String(target!.id),
        goal: '',
      });
  }
  return replaceRecord(next, 'membership-history', {
    id: actionId,
    memberId: String(member.id),
    passId: pass.id,
    date: stamp,
    name: {
      freeze: 'Заморозка',
      unfreeze: 'Разморозка',
      finish: 'Списание абонемента',
      transfer: 'Передача другому клиенту',
    }[kind],
    comment: reason.trim(),
    targetId: target ? String(target.id) : '',
  });
}
