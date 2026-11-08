import type { ReactNode } from 'react';
import { getMembershipKind } from '../data/membership-kinds';

export function MembershipCard({
  name,
  kindId,
  detail,
  footer,
  compact = false,
}: {
  name: string;
  kindId?: string;
  detail?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
}) {
  const kind = getMembershipKind(name, kindId);
  return (
    <span
      className={`membership-plastic plastic-${kind?.id || 'service'} ${compact ? 'is-compact' : ''}`}
    >
      <span className="plastic-top">
        <b>Астрон</b>
        <span>{kind ? 'Клубная карта' : 'Услуга клуба'}</span>
      </span>
      <span className="plastic-chip" aria-hidden="true" />
      <strong className="plastic-title" title={name}>
        {name}
      </strong>
      <span className="plastic-description">{kind?.description || 'Услуги клуба'}</span>
      {detail && <span className="plastic-detail">{detail}</span>}
      {footer && <span className="plastic-footer">{footer}</span>}
    </span>
  );
}
