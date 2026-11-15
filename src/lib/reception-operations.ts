import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';
import { clientCard } from './member-search';
import { paymentPlan, saleTotal } from './checkout';
import type { PaymentMethod, PaymentParts } from './checkout';

type Data = Record<string, DemoRecord[]>;
export type ReceptionPayment = { method: PaymentMethod; parts: PaymentParts; receipt: boolean };
export const replaceRecord = (data: Data, collection: string, row: DemoRecord): Data => ({
  ...data,
  [collection]: [...(data[collection] || []).filter((item) => item.id !== row.id), row],
});
export function cardNumberError(
  number: string,
  member: Member,
  members: Member[],
  cards: Record<number, string>,
): string | null {
  if (!/^\d{3,16}$/.test(number.trim())) return 'Номер карты должен содержать от 3 до 16 цифр.';
  return members.some((item) => item.id !== member.id && clientCard(item, cards) === number.trim())
    ? 'Этот номер карты уже используется другим клиентом.'
    : null;
}
export function paidOperation(
  data: Data,
  row: DemoRecord,
  amount: number,
  payment: ReceptionPayment,
): Data {
  if ((data.ledger || []).some((item) => item.id === row.id))
    throw new Error('Оплата уже проведена.');
  if (
    !['Наличные', 'Безналичная оплата', 'Составная оплата'].includes(payment.method) ||
    payment.parts.gift ||
    payment.parts.credit
  )
    throw new Error('Для этой операции выберите наличные, банковскую карту или их сочетание.');
  const parts = paymentPlan(amount, payment.method, payment.parts);
  const sale = {
    ...row,
    total: String(amount),
    amount: String(amount),
    cashAmount: String(parts.cash),
    cardAmount: String(parts.card),
    giftAmount: '0',
    creditAmount: '0',
    method: payment.method,
    status: 'Оплачено',
    receiptRequested: String(payment.receipt),
    receiptNumber: payment.receipt ? `DEMO-${row.id.slice(-8).toUpperCase()}` : '',
  };
  let next = replaceRecord(data, 'ledger', sale);
  if (payment.receipt)
    next = replaceRecord(next, 'receipts', { ...sale, id: `receipt-${row.id}`, saleId: row.id });
  return next;
}
export function retailSale(
  data: Data,
  cart: Record<string, number>,
  row: DemoRecord,
  payment: ReceptionPayment,
): Data {
  if (Object.values(cart).some((quantity) => !Number.isInteger(quantity) || quantity <= 0))
    throw new Error('Количество должно быть целым положительным числом.');
  const lines = Object.entries(cart);
  if (!lines.length) throw new Error('Добавьте товары в покупку.');
  let total = 0;
  const products = data['retail-products'] || [];
  const items = lines.map(([id, quantity]) => {
    const product = products.find((item) => item.id === id && item.status === 'Активен');
    if (!product) throw new Error('Товар больше не доступен на ресепшене.');
    const price = saleTotal(Number(product.price), quantity, 0);
    if (!Number.isFinite(Number(product.stock)) || quantity > Number(product.stock))
      throw new Error(`Недостаточно товара «${product.name}».`);
    total += Math.round(price.total * 100);
    return { product, quantity };
  });
  let next = paidOperation(
    data,
    {
      ...row,
      category: 'Товары',
      client: 'Без привязки к клиенту',
      memberId: '',
      name: items.map(({ product, quantity }) => `${product.name} × ${quantity}`).join(', '),
      quantity: String(items.reduce((sum, item) => sum + item.quantity, 0)),
    },
    total / 100,
    payment,
  );
  for (const { product, quantity } of items) {
    next = replaceRecord(next, 'retail-products', {
      ...product,
      stock: String(Number(product.stock) - quantity),
    });
    next = replaceRecord(next, 'retail-sale-lines', {
      id: `${row.id}:${product.id}`,
      saleId: row.id,
      productId: product.id,
      name: product.name,
      quantity: String(quantity),
      price: product.price,
    });
  }
  return next;
}
export function issueGift(data: Data, input: DemoRecord, payment?: ReceptionPayment): Data {
  if ((data['gift-cards'] || []).some((row) => row.id === input.id))
    throw new Error('Карта уже выдана.');
  if (
    !input.name.trim() ||
    input.name.trim().length > 32 ||
    (data['gift-cards'] || []).some(
      (item) => item.name.toLocaleLowerCase() === input.name.trim().toLocaleLowerCase(),
    )
  )
    throw new Error('Укажите уникальный номер подарочной карты.');
  const amount = Number(input.nominal);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000 ||
    Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001
  )
    throw new Error('Укажите номинал от 0,01 до 1 000 000 ₽.');
  const order = input.orderId
    ? (data['gift-orders'] || []).find(
        (row) => row.id === input.orderId && row.status === 'Оплачен',
      )
    : null;
  if (input.orderId && (!order || Number(order.amount) !== amount))
    throw new Error('Заказ уже выдан или изменился.');
  if (!payment && !order && !input.ownerId)
    throw new Error('Для выдачи без оплаты выберите владельца карты.');
  if (!payment && !order && !input.comment?.trim())
    throw new Error('Укажите основание выдачи без оплаты.');
  let next = payment
    ? paidOperation(
        data,
        {
          id: input.id,
          name: `Подарочная карта ${input.name}`,
          category: 'Подарочные карты',
          kind: 'gift-issue',
          date: input.date,
          time: input.time,
          club: input.club,
          cashier: input.cashier,
          memberId: input.buyerId || '',
          client: input.buyer || 'Покупатель подарочной карты',
        },
        amount,
        payment,
      )
    : data;
  next = replaceRecord(next, 'gift-cards', {
    ...input,
    name: input.name.trim(),
    balance: String(amount),
    status: 'Активна',
    source: order ? 'Онлайн' : payment ? 'Продажа' : 'Без оплаты',
  });
  next = replaceRecord(next, 'gift-history', {
    id: `issue:${input.id}`,
    cardId: input.id,
    date: `${input.date}T${input.time}`,
    name: order ? 'Выдана по онлайн-заказу' : payment ? 'Продажа карты' : 'Выдача без оплаты',
    amount: String(amount),
    balance: String(amount),
    comment: input.comment || '',
  });
  if (order)
    next = replaceRecord(next, 'gift-orders', { ...order, status: 'Выдан', cardId: input.id });
  return next;
}
export function redeemGift(data: Data, cardId: string, amount: number, record: DemoRecord): Data {
  const card = (data['gift-cards'] || []).find(
    (row) => row.id === cardId && row.status === 'Активна',
  );
  if (
    !card ||
    !Number.isFinite(amount) ||
    Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001 ||
    amount <= 0 ||
    Math.round(amount * 100) > Math.round(Number(card.balance) * 100)
  )
    throw new Error('Проверьте сумму списания и остаток подарочной карты.');
  if ((data['gift-history'] || []).some((row) => row.id === record.id))
    throw new Error('Списание уже проведено.');
  const balance = (Math.round(Number(card.balance) * 100) - Math.round(amount * 100)) / 100;
  return replaceRecord(
    replaceRecord(data, 'gift-cards', {
      ...card,
      balance: String(balance),
      status: balance ? 'Активна' : 'Использована',
    }),
    'gift-history',
    { ...record, cardId, amount: String(-amount), balance: String(balance) },
  );
}
