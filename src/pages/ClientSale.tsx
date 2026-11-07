import { useState } from 'react';
import type { Member } from '../types';
import type { Navigate } from '../components/WorkspaceUI';
import { Button } from '../components/ui';
import { Tabs, Notice, Empty } from '../components/WorkspaceUI';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { MembershipCard } from '../components/MembershipCard';
import { quantityLabel } from '../data/membership-kinds';
import { money, TODAY } from '../data/workspace';
import type { DemoRecord } from '../data/workspace';

const services: DemoRecord[] = [
  { id: 'service-towel', name: 'Прокат полотенца', price: '100' },
  { id: 'service-locker', name: 'Аренда шкафчика на месяц', price: '500' },
];
export function SaleWorkspace({
  members,
  initialMember,
  navigate,
  clubName,
}: {
  members: Member[];
  initialMember: Member | null;
  navigate: Navigate;
  clubName: string;
}) {
  const { data, put } = useWorkspace();
  const [memberId, setMemberId] = useState(String(initialMember?.id || ''));
  const [category, setCategory] = useState('Абонементы');
  const [itemId, setItemId] = useState('');
  const [method, setMethod] = useState('Карта');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const member = members.find((member) => String(member.id) === memberId);
  const isPlan = category === 'Абонементы' || category === 'Персональный тренинг';
  const items = isPlan
    ? data.plans.filter(
        (row) =>
          row.status === 'Опубликован' &&
          (category !== 'Персональный тренинг' || row.kindId === 'personal'),
      )
    : category === 'Товары'
      ? data.products.filter((row) => row.status !== 'В архиве')
      : services;
  const item = items.find((row) => row.id === itemId);
  return (
    <div className="ws-stack">
      <div className="ws-actions">
        <Button variant="secondary" onClick={() => navigate('registration', member)}>
          К регистрации посещения
        </Button>
      </div>
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>Продажа клиенту</h2>
            <p>Выберите категорию, позицию и проверьте сумму.</p>
          </div>
        </div>
        <div className="ws-panel-body">
          <label className="form-field">
            <span>Клиент</span>
            <select
              value={memberId}
              onChange={(e) => {
                setMemberId(e.target.value);
                setDone(false);
              }}
            >
              <option value="">Выберите клиента</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Tabs
          items={['Абонементы', 'Товары', 'Услуги', 'Персональный тренинг']}
          value={category}
          onChange={(value) => {
            setCategory(value);
            setItemId('');
            setDone(false);
            setError('');
          }}
          label="Что продать"
        />
        <div className="ws-panel-body">
          <div className="plastic-card-grid">
            {items.map((row) => (
              <button
                className="plastic-choice"
                aria-pressed={itemId === row.id}
                key={row.id}
                onClick={() => {
                  setItemId(row.id);
                  setDone(false);
                  setError('');
                }}
              >
                {isPlan ? (
                  <MembershipCard
                    name={row.name}
                    kindId={row.kindId}
                    detail={
                      row.type === 'Безлимитный'
                        ? `${quantityLabel(row.duration, 'day')} · без ограничений`
                        : `${quantityLabel(row.visits, 'visit')} · ${quantityLabel(row.duration, 'day')}`
                    }
                    footer={money(row.price)}
                  />
                ) : (
                  <span className="sale-item">
                    <strong>{row.name}</strong>
                    <span>{money(row.price)}</span>
                    {category === 'Товары' && <small>В наличии: {row.stock}</small>}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <h2>Подтверждение продажи</h2>
        </div>
        <div className="ws-panel-body ws-stack">
          {member && item ? (
            <>
              <p>
                {member.name} · {item.name}
              </p>
              <strong className="ws-price">{money(item.price)}</strong>
              <label className="form-field">
                <span>Способ оплаты</span>
                <select value={method} disabled={done} onChange={(e) => setMethod(e.target.value)}>
                  <option>Карта</option>
                  <option>Наличные</option>
                </select>
              </label>
              <Notice>Демонстрационная продажа. Реальная оплата не производится.</Notice>
              <Button
                disabled={done}
                onClick={() => {
                  if (done) return;
                  if (
                    category === 'Товары' &&
                    (!Number.isFinite(Number(item.stock)) || Number(item.stock) < 1)
                  ) {
                    setError('Товар закончился. Выберите другую позицию.');
                    return;
                  }
                  put('ledger', {
                    id: demoId('sale'),
                    name: item.name,
                    category,
                    date: TODAY,
                    club: clubName.split(' · ').at(-1) || 'Центральный',
                    client: member.name,
                    memberId,
                    amount: item.price,
                    method,
                    status: 'Оплачено',
                  });
                  if (isPlan)
                    put('issued-plans', { ...item, id: demoId('issued'), memberId, issued: TODAY });
                  else if (category === 'Товары')
                    put('products', { ...item, stock: String(Number(item.stock) - 1) });
                  else
                    put('issued-services', {
                      ...item,
                      id: demoId('service'),
                      memberId,
                      issued: TODAY,
                    });
                  setDone(true);
                }}
              >
                {done ? 'Продажа сохранена' : 'Подтвердить демопродажу'}
              </Button>
              {error && <p role="alert">{error}</p>}
              {done && (
                <Notice tone="success">
                  Продажа появилась в кассе и финансах клиента.
                  {isPlan && ' Карта добавлена клиенту и доступна для регистрации посещения.'}
                </Notice>
              )}
            </>
          ) : (
            <Empty title="Выберите клиента и позицию для продажи" />
          )}
        </div>
      </section>
    </div>
  );
}
