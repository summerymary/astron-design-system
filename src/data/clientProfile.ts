import { TODAY } from './workspace';
import { memberCards, memberDemographics } from './admin';
import type { Member } from '../types';
import { getMembershipKind } from './membership-kinds';
import type { DemoRecord } from './workspace';

export const clientTabs = [
  { id: 'subscriptions', label: 'Абонементы' },
  { id: 'visits', label: 'Посещения' },
  { id: 'finances', label: 'Финансы' },
  { id: 'comments', label: 'Комментарии' },
  { id: 'info', label: 'Информация' },
  { id: 'bookings', label: 'Предзапись' },
  { id: 'messages', label: 'Переписка' },
  { id: 'actions', label: 'Активность' },
  { id: 'calls', label: 'Звонки' },
  { id: 'reviews', label: 'Отзывы' },
] as const;
export type ClientTabId = (typeof clientTabs)[number]['id'];
export type SubscriptionStatus = 'active' | 'expired' | 'pending' | 'paused';
export interface DemoSubscription {
  id: string;
  name: string;
  kindId?: string;
  used: number;
  remaining: number | null;
  boughtAt: string;
  activatedAt: string | null;
  endsAt: string | null;
  status: SubscriptionStatus;
}

export function getClientProfile(member: Member, data: Record<string, DemoRecord[]> = {}) {
  const demographic = memberDemographics[member.id];
  const hasDemoProfile = Boolean(demographic);
  const birthYear = demographic ? 2026 - demographic.age : null;
  const kind = getMembershipKind(member.plan);
  const limit = kind && kind.type !== 'Безлимитный' ? Number(kind.visits) : null;
  const baseUsed = member.initialPassVisits ?? member.visits;
  const subscriptions: DemoSubscription[] = [
    {
      id: `S-${member.id}-01`,
      name: member.plan,
      kindId: kind?.id,
      used: limit === null ? baseUsed : Math.min(baseUsed, limit),
      remaining: limit === null ? null : Math.max(0, limit - baseUsed),
      boughtAt: member.joined,
      activatedAt: member.joined,
      endsAt: member.expires,
      status: member.status === 'paused' ? 'paused' : 'active',
    },
    {
      id: `S-${member.id}-02`,
      name: 'Персональные тренировки · 4 занятия',
      used: 1,
      remaining: 3,
      boughtAt: '20.10.2026',
      activatedAt: '21.10.2026',
      endsAt: '20.11.2026',
      status: 'active',
    },
    {
      id: `S-${member.id}-03`,
      name: 'Прокат полотенца',
      used: 0,
      remaining: 1,
      boughtAt: '28.10.2026',
      activatedAt: null,
      endsAt: null,
      status: 'pending',
    },
    {
      id: `S-${member.id}-04`,
      name: 'Тренажерный зал · 1 месяц',
      used: 18,
      remaining: 0,
      boughtAt: '01.09.2026',
      activatedAt: '01.09.2026',
      endsAt: '01.10.2026',
      status: 'expired',
    },
  ];
  const all = hasDemoProfile ? subscriptions : subscriptions.slice(0, 1);
  for (const row of (data['issued-plans'] || []).filter(
    (row) => row.memberId === String(member.id),
  )) {
    all.unshift({
      id: row.id,
      name: row.name,
      kindId: row.kindId,
      used: 0,
      remaining: row.type === 'Безлимитный' ? null : Number(row.visits),
      boughtAt: row.issued.split('-').reverse().join('.'),
      activatedAt: null,
      endsAt: null,
      status: 'pending',
    });
  }
  for (const sub of all) {
    sub.kindId ||= getMembershipKind(sub.name)?.id;
    const usage = (data['pass-usage'] || []).find(
      (row) => row.memberId === String(member.id) && row.passId === sub.id,
    );
    if (usage) {
      sub.used = Number(usage.used);
      sub.remaining = usage.remaining === 'unlimited' ? null : Number(usage.remaining);
      sub.activatedAt = usage.activatedAt;
      sub.endsAt = usage.endsAt || sub.endsAt;
      if (sub.status === 'pending') sub.status = 'active';
    }
    if (
      sub.status !== 'paused' &&
      (sub.remaining === 0 || (sub.endsAt && sub.endsAt.split('.').reverse().join('-') < TODAY))
    )
      sub.status = 'expired';
  }
  return {
    card: memberCards[member.id] ?? String(member.id + 99000),
    birthDate:
      member.birthDate !== undefined
        ? member.birthDate
          ? member.birthDate.split('-').reverse().join('.')
          : 'Не указана'
        : birthYear
          ? `12.04.${birthYear}`
          : 'Не указана',
    gender:
      member.gender ||
      (demographic ? (demographic.gender === 'male' ? 'Мужской' : 'Женский') : 'Не указан'),
    balance: hasDemoProfile ? (member.id === 1001 ? 2400 : 1200) : 0,
    organization:
      member.organization !== undefined
        ? member.organization || 'Не привязан'
        : member.id === 1001
          ? 'ООО «Север»'
          : 'Не привязан',
    personalAccount: hasDemoProfile,
    mobileApp: hasDemoProfile && member.id % 2 === 1,
    note: hasDemoProfile ? 'Предпочитает вечерние занятия.' : '',
    goal: hasDemoProfile ? 'Регулярные тренировки и хорошее самочувствие' : 'Не указана',
    source: hasDemoProfile ? 'Рекомендация друга' : 'Не указан',
    smsConsent: hasDemoProfile,
    emailConsent: hasDemoProfile,
    subscriptions: all,
  };
}
