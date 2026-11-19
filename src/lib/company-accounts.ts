import type { DemoRecord } from '../data/workspace';
import type { DemoUser } from '../types';
import { cashCents } from './cash';

type Data = Record<string, DemoRecord[]>;
export const canTopUpCompany = (user: DemoUser) =>
  ['administrator', 'club-director'].includes(user.role);

export function companyBalance(data: Data, companyId: string) {
  const company = (data.companies || []).find((row) => row.id === companyId);
  if (!company) throw new Error('Компания не найдена.');
  return (data['company-account-operations'] || [])
    .filter((row) => row.companyId === companyId)
    .reduce((sum, row) => sum + cashCents(row.amount), cashCents(company.openingBalance));
}

export function companyTopUpCents(amount: string) {
  const normalized = amount.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
    throw new Error('Укажите сумму больше нуля, не более двух знаков после запятой.');
  const cents = cashCents(normalized);
  if (cents <= 0) throw new Error('Сумма должна быть больше нуля.');
  return cents;
}

export type CompanyTopUpRequest = {
  id: string;
  companyId: string;
  amount: string;
  method: 'Наличные' | 'Безналичная оплата';
  clubId: string;
  stamp: string;
  comment: string;
  received: boolean;
  receipt: boolean;
};

/** One confirmation writes the account operation, cash receipt and audit together. */
export function topUpCompany(data: Data, request: CompanyTopUpRequest, user: DemoUser): Data {
  if (!canTopUpCompany(user))
    throw new Error('Пополнение доступно администратору и директору клуба.');
  const club = (data.clubs || []).find((row) => row.id === request.clubId);
  if (!club || !user.clubIds.includes(club.id)) throw new Error('Выберите доступный клуб.');
  const company = (data.companies || []).find((row) => row.id === request.companyId);
  if (!company || company.status !== 'Активна')
    throw new Error('Пополнение этой компании недоступно.');
  if (
    !request.id ||
    ['company-account-operations', 'cash-events', 'receipts'].some((key) =>
      (data[key] || []).some((row) => row.id === request.id || row.operationId === request.id),
    )
  )
    throw new Error('Это пополнение уже проведено.');
  if (!['Наличные', 'Безналичная оплата'].includes(request.method))
    throw new Error('Выберите наличные или банковскую карту.');
  if ((data['cash-shifts'] || []).some((row) => row.club === club.name && row.status === 'Закрыта'))
    throw new Error('Кассовая смена закрыта. Откройте смену в разделе «Касса».');
  if (
    request.method === 'Безналичная оплата' &&
    (data['cash-terminals'] || []).some((row) => row.club === club.name && row.status === 'Закрыта')
  )
    throw new Error('Смена терминала закрыта. Проверьте терминал в разделе «Касса».');
  if (!request.received) throw new Error('Подтвердите получение оплаты.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(request.stamp))
    throw new Error('Не удалось определить время операции.');
  const cents = companyTopUpCents(request.amount);
  const balance = companyBalance(data, company.id) + cents;
  if (!Number.isSafeInteger(balance)) throw new Error('Сумма превышает допустимый баланс.');
  const row: DemoRecord = {
    id: request.id,
    operationId: request.id,
    companyId: company.id,
    name: 'Пополнение счёта компании',
    kind: 'company-topup',
    company: company.name,
    account: company.account,
    client: company.name,
    memberId: '',
    date: request.stamp.slice(0, 10),
    time: request.stamp.slice(11),
    club: club.name,
    clubId: club.id,
    cashier: user.name,
    cashierId: user.id,
    amount: String(cents / 100),
    balance: String(balance / 100),
    cashAmount: request.method === 'Наличные' ? String(cents / 100) : '0',
    cardAmount: request.method === 'Безналичная оплата' ? String(cents / 100) : '0',
    method: request.method,
    comment: request.comment.trim(),
    receiptNumber: request.receipt ? `DEMO-${request.id.toUpperCase()}` : '',
    status: 'Зачислено',
  };
  return {
    ...data,
    'company-account-operations': [...(data['company-account-operations'] || []), row],
    'cash-events': [
      ...(data['cash-events'] || []),
      { ...row, name: `${row.name} · ${company.name}` },
    ],
    receipts: request.receipt
      ? [...(data.receipts || []), { ...row, id: `receipt-${row.id}` }]
      : data.receipts || [],
    logs: [
      ...(data.logs || []),
      {
        id: `company-topup:${row.id}`,
        name: `${company.name} · ${row.account}`,
        date: request.stamp,
        service: 'Счета компаний',
        user: user.name,
        type: 'Действие',
        request: 'Пополнение счёта компании',
        action: 'Пополнение счёта компании',
        status: 'Успешно',
        operationId: row.id,
        companyId: company.id,
        club: club.name,
      },
    ],
  };
}
