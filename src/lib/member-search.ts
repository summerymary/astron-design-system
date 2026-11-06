import type { Member } from '../types';

export function clientCard(member: Member, cards: Record<number, string>) {
  return cards[member.id] ?? String(member.id + 99000);
}

const digits = (value: string) => value.replace(/\D/g, '');
const phoneDigits = (value: string) => digits(value).replace(/^8(?=\d{10}$)/, '7');
const words = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

export function searchMembers(
  members: Member[],
  cards: Record<number, string>,
  input: string,
): Member[] {
  const query = input.trim();
  if (!query) return [];
  if (/^[\d\s()+.\-]+$/.test(query)) {
    const number = phoneDigits(query);
    if (!number) return [];
    return members
      .map((member, order) => {
        const card = clientCard(member, cards);
        const phone = phoneDigits(member.phone);
        const rank =
          card === digits(query)
            ? 0
            : phone === number
              ? 1
              : card.startsWith(digits(query))
                ? 2
                : number.length >= 3 && phone.includes(number)
                  ? 3
                  : -1;
        return { member, rank, order };
      })
      .filter(({ rank }) => rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .map(({ member }) => member);
  }
  const queryWords = words(query);
  if (!queryWords.length) return [];
  return members.filter((member) => {
    const name = words(`${member.name} ${member.fullName ?? ''}`);
    return queryWords.every((part) => name.some((word) => word.startsWith(part)));
  });
}
