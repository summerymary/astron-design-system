import type { Member } from '../types';

export const clientName = (member: Pick<Member, 'name' | 'fullName'>) =>
  member.fullName?.trim() || member.name;

export const hiddenPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? `+7 ••• •••-••-${digits.slice(-2)}` : 'Номер скрыт';
};
