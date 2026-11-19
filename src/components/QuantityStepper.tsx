import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Field } from './Field';
import { IconButton } from './ui';

export function QuantityStepper({
  value,
  onChange,
  label = 'Количество',
  itemName,
  min = 1,
  max = 999,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  itemName?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const accessibleLabel = itemName ? `${label}: ${itemName}` : label;
  const ceiling = Number.isFinite(max) ? Math.max(min, Math.floor(max)) : min;
  const change = (next: number) =>
    onChange(Math.max(min, Math.min(ceiling, Math.floor(next) || min)));
  return (
    <Field label={label} htmlFor={id}>
      <span
        className="quantity-stepper"
        data-ui="quantity-stepper"
        role="group"
        aria-label={accessibleLabel}
      >
        <IconButton
          label={`Уменьшить: ${accessibleLabel}`}
          variant="secondary"
          disabled={disabled || value <= min}
          onClick={() => change(value - 1)}
        >
          <Minus size={18} />
        </IconButton>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={ceiling}
          step="1"
          value={value}
          disabled={disabled}
          aria-label={accessibleLabel}
          onChange={(event) => change(Number(event.target.value))}
        />
        <IconButton
          label={`Увеличить: ${accessibleLabel}`}
          variant="secondary"
          disabled={disabled || value >= ceiling}
          onClick={() => change(value + 1)}
        >
          <Plus size={18} />
        </IconButton>
      </span>
    </Field>
  );
}
