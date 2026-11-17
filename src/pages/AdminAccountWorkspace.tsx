import { useEffect, useState } from 'react';
import { CalendarDays, LockKeyhole } from 'lucide-react';
import type { DemoUser } from '../types';
import { money, prettyDate, TODAY } from '../data/workspace';
import { useWorkspace } from '../components/WorkspaceProvider';
import { Button } from '../components/ui';
import { DataTable, Empty, Notice, Stats, Status, Tabs } from '../components/WorkspaceUI';
import { ReportMonthPicker } from '../components/ReportMonthPicker';
import { PinEntry } from '../components/PinEntry';
import { adminEmployee, adminPaySummary, ownAdminRecords } from '../lib/admin-account';
import { reportMonth } from '../lib/report-period';
import { demoNow, demoStamp } from '../lib/demo-clock';

export function AdminAccountWorkspace({
  user,
  screenLocked = false,
}: {
  user: DemoUser;
  screenLocked?: boolean;
}) {
  const { data } = useWorkspace();
  const [unlocked, setUnlocked] = useState(false);
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [tab, setTab] = useState('Обзор');
  useEffect(() => {
    if (screenLocked) setUnlocked(false);
  }, [screenLocked]);
  useEffect(() => {
    const close = () => {
      if (document.hidden) setUnlocked(false);
    };
    document.addEventListener('visibilitychange', close);
    return () => document.removeEventListener('visibilitychange', close);
  }, []);
  if (user.role !== 'administrator')
    return <Empty title="Кабинет недоступен" text="Это личный кабинет администратора." />;
  if (!unlocked || screenLocked)
    return (
      <section className="panel admin-account-gate" aria-labelledby="account-entry-title">
        <LockKeyhole size={28} aria-hidden="true" />
        <h2 id="account-entry-title">Личный кабинет</h2>
        <p>{user.name}</p>
        <p>Ваши смены, начисления и бонусы. Введите личный ПИН-код.</p>
        <PinEntry onUnlock={() => setUnlocked(true)} />
      </section>
    );
  const employee = adminEmployee(data.employees || [], user);
  if (!employee)
    return (
      <Empty
        title="Профиль сотрудника не найден"
        text="Для расчёта нужна привязка учётной записи к сотруднику."
      />
    );
  const period = reportMonth(month)!;
  const shifts = ownAdminRecords(data.shifts || [], employee.id).sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  const pay = adminPaySummary(
    shifts,
    ownAdminRecords(data['employee-bonuses'] || [], employee.id),
    ownAdminRecords(data['employee-payments'] || [], employee.id),
    period.from,
    period.to,
  );
  const next = shifts.find((row) => row.end > demoStamp(demoNow()) && row.status !== 'Отменена');
  const hours = (n: number) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ч`;
  return (
    <div className="ws-stack admin-account">
      <div className="admin-account-toolbar">
        <div>
          <h2>{user.name}</h2>
          <p>Мой кабинет · Администратор</p>
        </div>
        <Button variant="secondary" onClick={() => setUnlocked(false)}>
          <LockKeyhole size={18} />
          Закрыть кабинет
        </Button>
      </div>
      <div className="admin-account-period">
        <ReportMonthPicker month={month} onChange={setMonth} />
        <span>Начисления за выбранный месяц</span>
      </div>
      <Stats
        items={[
          {
            label: 'Часы по графику',
            value: hours(pay.hours),
            note: `Подтверждено ${hours(pay.confirmedHours)}`,
          },
          { label: 'Начислено', value: money(pay.accrued), note: 'Смены и подтверждённые бонусы' },
          { label: 'Уже выплачено', value: money(pay.paid), note: 'Включая аванс' },
          {
            label: pay.balance < 0 ? 'Выплачено вперёд' : 'Осталось к выплате',
            value: money(Math.abs(pay.balance)),
            note: 'По подтверждённым начислениям',
          },
        ]}
      />
      <section className="panel">
        <Tabs
          items={['Обзор', 'Мои смены', 'Начисления', 'Бонусы']}
          value={tab}
          onChange={setTab}
          label="Личный кабинет"
          panelId="account-content"
        />
        <div id="account-content" className="admin-account-content">
          {tab === 'Обзор' && (
            <div className="admin-account-overview">
              <section className="admin-account-card">
                <CalendarDays size={22} />
                <h3>Ближайшая смена</h3>
                {next ? (
                  <>
                    <strong>
                      {prettyDate(next.start).split(' ')[0]} · {next.start.slice(11, 16)}–
                      {next.end.slice(11, 16)}
                    </strong>
                    <p>
                      {next.club} · {next.reception} · {next.workplace}
                    </p>
                    <Status>{next.status}</Status>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setMonth(next.start.slice(0, 7));
                        setTab('Мои смены');
                      }}
                    >
                      Мои смены
                    </Button>
                  </>
                ) : (
                  <p>Будущих смен пока нет.</p>
                )}
              </section>
              <section className="admin-account-card">
                <h3>Как рассчитана сумма</h3>
                <dl className="admin-account-breakdown">
                  <div>
                    <dt>Подтверждённые смены · {hours(pay.confirmedHours)}</dt>
                    <dd>{money(pay.earned)}</dd>
                  </div>
                  <div>
                    <dt>Подтверждённые бонусы</dt>
                    <dd>+ {money(pay.approvedBonus)}</dd>
                  </div>
                  <div>
                    <dt>Выплаты и аванс</dt>
                    <dd>− {money(pay.paid)}</dd>
                  </div>
                  <div>
                    <dt>{pay.balance < 0 ? 'Выплачено вперёд' : 'Осталось к выплате'}</dt>
                    <dd>{money(Math.abs(pay.balance))}</dd>
                  </div>
                </dl>
                <p>
                  План за месяц: {money(pay.forecast)} до вычета выплат, с будущими сменами. Бонусы
                  на согласовании в сумму не включены.
                </p>
              </section>
            </div>
          )}
          {tab === 'Мои смены' && (
            <DataTable
              rows={pay.rows.map((row) => ({
                ...row,
                hours: String(row.hours),
                amount: String(row.amount ?? ''),
                confirmed: String(row.confirmed),
                hoursText: hours(row.hours),
                date: prettyDate(row.start).split(' ')[0],
                time: `${row.start.slice(11, 16)}–${row.end.slice(11, 16)}${row.start.slice(0, 10) !== row.end.slice(0, 10) ? ' (+1 день)' : ''}`,
              }))}
              columns={[
                { key: 'date', label: 'Дата' },
                { key: 'time', label: 'Время' },
                { key: 'club', label: 'Клуб' },
                { key: 'reception', label: 'Ресепшен' },
                { key: 'workplace', label: 'Место' },
                { key: 'hoursText', label: 'Часы' },
                {
                  key: 'status',
                  label: 'Состояние',
                  render: (r) => <Status>{r.status}</Status>,
                },
              ]}
              empty="На этот месяц смен пока нет."
            />
          )}
          {tab === 'Начисления' && (
            <div className="ws-stack">
              <h3>Оплата смен</h3>
              <DataTable
                rows={pay.rows.map((row) => ({
                  id: row.id,
                  date: prettyDate(row.start),
                  hours: hours(row.hours),
                  rate: row.amount === null ? 'Не задана' : `${money(row.rate)} / ч`,
                  amount: row.amount === null ? 'Не рассчитано' : money(row.amount),
                  status: row.confirmed ? 'Подтверждена' : 'План',
                }))}
                columns={[
                  { key: 'date', label: 'Смена' },
                  { key: 'hours', label: 'Часы' },
                  { key: 'rate', label: 'Ставка' },
                  { key: 'amount', label: 'Сумма', render: (r) => r.amount },
                  { key: 'status', label: 'Состояние' },
                ]}
                empty="Начислений за смены пока нет."
              />
              <h3>Выплаты</h3>
              <DataTable
                rows={pay.paidRows}
                columns={[
                  { key: 'day', label: 'Дата', render: (r) => prettyDate(r.day) },
                  { key: 'name', label: 'Назначение' },
                  { key: 'amount', label: 'Сумма', render: (r) => money(r.amount) },
                  {
                    key: 'status',
                    label: 'Состояние',
                    render: (r) => <Status>{r.status}</Status>,
                  },
                ]}
                empty="Выплат за выбранный месяц пока нет."
              />
            </div>
          )}
          {tab === 'Бонусы' && (
            <div className="ws-stack">
              <p>
                Подтверждено: {money(pay.approvedBonus)} · На согласовании:{' '}
                {money(pay.pendingBonus)}
              </p>
              <DataTable
                rows={pay.bonusRows}
                columns={[
                  { key: 'day', label: 'Дата', render: (r) => prettyDate(r.day) },
                  { key: 'name', label: 'За что бонус' },
                  { key: 'basis', label: 'Расчёт' },
                  { key: 'amount', label: 'Сумма', render: (r) => money(r.amount) },
                  {
                    key: 'status',
                    label: 'Состояние',
                    render: (r) => <Status>{r.status}</Status>,
                  },
                ]}
                empty="Бонусов за выбранный месяц пока нет."
              />
            </div>
          )}
        </div>
      </section>
      {pay.missingRates > 0 && (
        <Notice tone="warning">
          У {pay.missingRates} смен не задана ставка. Их сумма пока не рассчитана.
        </Notice>
      )}
      <p className="admin-account-demo">
        Демонстрационный расчёт: часы × ставка + подтверждённые бонусы − выплаты. Налоги и удержания
        пока не учитываются.
      </p>
    </div>
  );
}
