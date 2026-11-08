import type { DemoRecord } from '../data/workspace';

export type CashEvent = {
  id: string;
  name: string;
  date: string;
  time: string;
  club: string;
  client: string;
  memberId: string;
  cashier: string;
  comment: string;
  receipt: string;
  method: string;
  kind: 'sale' | 'deposit' | 'withdrawal' | 'refund';
  cash: number;
  card: number;
  website: number;
  gift: number;
  credit: number;
};
export const cashPaymentFilters = [
  ['all', 'Любая оплата'],
  ['cash', 'Наличные'],
  ['card', 'Безналичная оплата'],
  ['refund', 'Возврат наличными'],
  ['withdrawal', 'Снятие наличных'],
  ['deposit', 'Внесение наличных'],
  ['website', 'Оплата на сайте'],
  ['card-refund', 'Возврат по карте'],
  ['credit', 'В кредит'],
  ['gift', 'Подарочная карта'],
  ['split', 'Составная оплата'],
] as const;

/** All arithmetic uses integer kopecks. Gift redemption and debt are not cash inflows. */
export function cashCents(value: string | number | undefined): number {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || !Number.isSafeInteger(Math.round(number * 100)))
    throw new Error('Укажите корректную сумму.');
  return Math.round(number * 100);
}
export function cashJournal(ledger: DemoRecord[], movements: DemoRecord[]): CashEvent[] {
  return [...ledger.filter((row) => row.category !== 'Бар'), ...movements]
    .map((row) => {
      const kind: CashEvent['kind'] = ['deposit', 'withdrawal', 'refund'].includes(row.kind)
        ? (row.kind as CashEvent['kind'])
        : 'sale';
      const amount = cashCents(row.amount);
      const isCash = row.method === 'Наличные' || kind === 'deposit' || kind === 'withdrawal';
      const isCard = ['Карта', 'Безналичная оплата'].includes(row.method);
      const isWebsite = row.method === 'Сайт';
      return {
        id: row.id,
        name: row.name,
        date: row.date,
        time: row.time || '',
        club: row.club,
        client: row.client || '—',
        memberId: row.memberId || '',
        cashier: row.cashier || 'Не указан',
        comment: row.comment || '',
        receipt: row.receiptNumber || '',
        method: row.method,
        kind,
        cash: row.cashAmount !== undefined ? cashCents(row.cashAmount) : isCash ? amount : 0,
        card: row.cardAmount !== undefined ? cashCents(row.cardAmount) : isCard ? amount : 0,
        website: isWebsite ? amount : 0,
        gift:
          row.giftAmount !== undefined
            ? cashCents(row.giftAmount)
            : row.method === 'Подарочная карта'
              ? amount
              : 0,
        credit:
          row.creditAmount !== undefined
            ? cashCents(row.creditAmount)
            : row.method === 'В кредит'
              ? cashCents(row.total ?? row.amount)
              : 0,
      };
    })
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}
export function cashFlow(row: CashEvent) {
  const amount = row.cash + row.card + row.website;
  const expense = row.kind === 'withdrawal' || row.kind === 'refund';
  return { income: expense ? 0 : amount, expense: expense ? amount : 0 };
}
export function filterCashJournal(rows: CashEvent[], date: string, club: string, payment: string) {
  return rows.filter((row) => {
    if ((date && row.date !== date) || (club !== 'all' && row.club !== club)) return false;
    switch (payment) {
      case 'cash':
        return row.kind === 'sale' && row.cash > 0;
      case 'card':
        return row.kind === 'sale' && row.card > 0;
      case 'refund':
        return row.kind === 'refund' && row.cash > 0;
      case 'withdrawal':
        return row.kind === 'withdrawal';
      case 'deposit':
        return row.kind === 'deposit';
      case 'website':
        return row.website > 0;
      case 'card-refund':
        return row.kind === 'refund' && row.card > 0;
      case 'credit':
        return row.credit > 0;
      case 'gift':
        return row.gift > 0;
      case 'split':
        return row.method === 'Составная оплата';
      default:
        return true;
    }
  });
}
export function cashTotals(rows: CashEvent[]) {
  return rows.reduce(
    (total, row) => {
      const flow = cashFlow(row);
      total.income += flow.income;
      total.expense += flow.expense;
      total.website += row.website * (row.kind === 'refund' ? -1 : 1);
      total.gift += row.gift;
      total.credit += row.credit;
      return total;
    },
    { income: 0, expense: 0, website: 0, gift: 0, credit: 0 },
  );
}
// Fictional opening float at the start of demo history. Never a fiscal/device balance.
export function cashBalance(rows: CashEvent[], club: string, through: string, opening = 100000) {
  return (
    opening +
    rows
      .filter((row) => row.club === club && row.date <= through)
      .reduce(
        (sum, row) =>
          sum + row.cash * (row.kind === 'withdrawal' || row.kind === 'refund' ? -1 : 1),
        0,
      )
  );
}
export function validateCashMovement(
  amount: string,
  reason: string,
  kind: 'deposit' | 'withdrawal',
  balance: number,
) {
  const value = Number(amount);
  const cents = cashCents(amount);
  if (!amount.trim() || cents <= 0 || Math.abs(value * 100 - cents) > 0.00001)
    throw new Error('Укажите сумму больше нуля, не более двух знаков после запятой.');
  if (!reason.trim()) throw new Error('Укажите причину операции.');
  if (kind === 'withdrawal' && cents > balance)
    throw new Error('Сумма снятия больше расчётного остатка наличных.');
  return cents;
}
