import type { DemoRecord } from '../data/workspace';
import type { Member, DemoUser } from '../types';
import { getClientProfile } from '../data/clientProfile';
import { financeCents } from './client-finance';
import { paidOperation, replaceRecord } from './reception-operations';
import type { ReceptionPayment } from './reception-operations';
import { personalTrainers } from './personal-training';
import { supportsTraining } from './training-kind';
import { ageOnDate } from './registration';
import { isManagementRole } from './staff-rules';

type Data = Record<string, DemoRecord[]>;
export const reissueModes = [
  { id: 'visits', label: 'По посещениям' },
  { id: 'days', label: 'По дням' },
  { id: 'single', label: 'По разовой цене' },
  { id: 'manual', label: 'Вручную' },
] as const;
export type ReissueMode = (typeof reissueModes)[number]['id'];
export type ReissueInput = {
  passId: string;
  planId: string;
  mode: ReissueMode;
  today: string;
  purchasePrice: string;
  singlePrice: string;
  manualCredit: string;
  trainerId: string;
};
const day = (value: string | null) => {
  const date = (value || '').split(/[T ]/)[0];
  const iso = /^\d{2}\.\d{2}\.\d{4}$/.test(date) ? date.split('.').reverse().join('-') : date;
  const timestamp = Date.parse(iso + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === iso
    ? iso
    : null;
};
export function membershipPurchasePrice(data: Data, memberId: number, passId: string) {
  const issued = (data['issued-plans'] || []).find(
    (row) => row.id === passId && row.memberId === String(memberId),
  );
  if (issued?.purchasePrice !== undefined && issued.purchasePrice !== '')
    return { cents: financeCents(issued.purchasePrice), origin: 'Цена покупки' };
  const rows = (data['report-pass-values'] || []).filter(
    (row) => row.passId === passId && row.memberId === String(memberId),
  );
  return rows.length === 1 && rows[0].price !== undefined && rows[0].price !== ''
    ? { cents: financeCents(rows[0].price), origin: 'Сохранённая демо-цена покупки' }
    : { cents: null, origin: 'Цена покупки не сохранена' };
}
export function quoteMembershipReissue(data: Data, member: Member, input: ReissueInput) {
  if (member.archived) throw new Error('Клиент находится в архиве.');
  if (!day(input.today)) throw new Error('Не удалось определить дату расчёта.');
  const pass = getClientProfile(member, data).subscriptions.find(
    (row) => row.id === input.passId && row.kindId,
  );
  if (
    !pass ||
    pass.status === 'expired' ||
    pass.remaining === 0 ||
    (day(pass.endsAt) && day(pass.endsAt)! < input.today)
  )
    throw new Error('Выберите незавершённый абонемент этого клиента.');
  const issued = (data['issued-plans'] || []).find(
    (row) => row.id === pass.id && row.memberId === String(member.id),
  );
  const debts = (data.receivables || []).filter((row) => row.saleId === issued?.saleId);
  const sale = (data.ledger || []).find((row) => row.id === issued?.saleId);
  if (
    issued?.saleId &&
    (debts.some((row) => row.status !== 'Погашено' && Number(row.amount) > 0) ||
      (!debts.length && Number(sale?.creditAmount || 0) > 0))
  )
    throw new Error('Сначала погасите задолженность по исходному абонементу.');
  const plan = (data.plans || []).find(
    (row) => row.id === input.planId && row.status === 'Опубликован',
  );
  if (!plan) throw new Error('Выберите опубликованный новый абонемент.');
  const personal = supportsTraining({ training: plan.training, kindId: plan.kindId }, 'personal');
  const trainer = personal
    ? personalTrainers(data).find((row) => row.id === input.trainerId)
    : undefined;
  if (personal && (!trainer || trainer.categoryId !== plan.trainerCategory))
    throw new Error('Выберите активного тренера соответствующей категории.');
  if (
    !Number.isInteger(Number(plan.duration)) ||
    Number(plan.duration) <= 0 ||
    (plan.type !== 'Безлимитный' &&
      (!Number.isInteger(Number(plan.visits)) || Number(plan.visits) <= 0))
  )
    throw new Error('Проверьте срок и количество посещений нового тарифа.');
  if (plan.ageMin || plan.ageMax) {
    const age = ageOnDate(getClientProfile(member, data).birthDate, input.today);
    if (
      age === null ||
      !plan.ageMin ||
      !plan.ageMax ||
      age < Number(plan.ageMin) ||
      age > Number(plan.ageMax)
    )
      throw new Error('Новый тариф не соответствует возрастным условиям клиента.');
  }
  const known = membershipPurchasePrice(data, member.id, pass.id);
  const purchase = known.cents ?? financeCents(input.purchasePrice);
  const price = financeCents(plan.price);
  let credit: number;
  let explanation: string;
  const rubles = (cents: number) => (cents / 100).toLocaleString('ru-RU') + ' ₽';
  if (input.mode === 'visits') {
    if (
      pass.remaining === null ||
      !Number.isInteger(pass.used) ||
      pass.used < 0 ||
      !Number.isInteger(pass.remaining) ||
      pass.remaining < 0
    )
      throw new Error('Для этого абонемента нет количественного остатка. Выберите другой способ.');
    const total = pass.used + pass.remaining;
    if (!total) throw new Error('Исходное число посещений неизвестно.');
    credit = Math.round((purchase * pass.remaining) / total);
    explanation = `${rubles(purchase)} × ${pass.remaining} / ${total} посещений = ${rubles(credit)}`;
  } else if (input.mode === 'days') {
    if (
      pass.status === 'paused' ||
      (data['membership-history'] || []).some(
        (row) =>
          row.memberId === String(member.id) &&
          row.passId === pass.id &&
          ['Заморозка', 'Разморозка'].includes(row.name),
      )
    )
      throw new Error(
        'После заморозок календарный расчёт неоднозначен. Используйте посещения, разовую цену или ручной расчёт.',
      );
    if (!pass.activatedAt) {
      credit = purchase;
      explanation = `Не активирован: к зачёту полная цена ${rubles(credit)}`;
    } else {
      const start = day(pass.activatedAt),
        end = day(pass.endsAt);
      if (!start || !end || end < start)
        throw new Error('Для расчёта по дням нужны корректные даты активации и окончания.');
      const total = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
      const remaining = Math.max(
        0,
        Math.min(total, Math.round((Date.parse(end) - Date.parse(input.today)) / 86400000) + 1),
      );
      credit = Math.round((purchase * remaining) / total);
      explanation = `${rubles(purchase)} × ${remaining} / ${total} календарных дней = ${rubles(credit)}. Сегодня и день окончания включены.`;
    }
  } else if (input.mode === 'single') {
    if (!Number.isInteger(pass.used) || pass.used < 0)
      throw new Error('Число использованных посещений неизвестно.');
    const single = financeCents(input.singlePrice);
    credit = Math.max(0, purchase - pass.used * single);
    explanation = `${rubles(purchase)} − ${pass.used} × ${rubles(single)} = ${rubles(credit)} к зачёту (не меньше нуля)`;
  } else if (input.mode === 'manual') {
    credit = financeCents(input.manualCredit);
    if (credit > purchase) throw new Error('Сумма к зачёту не может превышать цену покупки.');
    explanation = `Сумма к зачёту указана вручную: ${rubles(credit)}. Основание обязательно.`;
  } else throw new Error('Выберите способ перерасчёта.');
  const applied = Math.min(credit, price),
    due = price - applied,
    balanceCredit = credit - applied;
  const signature = JSON.stringify([
    pass,
    purchase,
    plan,
    trainer?.id || '',
    input.mode,
    input.singlePrice,
    input.manualCredit,
    credit,
    due,
  ]);
  return {
    pass,
    plan,
    trainer,
    purchase,
    price,
    credit,
    applied,
    due,
    balanceCredit,
    explanation,
    signature,
    priceOrigin: known.cents === null ? 'Указана сотрудником' : known.origin,
  };
}
export function reissueMembership(
  data: Data,
  member: Member,
  input: ReissueInput & {
    id: string;
    stamp: string;
    reason: string;
    club: string;
    expected: string;
    payment: ReceptionPayment;
  },
  user: DemoUser,
  canOperate: boolean,
): Data {
  if (!canOperate || !(user.role === 'administrator' || isManagementRole(user.role)))
    throw new Error('Переоформление недоступно в этой роли.');
  if (!input.reason.trim()) throw new Error('Укажите основание переоформления.');
  if ((data['membership-reissues'] || []).some((row) => row.id === input.id))
    throw new Error('Переоформление уже выполнено.');
  const club = (data.clubs || []).find((row) => row.name === input.club || row.id === input.club);
  if (!club || !user.clubIds.includes(club.id)) throw new Error('Выберите доступный рабочий клуб.');
  const quote = quoteMembershipReissue(data, member, input);
  if (quote.signature !== input.expected)
    throw new Error('Данные изменились. Рассчитайте переоформление заново.');
  const memberId = String(member.id),
    newId = `reissued:${input.id}`;
  let next = data;
  if (quote.due > 0)
    next = paidOperation(
      next,
      {
        id: input.id,
        operationId: input.id,
        kind: 'membership-reissue',
        category: 'Абонементы',
        memberId,
        client: member.fullName || member.name,
        name: `Доплата: ${quote.pass.name} → ${quote.plan.name}`,
        date: input.stamp.slice(0, 10),
        time: input.stamp.slice(11),
        club: club.name,
        cashier: user.name,
        sourcePassId: quote.pass.id,
        newPassId: newId,
      },
      quote.due / 100,
      { ...input.payment, memberId, client: member.fullName || member.name },
    );
  const oldOverride = (next['membership-overrides'] || []).find(
    (row) => row.id === `${member.id}:${quote.pass.id}`,
  );
  next = replaceRecord(next, 'membership-overrides', {
    ...oldOverride,
    id: `${member.id}:${quote.pass.id}`,
    memberId,
    passId: quote.pass.id,
    status: 'expired',
    remaining: '0',
    reissuedTo: newId,
    reason: input.reason.trim(),
  });
  next = replaceRecord(next, 'issued-plans', {
    ...quote.plan,
    id: newId,
    memberId,
    issued: input.today,
    saleId: quote.due ? input.id : '',
    purchasePrice: String(quote.price / 100),
    club: club.name,
    reissueFrom: quote.pass.id,
    reissueId: input.id,
    trainerId: quote.trainer?.id || '',
    trainerCategory: quote.trainer?.categoryId || quote.plan.trainerCategory || '',
  });
  for (const [direction, cents, suffix] of [
    ['credit', quote.credit, 'credit'],
    ['debit', quote.applied, 'debit'],
  ] as const)
    if (cents)
      next = replaceRecord(next, 'client-account-movements', {
        id: `${input.id}:${suffix}`,
        memberId,
        operationId: input.id,
        date: input.stamp,
        direction,
        amount: String(cents / 100),
        description:
          direction === 'credit'
            ? `Остаток стоимости: ${quote.pass.name}`
            : `Зачёт в новый абонемент: ${quote.plan.name}`,
        sourcePassId: quote.pass.id,
        passId: newId,
        cashier: user.name,
        club: club.name,
      });
  if (quote.trainer)
    next = replaceRecord(next, 'personal-clients', {
      id: `${quote.trainer.id}:${member.id}`,
      memberId,
      trainerId: quote.trainer.id,
      goal:
        (data['personal-clients'] || []).find(
          (row) => row.memberId === memberId && row.trainerId === quote.trainer!.id,
        )?.goal || '',
    });
  next = replaceRecord(next, 'membership-reissues', {
    id: input.id,
    memberId,
    date: input.stamp,
    sourcePassId: quote.pass.id,
    sourceName: quote.pass.name,
    newPassId: newId,
    targetName: quote.plan.name,
    mode: input.mode,
    formula: quote.explanation,
    purchasePrice: String(quote.purchase / 100),
    priceOrigin: quote.priceOrigin,
    credit: String(quote.credit / 100),
    targetPrice: String(quote.price / 100),
    due: String(quote.due / 100),
    balanceCredit: String(quote.balanceCredit / 100),
    reason: input.reason.trim(),
    cashier: user.name,
    club: club.name,
  });
  return replaceRecord(next, 'membership-history', {
    id: input.id,
    memberId,
    passId: quote.pass.id,
    date: input.stamp,
    name: 'Переоформление на другой абонемент',
    comment: `${quote.pass.name} → ${quote.plan.name}. ${input.reason.trim()}`,
    newPassId: newId,
  });
}
