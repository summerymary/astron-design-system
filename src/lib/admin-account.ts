import type { DemoRecord } from '../data/workspace';
import type { DemoUser } from '../types';

type PayShift = {
  id: string;
  start: string;
  end: string;
  rate: string;
  status: string;
  club: string;
  reception: string;
  workplace: string;
  hours: number;
  amount: number | null;
  confirmed: boolean;
};

/** Link by saved identity/email, never by a matching display name or role. */
export function adminEmployee(employees: DemoRecord[], user: DemoUser) {
  if (user.role !== 'administrator') return undefined;
  return (
    employees.find((row) => row.userId === user.id) ||
    employees.find((row) => !!user.email && row.email?.toLowerCase() === user.email.toLowerCase())
  );
}

export function ownAdminRecords(rows: DemoRecord[], employeeId: string) {
  return employeeId ? rows.filter((row) => row.employeeId === employeeId) : [];
}

export function adminPaySummary(
  shifts: DemoRecord[],
  bonuses: DemoRecord[],
  payments: DemoRecord[],
  from: string,
  to: string,
) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + 86400000;
  const rows = shifts.flatMap<PayShift>((row) => {
    if (row.status === 'Отменена') return [];
    const hours =
      Math.max(
        0,
        Math.min(end, Date.parse(`${row.end}Z`)) - Math.max(start, Date.parse(`${row.start}Z`)),
      ) / 3600000;
    if (!Number.isFinite(hours) || !hours) return [];
    const rate = Number(row.rate);
    const confirmed = ['Завершена', 'Подтверждена'].includes(row.status);
    return [
      {
        id: row.id,
        start: row.start,
        end: row.end,
        rate: row.rate,
        status: row.status,
        club: row.club,
        reception: row.reception,
        workplace: row.workplace,
        hours,
        amount:
          row.rate?.trim() && Number.isFinite(rate) && rate >= 0
            ? Math.round(hours * rate * 100) / 100
            : null,
        confirmed,
      },
    ];
  });
  const inPeriod = (row: DemoRecord) => row.day >= from && row.day <= to;
  const bonusRows = bonuses.filter(inPeriod);
  const paidRows = payments.filter((row) => inPeriod(row) && row.status === 'Выплачено');
  const sum = (values: number[]) =>
    Math.round(values.reduce((total, n) => total + n, 0) * 100) / 100;
  const earned = sum(rows.filter((row) => row.confirmed).map((row) => row.amount ?? 0));
  const planned = sum(rows.filter((row) => !row.confirmed).map((row) => row.amount ?? 0));
  const approvedBonus = sum(
    bonusRows.filter((row) => row.status === 'Подтверждён').map((row) => Number(row.amount) || 0),
  );
  const pendingBonus = sum(
    bonusRows
      .filter((row) => row.status === 'На согласовании')
      .map((row) => Number(row.amount) || 0),
  );
  const paid = sum(paidRows.map((row) => Number(row.amount) || 0));
  const accrued = sum([earned, approvedBonus]);
  return {
    rows,
    bonusRows,
    paidRows,
    earned,
    planned,
    approvedBonus,
    pendingBonus,
    paid,
    accrued,
    balance: sum([accrued, -paid]),
    forecast: sum([accrued, planned]),
    hours: sum(rows.map((row) => row.hours)),
    confirmedHours: sum(rows.filter((row) => row.confirmed).map((row) => row.hours)),
    missingRates: rows.filter((row) => row.amount === null).length,
  };
}
