import type { Member } from '../types';
import { memberCards } from '../data/admin';
import { clientCard as readClientCard } from './member-search';

export const clientCard = (member: Member) => readClientCard(member, memberCards);

export const clientName = (member: Pick<Member, 'name' | 'fullName'>) =>
  member.fullName?.trim() || member.name;

export const hiddenPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? `+7 ••• •••-••-${digits.slice(-2)}` : 'Номер скрыт';
};
