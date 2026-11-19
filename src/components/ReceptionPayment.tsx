import { Field } from './Field';
import type { ReceptionPayment as Payment } from '../lib/reception-operations';
import { Select } from './Select';
import { money } from '../data/workspace';
import { paymentMethods } from '../lib/checkout';
import { PaymentMethodPicker } from './PaymentMethodPicker';
import { useWorkspace } from './WorkspaceProvider';
import type { Member } from '../types';
import { ClientSearch } from './ClientSearch';
import { clientName } from '../lib/client-display';
import { Button } from './ui';
import { Notice } from './WorkspaceUI';

export const initialReceptionPayment = (): Payment => ({
  method: 'Безналичная оплата',
  parts: { cash: 0, card: 0, gift: 0, credit: 0 },
  receipt: true,
});
export function ReceptionPayment({
  value,
  onChange,
  total,
  allowSplit = true,
  allowGift = true,
  allowCredit = true,
  members = [],
  member,
  hidePhones = true,
}: {
  value: Payment;
  onChange: (value: Payment) => void;
  total: number;
  allowSplit?: boolean;
  allowGift?: boolean;
  allowCredit?: boolean;
  members?: Member[];
  member?: Member | null;
  hidePhones?: boolean;
}) {
  const { data } = useWorkspace();
  const giftNeeded =
    value.method === 'Подарочная карта' ||
    (value.method === 'Составная оплата' && value.parts.gift > 0);
  const creditNeeded =
    value.method === 'В кредит' || (value.method === 'Составная оплата' && value.parts.credit > 0);
  const canChooseClient = !!member || members.length > 0;
  return (
    <fieldset className="reception-payment ws-stack">
      <legend>Оплата · {money(total)}</legend>
      <PaymentMethodPicker
        value={value.method}
        methods={paymentMethods.filter(
          (method) =>
            (allowSplit || method !== 'Составная оплата') &&
            (allowGift || method !== 'Подарочная карта') &&
            (allowCredit || method !== 'В кредит'),
        )}
        creditDisabled={!canChooseClient}
        onChange={(method) =>
          onChange({
            ...value,
            method,
            ...(method !== value.method ? { memberId: '', client: '' } : {}),
            parts: { cash: 0, card: method === 'Составная оплата' ? total : 0, gift: 0, credit: 0 },
          })
        }
      />
      {value.method === 'Составная оплата' && (
        <div className="reception-payment-parts">
          {(
            [
              'cash',
              'card',
              ...(allowGift ? ['gift'] : []),
              ...(allowCredit && canChooseClient ? ['credit'] : []),
            ] as (keyof Payment['parts'])[]
          ).map((key) => (
            <Field
              key={key}
              label={
                {
                  cash: 'Наличными, ₽',
                  card: 'Картой, ₽',
                  gift: 'Подарочной картой, ₽',
                  credit: 'В кредит, ₽',
                }[key]
              }
            >
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
      {giftNeeded && (
        <Field label="Подарочная карта" hint="Сумма списывается с остатка выбранной карты">
          <Select
            searchable
            value={value.giftId || ''}
            onChange={(event) => onChange({ ...value, giftId: event.target.value })}
          >
            <option value="">Выберите подарочную карту</option>
            {(data['gift-cards'] || [])
              .filter((row) => row.status === 'Активна')
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · остаток {money(row.balance)}
                </option>
              ))}
          </Select>
        </Field>
      )}
      {creditNeeded && (
        <>
          {member ? (
            <Notice>Задолженность будет записана на {clientName(member)}.</Notice>
          ) : value.memberId ? (
            <Notice>
              Задолженность будет записана на {value.client}.{' '}
              <Button
                variant="ghost"
                onClick={() => onChange({ ...value, memberId: '', client: '' })}
              >
                Другой клиент
              </Button>
            </Notice>
          ) : (
            <div className="ws-stack">
              <h3>Клиент для кредита</h3>
              <ClientSearch
                members={members}
                mode="selection"
                purpose="покупки"
                hidePhones={hidePhones}
                onMember={(client) =>
                  onChange({ ...value, memberId: String(client.id), client: clientName(client) })
                }
              />
            </div>
          )}
          <p className="form-note">
            Кредит фиксирует долг клиента. Оплата деньгами пока не поступает.
          </p>
        </>
      )}
      {allowCredit && !canChooseClient && (
        <p className="form-note">Кредит доступен при продаже с выбранным клиентом.</p>
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
