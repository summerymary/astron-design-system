import { Package, Plus } from 'lucide-react';
import type { DemoRecord } from '../data/workspace';
import { money } from '../data/workspace';

export function ProductCard({
  product,
  quantity = 0,
  onAdd,
}: {
  product: DemoRecord;
  quantity?: number;
  onAdd: () => void;
}) {
  const available = Number.isFinite(Number(product.stock)) && Number(product.stock) > quantity;
  return (
    <button
      type="button"
      className="product-card"
      data-ui="product-card"
      data-selected={quantity > 0}
      disabled={!available || quantity >= 999}
      aria-label={`Добавить: ${product.name}`}
      onClick={onAdd}
    >
      <span className="product-card-top">
        <Package size={20} aria-hidden="true" />
        {quantity > 0 && <span>В покупке: {quantity}</span>}
      </span>
      <strong>{product.name}</strong>
      <b>{money(product.price)}</b>
      <small>
        {Number.isFinite(Number(product.stock))
          ? `В наличии: ${product.stock} ${product.unit || 'шт.'}`
          : 'Остаток не указан'}
      </small>
      <span className="product-card-add">
        <Plus size={16} aria-hidden="true" />
        {available ? 'Добавить' : 'Больше нет в наличии'}
      </span>
    </button>
  );
}
