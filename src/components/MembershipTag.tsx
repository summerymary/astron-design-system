import type { CSSProperties } from 'react';
import { Dumbbell, Ticket, UserRound, Users, UserRoundPlus } from 'lucide-react';
import { getMembershipKind } from '../data/membership-kinds';

export function MembershipTag({ name, kindId }: { name: string; kindId?: string }) {
  const kind = getMembershipKind(name, kindId);
  if (!kind) return <span>{name}</span>;
  const Icon = {
    gym: Dumbbell,
    group: Users,
    personal: UserRound,
    single: Ticket,
    guest: UserRoundPlus,
  }[kind.id];
  return (
    <span
      className="membership-tag"
      data-kind={kind.id}
      style={
        {
          '--membership-bg': kind.background,
          '--membership-text': kind.foreground,
          '--membership-line': kind.line,
        } as CSSProperties
      }
    >
      <Icon size={15} aria-hidden="true" />
      <span>{name}</span>
    </span>
  );
}
