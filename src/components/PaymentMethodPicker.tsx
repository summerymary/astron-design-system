import { Banknote, CreditCard, Gift, Layers, Wallet } from 'lucide-react';
import { paymentMethods } from '../lib/checkout';
import type { PaymentMethod } from '../lib/checkout';
const icons = [Banknote, CreditCard, Gift, Wallet, Layers];
export function PaymentMethodPicker({
  value,
  onChange,
  methods = [...paymentMethods],
  disabled = false,
  creditDisabled = false,
}: {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  methods?: PaymentMethod[];
  disabled?: boolean;
  creditDisabled?: boolean;
}) {
  const enabled = methods.filter((method) => !(creditDisabled && method === 'В кредит'));
  return (
    <fieldset
      className="payment-method-picker"
      data-ui="payment-method-picker"
      role="radiogroup"
      aria-label="Способ оплаты"
    >
      <legend>Способ оплаты</legend>
      {methods.map((method) => {
        const Icon = icons[paymentMethods.indexOf(method)];
        const unavailable = disabled || (method === 'В кредит' && creditDisabled);
        return (
          <button
            type="button"
            key={method}
            role="radio"
            aria-checked={value === method}
            disabled={unavailable}
            tabIndex={value === method ? 0 : -1}
            onClick={() => {
              if (method !== value) onChange(method);
            }}
            onKeyDown={(event) => {
              if (
                !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(
                  event.key,
                )
              )
                return;
              event.preventDefault();
              const index = enabled.indexOf(method);
              const next =
                event.key === 'Home'
                  ? enabled[0]
                  : event.key === 'End'
                    ? enabled.at(-1)!
                    : enabled[
                        (index +
                          (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) +
                          enabled.length) %
                          enabled.length
                      ];
              if (next !== value) onChange(next);
              event.currentTarget.parentElement
                ?.querySelector<HTMLButtonElement>(
                  `[data-method-index="${paymentMethods.indexOf(next)}"]`,
                )
                ?.focus();
            }}
            data-method-index={paymentMethods.indexOf(method)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{method === 'Безналичная оплата' ? 'Банковская карта' : method}</span>
          </button>
        );
      })}
    </fieldset>
  );
}
