import { Field } from './Field';
import type { ReceptionPayment as Payment } from '../lib/reception-operations';
import { Select } from './Select';
import { money } from '../data/workspace';

export const initialReceptionPayment = (): Payment => ({
  method: 'Безналичная оплата',
  parts: { cash: 0, card: 0, gift: 0, credit: 0 },
  receipt: true,
});
export function ReceptionPayment({
  value,
  onChange,
  total,
}: {
  value: Payment;
  onChange: (value: Payment) => void;
  total: number;
}) {
  return (
    <fieldset className="reception-payment ws-stack">
      <legend>Оплата · {money(total)}</legend>
      <Field className="form-field" label={<> Способ оплаты </>}>
        <Select
          value={value.method}
          onChange={(event) =>
            onChange({ ...value, method: event.target.value as Payment['method'] })
          }
        >
          <option>Безналичная оплата</option>
          <option>Наличные</option>
          <option>Составная оплата</option>
        </Select>
      </Field>
      {value.method === 'Составная оплата' && (
        <div className="reception-payment-parts">
          {(['cash', 'card'] as const).map((key) => (
            <Field className="form-field" key={key} label={<> {key === 'cash' ? 'Наличными, ₽' : 'Картой, ₽'} </>}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={value.parts[key]}
                onChange={(event) =>
                  onChange({
                    ...value,
                    parts: { ...value.parts, [key]: Number(event.target.value) },
                  })
                }
              />
            </Field>
          ))}
        </div>
      )}
      <label className="registration-supervision-check">
        <input
          type="checkbox"
          checked={value.receipt}
          onChange={(event) => onChange({ ...value, receipt: event.target.checked })}
        />
        Демонстрационный чек
      </label>
    </fieldset>
  );
}
