import type { Member } from '../types';

export type NewMemberDraft = {
  fullName: string;
  birthDate: string;
  phone: string;
  email: string;
  photoDataUrl?: string;
};

const nameParts = (name: string) =>
  name
    .normalize('NFKC')
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[‐‑–—−]/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
const personKey = (name: string) => {
  const parts = nameParts(name);
  return parts.length >= 2 ? parts.slice(0, 2).sort().join(' ') : '';
};
export const normalizedMemberPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(digits)) return '';
  if (digits.length === 10) return '7' + digits;
  return digits.replace(/^8(?=\d{10}$)/, '7');
};
export const normalizedBirthDate = (birth: string) => {
  const iso = /^\d{2}\.\d{2}\.\d{4}$/.test(birth) ? birth.split('.').reverse().join('-') : birth;
  const date = new Date(`${iso}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : '';
};

/** Exact identity or exact normalized phone; names alone are deliberately silent. */
export function findMemberDuplicates(
  members: Member[],
  draft: Pick<NewMemberDraft, 'fullName' | 'birthDate' | 'phone'>,
) {
  const name = personKey(draft.fullName);
  const birth = normalizedBirthDate(draft.birthDate);
  const phone = normalizedMemberPhone(draft.phone);
  return members
    .flatMap((member) => {
      const sameName =
        !!name && [member.fullName || '', member.name].some((value) => personKey(value) === name);
      const sameBirthDate = !!birth && normalizedBirthDate(member.birthDate || '') === birth;
      const samePhone = !!phone && normalizedMemberPhone(member.phone) === phone;
      return (sameName && sameBirthDate) || samePhone
        ? [{ member, sameIdentity: sameName && sameBirthDate, samePhone }]
        : [];
    })
    .sort((a, b) => Number(b.sameIdentity) - Number(a.sameIdentity));
}

export function memberContactError(
  draft: Pick<NewMemberDraft, 'fullName' | 'birthDate' | 'phone'>,
) {
  if (!draft.fullName.trim()) return 'Укажите фамилию, имя и отчество.';
  if (
    draft.phone.trim() &&
    (!/^\+?[\d\s().−-]+$/.test(draft.phone.trim()) || !normalizedMemberPhone(draft.phone))
  )
    return 'Укажите телефон: от 10 до 15 цифр.';
  if (draft.birthDate && !normalizedBirthDate(draft.birthDate))
    return 'Укажите корректную дату рождения.';
  return null;
}

export function memberUpdateDraft(member: Member, draft: NewMemberDraft) {
  const existingName = member.fullName || member.name;
  const keepPatronymic =
    personKey(draft.fullName) === personKey(existingName) &&
    nameParts(draft.fullName).length < nameParts(existingName).length;
  return {
    id: String(member.id),
    fullName: keepPatronymic ? existingName : draft.fullName.trim() || existingName,
    birthDate: draft.birthDate || normalizedBirthDate(member.birthDate || ''),
    phone: draft.phone.trim() || (normalizedMemberPhone(member.phone) ? member.phone : ''),
    email: draft.email.trim() || member.email,
  };
}
