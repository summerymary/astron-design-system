import { memberCards, memberDemographics } from './admin';
import type { Member } from '../types';

export const clientTabs = [
  { id: 'subscriptions', label: 'Абонементы' },
  { id: 'info', label: 'Инфо' },
  { id: 'visits', label: 'Посещения' },
  { id: 'finances', label: 'Финансы' },
  { id: 'comments', label: 'Комментарии' },
  { id: 'actions', label: 'Действия' },
  { id: 'bookings', label: 'Предзапись' },
  { id: 'reviews', label: 'Отзывы' },
  { id: 'calls', label: 'Звонки' },
  { id: 'messages', label: 'Переписка' },
] as const;
export type ClientTabId = (typeof clientTabs)[number]['id'];
export type SubscriptionStatus = 'active' | 'expired' | 'pending' | 'paused';
export interface DemoSubscription {
  id: string;
  name: string;
  used: number;
  remaining: number | null;
  boughtAt: string;
  activatedAt: string | null;
  endsAt: string | null;
  status: SubscriptionStatus;
}

export function getClientProfile(member: Member) {
  const demographic = memberDemographics[member.id];
  const hasDemoProfile = Boolean(demographic);
  const birthYear = demographic ? 2026 - demographic.age : null;
  const subscriptions: DemoSubscription[] = [
    {
      id: `S-${member.id}-01`,
      name: member.plan,
      used: member.visits,
      remaining: member.plan === '12 занятий' ? Math.max(0, 12 - member.visits) : null,
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
  return {
    card: memberCards[member.id] ?? String(member.id + 99000),
    birthDate: birthYear ? `12.04.${birthYear}` : 'Не указана',
    gender: demographic ? (demographic.gender === 'male' ? 'Мужской' : 'Женский') : 'Не указан',
    balance: hasDemoProfile ? (member.id === 1001 ? 2400 : 1200) : 0,
    organization: member.id === 1001 ? 'ООО «Север»' : 'Не привязан',
    personalAccount: hasDemoProfile,
    mobileApp: hasDemoProfile && member.id % 2 === 1,
    note: hasDemoProfile ? 'Предпочитает вечерние занятия.' : '',
    goal: hasDemoProfile ? 'Регулярные тренировки и хорошее самочувствие' : 'Не указана',
    source: hasDemoProfile ? 'Рекомендация друга' : 'Не указан',
    smsConsent: hasDemoProfile,
    emailConsent: hasDemoProfile,
    subscriptions: hasDemoProfile ? subscriptions : subscriptions.slice(0, 1),
  };
}
