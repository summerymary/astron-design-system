import { Building2, ChevronRight, Dumbbell, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import type { SaleSectionId } from '../lib/sale-catalog';
import { saleSections } from '../lib/sale-catalog';

const icons = {
  memberships: Dumbbell,
  personal: UserRound,
  corporate: Building2,
  exceptions: Sparkles,
  'goods-services': ShoppingBag,
};
export function CatalogSectionCard({
  id,
  count,
  onClick,
}: {
  id: SaleSectionId;
  count: number;
  onClick: () => void;
}) {
  const section = saleSections.find((item) => item.id === id)!;
  const Icon = icons[id];
  return (
    <button className={`sale-section-link catalog-section-card section-${id}`} onClick={onClick}>
      <Icon size={24} aria-hidden="true" />
      <span>
        <strong>{section.name}</strong>
        <small>{section.description}</small>
      </span>
      <b aria-label={`Позиций: ${count}`}>{count}</b>
      <ChevronRight size={19} aria-hidden="true" />
    </button>
  );
}
