import { Field } from '../components/Field';
import { useState } from 'react';
import { Button } from '../components/ui';
import { DataTable, Empty, Notice, SearchBox } from '../components/WorkspaceUI';
import { ReceptionPayment, initialReceptionPayment } from '../components/ReceptionPayment';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import type { DemoRecord } from '../data/workspace';
import { money } from '../data/workspace';
import { retailSale } from '../lib/reception-operations';
import { demoStamp, nextDemoNow } from '../lib/demo-clock';

export function RetailWorkspace({
  clubName,
  employeeName,
}: {
  clubName: string;
  employeeName: string;
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
                <button
                  className="ws-link-card reception-product"
                  key={row.id}
                  disabled={!Number(row.stock)}
                  onClick={() => {
                    setCart((current) => ({
                      ...current,
                      [row.id]: Math.min(Number(row.stock), (current[row.id] || 0) + 1),
                    }));
                    setDone(false);
                    setError('');
                  }}
                >
                  <strong>{row.name}</strong>
                  <span>{money(row.price)}</span>
                  <small>
                    В наличии: {row.stock} {row.unit}
                  </small>
                </button>
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
                Товары оплачены. Остатки обновлены, операция сохранена в кассе.
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
              <DataTable
                rows={rows}
                columns={[
                  { key: 'name', label: 'Товар' },
                  {
                    key: 'quantity',
                    label: 'Количество',
                    render: (row) => (
                      <Field className="form-field" label={<> Количество: {row.name} </>}>
                        <input
                          type="number"
                          min="1"
                          max={row.stock}
                          value={cart[row.id]}
                          onChange={(event) => {
                            setCart((current) => ({
                              ...current,
                              [row.id]: Math.max(
                                1,
                                Math.min(
                                  Number(row.stock),
                                  Math.floor(Number(event.target.value)) || 1,
                                ),
                              ),
                            }));
                            setError('');
                          }}
                        />
                      </Field>
                    ),
                  },
                  {
                    key: 'action',
                    label: 'Убрать',
                    render: (row) => (
                      <Button
                        variant="ghost"
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
                    ),
                  },
                ]}
              />
              <ReceptionPayment value={payment} onChange={setPayment} total={total} />
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
                Оплатить {money(total)}
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
