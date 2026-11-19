import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';

export function financeCents(value: string | number): number {
  if (String(value).trim() === '') throw new Error('Укажите сумму.');
  const amount = Number(String(value).replace(',', '.'));
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isSafeInteger(Math.round(amount * 100)) ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
  )
    throw new Error('Укажите неотрицательную сумму с точностью до копеек.');
  return Math.round(amount * 100);
}
export function accountBalance(
  opening: number,
  memberId: number,
  data: Record<string, DemoRecord[]>,
): number {
  return (
    (Math.round(opening * 100) +
      (data['client-account-movements'] || [])
        .filter((row) => row.memberId === String(memberId))
        .reduce(
          (sum, row) => sum + (row.direction === 'debit' ? -1 : 1) * financeCents(row.amount),
          0,
        )) /
    100
  );
}
export function clientFinanceSales(
  member: Member,
  members: Member[],
  data: Record<string, DemoRecord[]>,
): DemoRecord[] {
  const ledger = data.ledger || [];
  const cashOnly = (data['cash-events'] || []).filter(
    (row) =>
      ['sale', 'refund'].includes(row.kind) &&
      !ledger.some(
        (sale) =>
          sale.id === (row.saleId || row.id) ||
          (row.receiptNumber && sale.receiptNumber === row.receiptNumber),
      ),
  );
  return [...ledger, ...cashOnly].filter((row) => {
    if (row.category === 'Бар' || ['Отменено', 'Отменена'].includes(row.status)) return false;
    if (row.memberId) return row.memberId === String(member.id);
    const found = members.filter((person) =>
      [person.name, person.fullName].filter(Boolean).includes(row.client),
    );
    return found.length === 1 && found[0].id === member.id;
  });
}
export function clientFinanceRows(
  member: Member,
  members: Member[],
  data: Record<string, DemoRecord[]>,
  opening: number,
): DemoRecord[] {
  const rows: DemoRecord[] = clientFinanceSales(member, members, data).map((sale) => ({
    ...sale,
    id: `purchase:${sale.id}`,
    sourceId: sale.id,
    operationId: sale.operationId || sale.id,
    type:
      sale.kind === 'refund'
        ? 'Возврат клиенту'
        : sale.kind === 'membership-reissue'
          ? 'Доплата при переоформлении'
          : sale.status === 'В долг'
            ? 'Покупка в долг'
            : 'Оплата покупки',
    group: 'purchase',
    direction: sale.kind === 'refund' ? 'credit' : 'debit',
    stamp: sale.date ? sale.date + (sale.time ? 'T' + sale.time : '') : '',
    description: sale.name,
    amount:
      sale.amount === undefined || sale.amount === ''
        ? ''
        : String(financeCents(sale.amount) / 100),
    debt: sale.creditAmount || (sale.status === 'В долг' ? sale.total : '') || '',
  }));
  for (const movement of (data['client-account-movements'] || []).filter(
    (row) => row.memberId === String(member.id),
  ))
    rows.push({
      ...movement,
      id: `account:${movement.id}`,
      sourceId: movement.id,
      group: 'account',
      stamp: movement.date,
      type: movement.direction === 'debit' ? 'Списание с ЛС' : 'Поступление на ЛС',
    });
  for (const operation of (data['membership-reissues'] || []).filter(
    (row) => row.memberId === String(member.id),
  ))
    if (!rows.some((row) => row.operationId === operation.id))
      rows.push({
        id: `reissue:${operation.id}`,
        sourceId: operation.id,
        operationId: operation.id,
        group: 'account',
        direction: 'neutral',
        type: 'Переоформление',
        amount: '0',
        stamp: operation.date,
        description: `${operation.sourceName} → ${operation.targetName}`,
        memberId: String(member.id),
      });
  rows.sort((a, b) => b.stamp.localeCompare(a.stamp) || a.id.localeCompare(b.id));
  if (opening)
    rows.push({
      id: `opening:${member.id}`,
      type: 'Входящий остаток ЛС',
      group: 'opening',
      direction: 'neutral',
      amount: String(opening),
      stamp: '',
      description: 'Остаток до начала сохранённой истории. Дата не указана.',
      operationId: '',
    });
  return rows;
}
export function clientFinanceTotals(
  member: Member,
  members: Member[],
  data: Record<string, DemoRecord[]>,
) {
  const sales = clientFinanceSales(member, members, data).filter((row) => row.kind !== 'refund');
  const paid = sales.every((row) => row.amount !== undefined && row.amount !== '')
    ? sales.reduce((sum, row) => sum + financeCents(row.amount), 0) / 100
    : null;
  const linkedDebt = (data.receivables || []).filter((row) => row.memberId === String(member.id));
  const debt =
    sales.reduce((sum, row) => {
      const records = linkedDebt.filter((debt) => debt.saleId === row.id);
      return (
        sum +
        (records.length
          ? records
              .filter((debt) => debt.status !== 'Погашено')
              .reduce((n, debt) => n + financeCents(debt.amount), 0)
          : row.creditAmount
            ? financeCents(row.creditAmount)
            : row.status === 'В долг' && row.total
              ? financeCents(row.total)
              : 0)
      );
    }, 0) +
    linkedDebt
      .filter(
        (debt) => !sales.some((sale) => sale.id === debt.saleId) && debt.status !== 'Погашено',
      )
      .reduce((sum, debt) => sum + financeCents(debt.amount), 0);
  return { paid, debt: debt / 100 };
}
