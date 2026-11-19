import { ProductCard } from '../components/ProductCard';
import { QuantityStepper } from '../components/QuantityStepper';
import { useState } from 'react';
import { Button } from '../components/ui';
import { Empty, Notice, SearchBox } from '../components/WorkspaceUI';
import { ReceptionPayment, initialReceptionPayment } from '../components/ReceptionPayment';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import type { DemoRecord } from '../data/workspace';
import { money } from '../data/workspace';
import { retailSale } from '../lib/reception-operations';
import { demoStamp, nextDemoNow } from '../lib/demo-clock';

export function RetailWorkspace({
  clubName,
  employeeName,
  members,
}: {
  clubName: string;
  employeeName: string;
  members: import('../types').Member[];
}) {
  const { data, transact } = useWorkspace();
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState(initialReceptionPayment);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const products = (data['retail-products'] || []).filter((row) => row.status === 'Активен');
  const rows = products
    .filter((row) => cart[row.id])
    .map((row): DemoRecord => ({ ...row, quantity: String(cart[row.id]) }));
  const total =
    rows.reduce((sum, row) => sum + Math.round(Number(row.price) * 100) * cart[row.id], 0) / 100;
  return (
    <div className="reception-retail-layout" data-ui="retail-sale">
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <h2>Товары ресепшена</h2>
        </div>
        <div className="ws-panel-body ws-stack">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Название, артикул или штрихкод"
          />
          <div className="reception-product-grid">
            {products
              .filter((row) =>
                Object.values(row)
                  .join(' ')
                  .toLocaleLowerCase('ru')
                  .includes(query.toLocaleLowerCase('ru')),
              )
              .map((row) => (
                <ProductCard
                  product={row}
                  quantity={cart[row.id] || 0}
                  key={row.id}
                  onAdd={() => {
                    setCart((current) => ({
                      ...current,
                      [row.id]: Math.min(999, Number(row.stock), (current[row.id] || 0) + 1),
                    }));
                    setDone(false);
                    setError('');
                  }}
                />
              ))}
          </div>
        </div>
      </section>
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <h2>Покупка</h2>
        </div>
        <div className="ws-panel-body ws-stack">
          {done ? (
            <>
              <Notice tone="success">
                {payment.method === 'В кредит' ||
                (payment.method === 'Составная оплата' && payment.parts.credit > 0)
                  ? 'Покупка оформлена. Задолженность сохранена за выбранным клиентом.'
                  : payment.method === 'Подарочная карта'
                    ? 'Покупка оформлена. Средства списаны с подарочной карты.'
                    : 'Товары оплачены. Остатки обновлены, операция сохранена в кассе.'}
              </Notice>
              <Button
                onClick={() => {
                  setDone(false);
                  setCart({});
                }}
              >
                Новая покупка
              </Button>
            </>
          ) : rows.length ? (
            <>
              <ul className="retail-cart-list" aria-label="Товары в покупке">
                {rows.map((row) => (
                  <li key={row.id}>
                    <div className="retail-cart-heading">
                      <strong>{row.name}</strong>
                      <b>{money(Number(row.price) * cart[row.id])}</b>
                    </div>
                    <div className="retail-cart-controls">
                      <QuantityStepper
                        label="Количество"
                        itemName={row.name}
                        value={cart[row.id]}
                        max={Math.min(999, Number(row.stock))}
                        onChange={(value) => {
                          setCart((current) => ({ ...current, [row.id]: value }));
                          setError('');
                        }}
                      />
                      <Button
                        variant="ghost"
                        aria-label={`Убрать: ${row.name}`}
                        onClick={() =>
                          setCart((current) => {
                            const next = { ...current };
                            delete next[row.id];
                            return next;
                          })
                        }
                      >
                        Убрать
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <ReceptionPayment
                members={members}
                value={payment}
                onChange={setPayment}
                total={total}
              />
              {error && <Notice tone="warning">{error}</Notice>}
              <Button
                onClick={() => {
                  try {
                    const stamp = demoStamp(nextDemoNow());
                    transact((current) =>
                      retailSale(
                        current,
                        cart,
                        {
                          id: demoId('retail-sale'),
                          date: stamp.slice(0, 10),
                          time: stamp.slice(11),
                          cashier: employeeName,
                          club: clubName.split(' · ').at(-1)!,
                        },
                        payment,
                      ),
                    );
                    setDone(true);
                    setCart({});
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              >
                {payment.method === 'В кредит'
                  ? 'Оформить в кредит'
                  : payment.method === 'Подарочная карта'
                    ? 'Списать с подарочной карты'
                    : payment.method === 'Составная оплата'
                      ? 'Подтвердить покупку'
                      : 'Оплатить'}{' '}
                {money(total)}
              </Button>
            </>
          ) : (
            <Empty
              title="Выберите товары"
              text="Добавьте нужные позиции из каталога. Карточка клиента не требуется."
            />
          )}
        </div>
      </section>
    </div>
  );
}
