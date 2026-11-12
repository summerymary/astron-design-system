import { clientName } from '../lib/client-display';
import { demoStamp, nextDemoNow } from '../lib/demo-clock';
import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Banknote, ChevronRight, CreditCard } from 'lucide-react';
import { Button, Modal } from '../components/ui';
import { Select } from '../components/Select';
import { Empty, Notice, Stats, Tabs } from '../components/WorkspaceUI';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { money, prettyDate, TODAY } from '../data/workspace';
import type { Member } from '../types';
import {
  cashBalance,
  cashFlow,
  cashJournal,
  cashPaymentFilters,
  cashTotals,
  filterCashJournal,
  validateCashMovement,
} from '../lib/cash';
import type { CashEvent } from '../lib/cash';
import '../styles/cash.css';

const rubles = (cents: number) => money(cents / 100);
const kinds = { sale: 'Продажа', deposit: 'Внесение', withdrawal: 'Снятие', refund: 'Возврат' };
const commands = {
  open: 'Открыть смену',
  x: 'X-отчёт без закрытия смены',
  z: 'Z-отчёт и закрытие смены',
  balance: 'Наличные в кассе',
  state: 'Состояние кассы',
  terminalClose: 'Закрыть смену по картам',
  short: 'Краткие итоги по картам',
  full: 'Полные итоги по картам',
};
type Command = keyof typeof commands;

export function CashWorkspace({
  clubName,
  employeeName,
  members,
  onMember,
}: {
  clubName: string;
  employeeName: string;
  members: Member[];
  onMember: (member: Member) => void;
}) {
  const { data, put } = useWorkspace();
  const [tab, setTab] = useState('journal');
  const [club, setClub] = useState(clubName.split(' · ').at(-1) || 'Центральный');
  useEffect(() => setClub(clubName.split(' · ').at(-1) || 'Центральный'), [clubName]);
  const [date, setDate] = useState(TODAY);
  const [payment, setPayment] = useState('all');
  const [detail, setDetail] = useState<CashEvent | null>(null);
  const [command, setCommand] = useState<Command | null>(null);
  const [movement, setMovement] = useState<'deposit' | 'withdrawal' | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [fiscal, setFiscal] = useState(true);
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const closeDetail = useCallback(() => setDetail(null), []);
  const closeCommand = useCallback(() => setCommand(null), []);
  const closeMovement = useCallback(() => setMovement(null), []);
  const detailMember = members.find((member) => String(member.id) === detail?.memberId);
  const clubs = data.clubs.map((row) => row.name);
  const journal = cashJournal(data.ledger, data['cash-events'] || []);
  const rows = filterCashJournal(journal, date || TODAY, club, payment);
  const totals = cashTotals(rows);
  const dayRows = filterCashJournal(journal, TODAY, club, 'all');
  const cardRows = dayRows.filter((row) => row.card > 0);
  const cardTotal = cardRows.reduce(
    (sum, row) => sum + row.card * (row.kind === 'refund' ? -1 : 1),
    0,
  );
  const currentBalance = cashBalance(journal, club, TODAY);
  const shift = data['cash-shifts']?.find((row) => row.club === club);
  const isOpen = shift?.status !== 'Закрыта';
  const shiftNumber = shift?.number || '1';
  const balances = (club === 'all' ? clubs : [club]).map((name) => ({
    name,
    value: cashBalance(journal, name, date || TODAY),
  }));
  const equipmentUnavailable = club === 'all';
  const startMovement = (kind: 'deposit' | 'withdrawal') => {
    setAmount('');
    setReason('');
    setFiscal(true);
    setReview(false);
    setError('');
    setMovement(kind);
  };
  const checkMovement = () => {
    if (!movement) return false;
    try {
      validateCashMovement(amount, reason, movement, currentBalance);
      if (equipmentUnavailable || !isOpen) throw new Error('Выберите клуб с открытой демосменой.');
      setError('');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Проверьте операцию.');
      return false;
    }
  };
  const confirmMovement = () => {
    if (!movement || !checkMovement()) return;
    put('cash-events', {
      id: demoId('cash'),
      name: movement === 'deposit' ? 'Внесение наличных' : 'Инкассация',
      date: TODAY,
      time: demoStamp(nextDemoNow()).slice(11),
      club,
      amount: String(Number(amount)),
      method: 'Наличные',
      kind: movement,
      cashier: employeeName,
      comment: reason.trim(),
      fiscalDemo: String(fiscal),
    });
    setMovement(null);
    setMessage('Демооперация добавлена в журнал. Остаток наличных пересчитан.');
  };
  const confirmCommand = () => {
    if (!command || equipmentUnavailable) return;
    if (command === 'open' || command === 'z') {
      put('cash-shifts', {
        id: `cash-shift-${club}`,
        club,
        status: command === 'open' ? 'Открыта' : 'Закрыта',
        number: command === 'open' ? String(Number(shiftNumber) + 1) : shiftNumber,
      });
      setMessage(
        command === 'open'
          ? 'Демосмена открыта.'
          : 'Демосмена закрыта. Печать и фискализация не выполнялись.',
      );
    } else if (command === 'terminalClose') {
      put('cash-terminals', { id: `terminal-${club}`, club, status: 'Закрыта' });
      setMessage('Смена демонстрационного терминала закрыта.');
    }
    setCommand(null);
  };
  const eventAmount = (row: CashEvent) => {
    const flow = cashFlow(row);
    if (flow.expense) return <span className="cash-expense">−{rubles(flow.expense)}</span>;
    if (flow.income) return <span>{rubles(flow.income)}</span>;
    return <span className="cash-muted">Без прихода денег</span>;
  };
  const openClient = (row: CashEvent) => {
    const member = members.find((member) => String(member.id) === row.memberId);
    if (member)
      return (
        <button className="cash-text-button" onClick={() => onMember(member)}>
          {clientName(member)}
        </button>
      );
    return row.client;
  };
  return (
    <div className="ws-stack cash-workspace">
      <div className="cash-toolbar">
        <Tabs
          label="Разделы кассы"
          items={[
            { id: 'journal', label: 'Журнал операций' },
            { id: 'kkm', label: 'ККМ' },
            { id: 'terminal', label: 'Терминал' },
          ]}
          value={tab}
          onChange={(value) => {
            setTab(value);
            setMessage('');
          }}
        />
      </div>
      {message && <Notice tone="success">{message}</Notice>}
      <section className="panel ws-panel cash-main-panel">
        <div className="cash-filters">
          {tab === 'journal' && (
            <label className="form-field">
              <span>Дата</span>
              <input
                type="date"
                value={date}
                required
                onChange={(e) => setDate(e.target.value)}
                onInput={(e) => setDate(e.currentTarget.value)}
                onBlur={() => {
                  if (!date) setDate(TODAY);
                }}
              />
            </label>
          )}
          <label className="form-field">
            <span>Клуб</span>
            <Select value={club} onChange={(e) => setClub(e.target.value)}>
              <option value="all">Все клубы</option>
              {clubs.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Select>
          </label>
          {tab === 'journal' && (
            <label className="form-field">
              <span>Вид оплаты / операции</span>
              <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
                {cashPaymentFilters.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <span className="cash-register-label">
            <Banknote size={18} />
            Касса №1
          </span>
        </div>
        {tab === 'journal' ? (
          <>
            {rows.length ? (
              <>
                <div
                  className="cash-table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Журнал кассы, таблица с горизонтальной прокруткой"
                >
                  <table className="cash-table">
                    <caption className="sr-only">
                      Кассовые операции за {prettyDate(date || TODAY)}. Итоги учитывают выбранные
                      фильтры.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Время / покупка</th>
                        <th scope="col">Клиент</th>
                        <th scope="col" className="cash-number">
                          Приход, ₽
                        </th>
                        <th scope="col" className="cash-number">
                          Расход, ₽
                        </th>
                        <th scope="col">Оплата</th>
                        <th scope="col">
                          <span className="sr-only">Подробности</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const flow = cashFlow(row);
                        return (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.time || '—'}</strong>{' '}
                              <span className="cash-muted">· {kinds[row.kind]}</span>
                              <span className="cash-cell-sub">{row.name}</span>
                              {club === 'all' && (
                                <span className="cash-cell-sub cash-muted">{row.club}</span>
                              )}
                            </td>
                            <td>{openClient(row)}</td>
                            <td className="cash-number">
                              {flow.income ? rubles(flow.income) : '—'}
                            </td>
                            <td className="cash-number cash-expense">
                              {flow.expense ? rubles(flow.expense) : '—'}
                            </td>
                            <td>
                              {row.method}
                              {row.credit > 0 && (
                                <span className="cash-cell-sub cash-muted">
                                  В долг: {rubles(row.credit)}
                                </span>
                              )}
                              {row.gift > 0 && (
                                <span className="cash-cell-sub cash-muted">
                                  С подарочной: {rubles(row.gift)}
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`Подробнее: ${row.name}, ${row.time || 'без времени'}`}
                                onClick={() => setDetail(row)}
                              >
                                <ChevronRight size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="cash-mobile-list">
                  {rows.map((row) => (
                    <button key={row.id} className="cash-mobile-row" onClick={() => setDetail(row)}>
                      <span className="cash-mobile-top">
                        <span className="cash-muted">
                          {row.time || '—'} · {kinds[row.kind]}
                        </span>
                        <strong>{eventAmount(row)}</strong>
                      </span>
                      <strong>{row.name}</strong>
                      <span className="cash-muted">
                        {row.client !== '—' ? `${row.client} · ` : ''}
                        {row.method}
                        {club === 'all' ? ` · ${row.club}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <Empty
                title="Операций нет"
                text="За выбранную дату с этими фильтрами ничего не найдено."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDate(TODAY);
                      setClub('all');
                      setPayment('all');
                    }}
                  >
                    Сбросить фильтры
                  </Button>
                }
              />
            )}
            <div className="cash-summary">
              <Stats
                items={[
                  { label: 'Приход денег', value: rubles(totals.income) },
                  { label: 'Расход денег', value: rubles(totals.expense) },
                  {
                    label: 'Оплата на сайте',
                    value: rubles(totals.website),
                    note: `Платежей: ${rows.filter((row) => row.website > 0).length}`,
                  },
                ]}
              />
            </div>
            <div className="cash-footer">
              <span>Операции: {rows.length} · итоги по фильтрам</span>
              <span>
                Приход − расход: <strong>{rubles(totals.income - totals.expense)}</strong>
              </span>
            </div>
            <details className="cash-explanation">
              <summary>Как считаются суммы</summary>
              <p>
                Приход включает полученные наличные, оплату картой и на сайте, а также внесение
                размена. Расход включает возвраты и снятие наличных. Это движение денег, а не
                выручка. Списание с подарочной карты ({rubles(totals.gift)}) и долг (
                {rubles(totals.credit)}) показаны отдельно в операциях.
              </p>
            </details>
          </>
        ) : (
          <div className="cash-equipment ws-panel-body">
            <Notice>
              Демооборудование · {prettyDate(TODAY)}. Действия меняют только примеры в этом
              прототипе, без печати и связи с кассой или банком.
            </Notice>
            {equipmentUnavailable ? (
              <Empty
                title="Выберите клуб"
                text="Для просмотра оборудования нужен конкретный клуб."
              />
            ) : tab === 'kkm' ? (
              <>
                <div className="cash-shift-line">
                  <div>
                    <h2>Касса №1</h2>
                    <span className="cash-muted">Демосмена №{shiftNumber}</span>
                  </div>
                  <span className="cash-shift-status">
                    {isOpen ? 'Смена открыта' : 'Смена закрыта'}
                  </span>
                </div>
                <div className="cash-command-grid">
                  <Button variant="secondary" disabled={isOpen} onClick={() => setCommand('open')}>
                    Открыть смену
                  </Button>
                  <Button variant="secondary" disabled={!isOpen} onClick={() => setCommand('x')}>
                    X-отчёт
                  </Button>
                  <Button variant="secondary" disabled={!isOpen} onClick={() => setCommand('z')}>
                    Z-отчёт и закрытие
                  </Button>
                  <Button variant="secondary" onClick={() => setCommand('balance')}>
                    Наличные в кассе
                  </Button>
                  <Button variant="secondary" onClick={() => setCommand('state')}>
                    Состояние кассы
                  </Button>
                </div>
                <div className="cash-movement-actions">
                  <Button
                    variant="secondary"
                    disabled={!isOpen}
                    onClick={() => startMovement('deposit')}
                  >
                    <ArrowDownLeft size={18} />
                    Внести наличные
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!isOpen}
                    onClick={() => startMovement('withdrawal')}
                  >
                    <ArrowUpRight size={18} />
                    Снять наличные
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="cash-shift-line">
                  <div>
                    <h2>Банковский терминал</h2>
                    <span className="cash-muted">{club}</span>
                  </div>
                  <span className="cash-shift-status">
                    {data['cash-terminals']?.find((row) => row.club === club)?.status === 'Закрыта'
                      ? 'Смена закрыта'
                      : 'Смена открыта'}
                  </span>
                </div>
                <div className="cash-command-grid">
                  <Button variant="secondary" onClick={() => setCommand('short')}>
                    <CreditCard size={18} />
                    Краткие итоги
                  </Button>
                  <Button variant="secondary" onClick={() => setCommand('full')}>
                    Полные итоги
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={data['cash-terminals']?.some(
                      (row) => row.club === club && row.status === 'Закрыта',
                    )}
                    onClick={() => setCommand('terminalClose')}
                  >
                    Закрыть смену по картам
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
      {tab === 'journal' && (
        <section className="cash-balances">
          <h2>Расчётный остаток наличных</h2>
          <div>
            {balances.map(({ name, value }) => (
              <span key={name}>
                {name} <strong>{rubles(value)}</strong>
              </span>
            ))}
          </div>
          <p>
            На конец {prettyDate(date || TODAY)} · начальный демоостаток 1 000 ₽ в каждом клубе +
            все наличные операции до выбранной даты. Фильтр оплаты на остаток не влияет.
          </p>
        </section>
      )}
      {detail && (
        <Modal
          title={kinds[detail.kind]}
          subtitle="Демонстрационная операция · касса №1"
          onClose={closeDetail}
        >
          <div className="ws-form cash-dialog">
            <h3>{detail.name}</h3>
            <dl className="cash-facts">
              {Object.entries({
                'Дата и время': `${prettyDate(detail.date)} · ${detail.time || 'не указано'}`,
                Клуб: detail.club,
                Клиент: detail.client,
                Кассир: detail.cashier,
                Оплата: detail.method,
                Приход: rubles(cashFlow(detail).income),
                Расход: rubles(cashFlow(detail).expense),
                'Подарочная карта': rubles(detail.gift),
                'В долг': rubles(detail.credit),
                'Номер демочека': detail.receipt || 'Не сформирован',
                Комментарий: detail.comment || '—',
              }).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {detailMember && (
              <Button variant="secondary" onClick={() => onMember(detailMember)}>
                Открыть карточку клиента
              </Button>
            )}
            <Button variant="secondary" onClick={closeDetail}>
              Закрыть
            </Button>
          </div>
        </Modal>
      )}
      {movement && (
        <Modal
          title={movement === 'deposit' ? 'Внесение наличных' : 'Снятие наличных'}
          subtitle={`${club} · касса №1 · демосмена №${shiftNumber}`}
          onClose={closeMovement}
        >
          <form
            className="ws-form cash-dialog"
            onSubmit={(e) => {
              e.preventDefault();
              if (review) confirmMovement();
              else if (checkMovement()) setReview(true);
            }}
          >
            {review ? (
              <>
                <Notice tone="warning">
                  Проверьте операцию перед добавлением в демонстрационный журнал.
                </Notice>
                <dl className="cash-facts">
                  <div>
                    <dt>Сумма</dt>
                    <dd>{money(amount)}</dd>
                  </div>
                  <div>
                    <dt>Причина</dt>
                    <dd>{reason}</dd>
                  </div>
                  <div>
                    <dt>Использование ККМ</dt>
                    <dd>{fiscal ? 'Включено в демопример' : 'Без ККМ'}</dd>
                  </div>
                  <div>
                    <dt>Наличные после операции</dt>
                    <dd>
                      {rubles(
                        currentBalance + Number(amount) * 100 * (movement === 'deposit' ? 1 : -1),
                      )}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <label className="form-field">
                  <span>Сумма, ₽</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Причина</span>
                  <textarea
                    required
                    value={reason}
                    maxLength={300}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <label className="cash-checkbox">
                  <input
                    type="checkbox"
                    checked={fiscal}
                    onChange={(e) => setFiscal(e.target.checked)}
                  />
                  Использовать ККМ в демопримере
                </label>
                <span className="cash-muted">Доступно наличными: {rubles(currentBalance)}</span>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="cash-dialog-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={review ? () => setReview(false) : closeMovement}
              >
                {review ? 'Назад' : 'Отмена'}
              </Button>
              <Button type="submit">{review ? 'Подтвердить демооперацию' : 'Проверить'}</Button>
            </div>
          </form>
        </Modal>
      )}
      {command && (
        <Modal
          title={commands[command]}
          subtitle={`${club} · демонстрация оборудования`}
          onClose={closeCommand}
        >
          <div className="ws-form cash-dialog">
            <Notice>
              {command === 'z' || command === 'terminalClose'
                ? 'Подтвердите закрытие демосмены. Реальное оборудование не подключено.'
                : 'Это предварительный просмотр. Команда реальному оборудованию не отправляется.'}
            </Notice>
            {command === 'state' ? (
              <dl className="cash-facts">
                <div>
                  <dt>Касса</dt>
                  <dd>№1 · {club}</dd>
                </div>
                <div>
                  <dt>Демосмена №{shiftNumber}</dt>
                  <dd>{isOpen ? 'Открыта' : 'Закрыта'}</dd>
                </div>
                <div>
                  <dt>Оборудование</dt>
                  <dd>Не подключено</dd>
                </div>
              </dl>
            ) : command === 'open' ? (
              <p>Будет открыта демосмена №{Number(shiftNumber) + 1}.</p>
            ) : command === 'balance' ? (
              <p>
                Расчётный остаток наличных: <strong>{rubles(currentBalance)}</strong>
              </p>
            ) : ['short', 'full', 'terminalClose'].includes(command) ? (
              <>
                <dl className="cash-facts">
                  <div>
                    <dt>Оплаты картой за демодень</dt>
                    <dd>{cardRows.filter((row) => row.kind === 'sale').length}</dd>
                  </div>
                  <div>
                    <dt>Возвраты по карте</dt>
                    <dd>{cardRows.filter((row) => row.kind === 'refund').length}</dd>
                  </div>
                  <div>
                    <dt>Итого по карте</dt>
                    <dd>{rubles(cardTotal)}</dd>
                  </div>
                </dl>
                {command === 'full' &&
                  cardRows.map((row) => (
                    <p key={row.id}>
                      {row.time || '—'} · {row.name} · {rubles(row.card)}
                    </p>
                  ))}
                <p className="cash-muted">
                  Оплаты сайта не относятся к терминалу. Итоги рассчитаны по журналу за{' '}
                  {prettyDate(TODAY)}, без банковской сверки.
                </p>
              </>
            ) : (
              <>
                <Stats
                  items={[
                    { label: 'Приход за демодень', value: rubles(cashTotals(dayRows).income) },
                    { label: 'Расход за демодень', value: rubles(cashTotals(dayRows).expense) },
                  ]}
                />
                <p className="cash-muted">
                  Предварительный отчёт по журналу за {prettyDate(TODAY)}. Фискальный X/Z-отчёт не
                  формируется.
                </p>
              </>
            )}
            <div className="cash-dialog-actions">
              <Button variant="secondary" onClick={closeCommand}>
                {['open', 'z', 'terminalClose'].includes(command) ? 'Отмена' : 'Закрыть'}
              </Button>
              {['open', 'z', 'terminalClose'].includes(command) && (
                <Button onClick={confirmCommand}>Подтвердить демодействие</Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
