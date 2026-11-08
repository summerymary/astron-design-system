export const paymentMethods = [
  'Наличные',
  'Безналичная оплата',
  'Подарочная карта',
  'В кредит',
  'Составная оплата',
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export type PaymentParts = { cash: number; card: number; gift: number; credit: number };
const cents = (value: number) => Math.round(value * 100);
export function saleTotal(price: number, quantity: number, discount: number) {
  if (!Number.isFinite(price) || price < 0) throw new Error('Проверьте цену.');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999)
    throw new Error('Количество должно быть целым числом от 1 до 999.');
  if (!Number.isFinite(discount) || discount < 0 || discount > 100)
    throw new Error('Скидка должна быть от 0 до 100%.');
  const base = cents(price) * quantity;
  const reduction = Math.round((base * discount) / 100);
  return { base: base / 100, discount: reduction / 100, total: (base - reduction) / 100 };
}
export function paymentPlan(
  total: number,
  method: PaymentMethod,
  mixed: PaymentParts,
  giftBalance?: number,
): PaymentParts {
  if (!paymentMethods.includes(method) || !Number.isFinite(total) || total < 0)
    throw new Error('Выберите способ оплаты.');
  const parts = { cash: 0, card: 0, gift: 0, credit: 0 };
  if (method === 'Составная оплата') Object.assign(parts, mixed);
  else
    parts[
      method === 'Наличные'
        ? 'cash'
        : method === 'Безналичная оплата'
          ? 'card'
          : method === 'Подарочная карта'
            ? 'gift'
            : 'credit'
    ] = total;
  if (
    Object.values(parts).some(
      (value) =>
        !Number.isFinite(value) || value < 0 || Math.abs(value * 100 - cents(value)) > 0.00001,
    )
  )
    throw new Error('Введите неотрицательные суммы с точностью до копеек.');
  if (Object.values(parts).reduce((sum, value) => sum + cents(value), 0) !== cents(total))
    throw new Error('Сумма частей оплаты должна совпадать с итогом.');
  if (
    parts.gift > 0 &&
    (giftBalance === undefined ||
      !Number.isFinite(giftBalance) ||
      cents(parts.gift) > cents(giftBalance))
  )
    throw new Error('Выберите подарочную карту с достаточным остатком.');
  return parts;
}
