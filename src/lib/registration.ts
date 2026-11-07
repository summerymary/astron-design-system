import type { DemoSubscription } from '../data/clientProfile';
import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';

export function passUnavailable(pass: DemoSubscription): string | null {
  if (pass.status === 'paused') return 'Абонемент заморожен';
  if (pass.status === 'expired' || pass.remaining === 0) return 'Абонемент завершён';
  if (!pass.kindId) return 'Дополнительная услуга — не абонемент для прохода';
  return null;
}
export function usePass(
  member: Member,
  pass: DemoSubscription,
  duration: number,
  today: string,
): DemoRecord {
  const problem = passUnavailable(pass);
  if (problem) throw new Error(problem);
  const activatedAt = pass.activatedAt || today.split('-').reverse().join('.');
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + Math.max(0, duration - 1));
  return {
    id: `${member.id}:${pass.id}`,
    memberId: String(member.id),
    passId: pass.id,
    used: String(pass.used + 1),
    remaining: pass.remaining === null ? 'unlimited' : String(pass.remaining - 1),
    activatedAt,
    endsAt: pass.endsAt || end.toISOString().slice(0, 10).split('-').reverse().join('.'),
  };
}
