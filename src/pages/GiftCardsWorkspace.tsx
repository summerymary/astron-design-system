import { Field } from '../components/Field';
import { useState } from 'react';
import { Plus, ShoppingBag } from 'lucide-react';
import type { DemoRecord } from '../data/workspace';
import { money } from '../data/workspace';
import type { Member, DemoUser } from '../types';
import { demoStamp, nextDemoNow } from '../lib/demo-clock';
import { canIssueGiftWithoutPayment, issueGift, redeemGift } from '../lib/reception-operations';
import { clientName } from '../lib/client-display';
import { Button, ConfirmDialog, Modal } from '../components/ui';
import { ClientSearch } from '../components/ClientSearch';
import { DataTable, Notice, SearchBox, Tabs } from '../components/WorkspaceUI';
import { ReceptionPayment, initialReceptionPayment } from '../components/ReceptionPayment';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';

export function GiftCardsWorkspace({
  members,
  user,
  clubName,
  initialMember,
}: {
  members: Member[];
  user: DemoUser;
  clubName: string;
  initialMember: Member | null;
}) {
  const { data, transact } = useWorkspace();
  const [tab, setTab] = useState('Карты');
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState<string | null>(null);
  const [mode, setMode] = useState<'sell' | 'issue' | 'online' | null>(
    initialMember ? 'sell' : null,
  );
  const [order, setOrder] = useState<DemoRecord | null>(null);
  const [number, setNumber] = useState('');
  const [nominal, setNominal] = useState('3000');
  const [comment, setComment] = useState('');
  const [owner, setOwner] = useState<Member | null>(null);
  const [buyer, setBuyer] = useState<Member | null>(initialMember);
  const [payment, setPayment] = useState(initialReceptionPayment);
  const [amount, setAmount] = useState('');
  const [debitComment, setDebitComment] = useState('');
  const [confirmDebit, setConfirmDebit] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const card = (data['gift-cards'] || []).find((row) => row.id === opened);
  const start = (next: NonNullable<typeof mode>, onlineOrder?: DemoRecord) => {
    if (next === 'issue' && !canIssueGiftWithoutPayment(user.role)) return;
    setMode(next);
    setOrder(onlineOrder || null);
    setNumber('');
    setNominal(onlineOrder?.amount || '3000');
    setComment('');
    setOwner(null);
    setBuyer(initialMember);
    setPayment(initialReceptionPayment());
    setError('');
  };
  const save = () => {
    try {
      const stamp = demoStamp(nextDemoNow());
      const input = {
        id: demoId('gift'),
        name: number,
        nominal,
        comment,
        ownerId: owner ? String(owner.id) : '',
        buyerId: buyer ? String(buyer.id) : '',
        buyer: buyer ? clientName(buyer) : '',
        date: stamp.slice(0, 10),
        time: stamp.slice(11),
        club: clubName.split(' · ').at(-1)!,
        cashier: user.name,
        orderId: order?.id || '',
      };
      transact((current) =>
        issueGift(current, input, mode === 'sell' ? payment : undefined, user.role),
      );
      setMode(null);
      setOpened(input.id);
      setTab('Карты');
      setMessage(
        mode === 'sell'
          ? 'Подарочная карта продана. Оплата сохранена в кассе.'
          : 'Подарочная карта выдана.',
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const cards = (data['gift-cards'] || []).filter((row) =>
    `${row.name} ${row.comment || ''}`
      .toLocaleLowerCase('ru')
      .includes(query.toLocaleLowerCase('ru')),
  );
  return (
    <div className="ws-stack" data-ui="gift-cards">
      {message && <Notice tone="success">{message}</Notice>}
      <section className="panel ws-panel">
        <header className="ws-panel-heading">
          <h2>Подарочные карты</h2>
          <div className="ws-actions" role="group" aria-label="Действия с подарочными картами">
            <Button onClick={() => start('sell')}>
              <ShoppingBag size={18} /> Продать карту
            </Button>
            {canIssueGiftWithoutPayment(user.role) && (
              <Button variant="secondary" onClick={() => start('issue')}>
                <Plus size={18} /> Выдать без оплаты
              </Button>
            )}
          </div>
        </header>
        <div className="ws-panel-body ws-stack">
          <Tabs
            items={['Карты', 'Онлайн-заказы']}
            value={tab}
            onChange={setTab}
            label="Подарочные карты"
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Номер карты или комментарий" />
        </div>
        {tab === 'Карты' ? (
          <DataTable
            rows={cards}
            columns={[
              { key: 'name', label: 'Номер карты' },
              { key: 'comment', label: 'Комментарий' },
              { key: 'date', label: 'Дата выдачи' },
              { key: 'source', label: 'Выдача' },
              { key: 'cashier', label: 'Кем выдана' },
              { key: 'balance', label: 'Остаток', render: (row) => money(row.balance) },
              { key: 'status', label: 'Состояние' },
            ]}
            onOpen={(row) => {
              setOpened(row.id);
              setError('');
              setAmount('');
              setDebitComment('');
            }}
          />
        ) : (
          <DataTable
            rows={(data['gift-orders'] || []).filter((row) =>
              `${row.name} ${row.buyer} ${row.recipient}`
                .toLocaleLowerCase('ru')
                .includes(query.toLocaleLowerCase('ru')),
            )}
            columns={[
              { key: 'name', label: 'Заказ' },
              { key: 'buyer', label: 'Покупатель' },
              { key: 'recipient', label: 'Для кого' },
              { key: 'amount', label: 'Номинал', render: (row) => money(row.amount) },
              { key: 'delivery', label: 'Получение' },
              { key: 'status', label: 'Состояние' },
              {
                key: 'action',
                label: 'Действие',
                render: (row) => (
                  <Button
                    variant="secondary"
                    disabled={row.status !== 'Оплачен'}
                    onClick={() => start('online', row)}
                  >
                    {row.status === 'Оплачен' ? 'Выдать карту' : 'Выдана'}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </section>
      {mode && (
        <Modal
          title={
            mode === 'sell'
              ? 'Продажа подарочной карты'
              : mode === 'online'
                ? 'Выдать онлайн-заказ'
                : 'Выдать карту без оплаты'
          }
          onClose={() => setMode(null)}
          size="wide"
        >
          <div className="modal-scroll-body ws-stack">
            {order && (
              <Notice>
                {order.name} · {order.buyer} → {order.recipient}. Оплата уже получена онлайн;
                повторная оплата не требуется.
              </Notice>
            )}
            <div className="reception-payment-parts">
              <Field className="form-field" label={<> Номер подарочной карты * </>}>
                <input
                  required
                  value={number}
                  maxLength={32}
                  onChange={(event) => setNumber(event.target.value)}
                />
              </Field>
              <Field className="form-field" label={<> Номинал, ₽ * </>}>
                <input
                  required
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  readOnly={mode === 'online'}
                  value={nominal}
                  onChange={(event) => setNominal(event.target.value)}
                />
              </Field>
            </div>
            {mode !== 'online' && (
              <div className="ws-actions">
                {[1500, 3000, 10000, 15000, 20000].map((value) => (
                  <Button
                    key={value}
                    variant="secondary"
                    aria-pressed={nominal === String(value)}
                    onClick={() => setNominal(String(value))}
                  >
                    {money(value)}
                  </Button>
                ))}
              </div>
            )}
            {mode === 'issue' && (
              <div>
                <h3>Владелец *</h3>
                {owner ? (
                  <div className="ws-list-line">
                    <strong>{clientName(owner)}</strong>
                    <Button variant="ghost" onClick={() => setOwner(null)}>
                      Изменить
                    </Button>
                  </div>
                ) : (
                  <ClientSearch
                    members={members}
                    mode="selection"
                    purpose="покупки"
                    hidePhones={user.role === 'administrator'}
                    onMember={setOwner}
                  />
                )}
              </div>
            )}
            {mode !== 'online' && (
              <div>
                <h3>Покупатель · необязательно</h3>
                {buyer ? (
                  <div className="ws-list-line">
                    <strong>{clientName(buyer)}</strong>
                    <Button variant="ghost" onClick={() => setBuyer(null)}>
                      Убрать
                    </Button>
                  </div>
                ) : (
                  <ClientSearch
                    members={members}
                    mode="selection"
                    purpose="покупки"
                    hidePhones={user.role === 'administrator'}
                    onMember={setBuyer}
                  />
                )}
              </div>
            )}
            <Field
              className="form-field"
              label={<> {mode === 'issue' ? 'Основание выдачи *' : 'Комментарий'} </>}
            >
              <textarea
                value={comment}
                rows={2}
                maxLength={1000}
                onChange={(event) => setComment(event.target.value)}
              />
            </Field>
            {mode === 'sell' ? (
              <ReceptionPayment
                value={payment}
                onChange={setPayment}
                total={Number(nominal) || 0}
              />
            ) : mode === 'issue' ? (
              <Notice tone="warning">
                Выдача создаст баланс без поступления денег в кассу. Основание укажите в
                комментарии.
              </Notice>
            ) : null}
            {error && <Notice tone="warning">{error}</Notice>}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setMode(null)}>
              Отмена
            </Button>
            <Button onClick={save}>{mode === 'sell' ? 'Оплатить и выдать' : 'Выдать карту'}</Button>
          </div>
        </Modal>
      )}
      {card && !mode && (
        <Modal title={`Подарочная карта ${card.name}`} onClose={() => setOpened(null)} size="wide">
          <div className="modal-scroll-body ws-stack">
            <h3>Остаток: {money(card.balance)}</h3>
            <p>
              {card.comment || 'Без комментария'} · {card.status}
            </p>
            <DataTable
              rows={(data['gift-history'] || []).filter((row) => row.cardId === card.id)}
              columns={[
                { key: 'date', label: 'Когда' },
                { key: 'name', label: 'Операция' },
                { key: 'amount', label: 'Сумма', render: (row) => money(row.amount) },
                { key: 'balance', label: 'Остаток', render: (row) => money(row.balance) },
                { key: 'comment', label: 'Комментарий' },
              ]}
              empty={<p>История начинается с операций в этом прототипе.</p>}
            />
            {card.status === 'Активна' && (
              <>
                <h3>Списать с баланса</h3>
                <Field className="form-field" label={<> Сумма, ₽ </>}>
                  <input
                    type="number"
                    min="0.01"
                    max={card.balance}
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </Field>
                <Field className="form-field" label={<> Основание списания * </>}>
                  <input
                    value={debitComment}
                    onChange={(event) => setDebitComment(event.target.value)}
                  />
                </Field>
                <Button
                  variant="accent"
                  disabled={!debitComment.trim() || !Number(amount)}
                  onClick={() => setConfirmDebit(true)}
                >
                  Списать…
                </Button>
              </>
            )}
            {error && <Notice tone="warning">{error}</Notice>}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setOpened(null)}>
              Закрыть
            </Button>
          </div>
        </Modal>
      )}
      {confirmDebit && card && (
        <ConfirmDialog
          title="Списать с подарочной карты?"
          subject={`${card.name} · ${money(amount)}`}
          description="Остаток уменьшится. Деньги в кассу повторно не поступят; операция останется в истории карты."
          confirmLabel="Подтвердить списание"
          onClose={() => setConfirmDebit(false)}
          onConfirm={() => {
            try {
              transact((current) =>
                redeemGift(current, card.id, Number(amount), {
                  id: demoId('gift-debit'),
                  date: demoStamp(nextDemoNow()),
                  name: 'Списание',
                  comment: debitComment.trim(),
                }),
              );
              setConfirmDebit(false);
              setAmount('');
              setDebitComment('');
              setError('');
            } catch (err) {
              setError((err as Error).message);
              setConfirmDebit(false);
            }
          }}
        />
      )}
    </div>
  );
}
