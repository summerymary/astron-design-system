import { Select } from '../components/Select';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Building2,
  ChevronRight,
  CreditCard,
  Dumbbell,
  Gift,
  Layers,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import type { Member } from '../types';
import type { Navigate } from '../components/WorkspaceUI';
import { Button, Modal } from '../components/ui';
import { Notice, Empty } from '../components/WorkspaceUI';
import { ClientSearch } from '../components/ClientSearch';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { MembershipCard } from '../components/MembershipCard';
import { quantityLabel } from '../data/membership-kinds';
import { memberCards } from '../data/admin';
import { money, TODAY } from '../data/workspace';
import type { DemoRecord } from '../data/workspace';
import { paymentMethods, paymentPlan, saleTotal } from '../lib/checkout';
import type { PaymentMethod, PaymentParts } from '../lib/checkout';

import { saleCatalog, saleSections, searchSaleCatalog } from '../lib/sale-catalog';
import type { SaleCatalogItem, SaleSectionId } from '../lib/sale-catalog';
const sectionIcons = {
  memberships: Dumbbell,
  personal: UserRound,
  corporate: Building2,
  exceptions: Sparkles,
  'goods-services': ShoppingBag,
};
const methodIcons = [Banknote, CreditCard, Gift, Wallet, Layers];
export function SaleWorkspace({
  members,
  initialMember,
  navigate,
  clubName,
  initialSection = null,
}: {
  members: Member[];
  initialMember: Member | null;
  navigate: Navigate;
  clubName: string;
  initialSection?: SaleSectionId | null;
}) {
  const { data, put } = useWorkspace();
  const [memberId, setMemberId] = useState(String(initialMember?.id || ''));
  const [sectionId, setSectionId] = useState<SaleSectionId | null>(initialSection);
  const [query, setQuery] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('0');
  const [method, setMethod] = useState<PaymentMethod>('Безналичная оплата');
  const [parts, setParts] = useState<PaymentParts>({ cash: 0, card: 0, gift: 0, credit: 0 });
  const [giftId, setGiftId] = useState('');
  const [printReceipt, setPrintReceipt] = useState(true);
  const [receipt, setReceipt] = useState<DemoRecord | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const closeReceipt = useCallback(() => setReceiptOpen(false), []);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [debt, setDebt] = useState(0);
  const member = members.find((member) => String(member.id) === memberId);
  const catalog = saleCatalog(data);
  const selected = catalog.find((entry) => entry.record.id === itemId);
  const item = selected?.record;
  const isPlan = selected?.type === 'plan';
  const category =
    selected?.type === 'product'
      ? 'Товары'
      : selected?.type === 'service'
        ? 'Услуги'
        : saleSections.find((section) => section.id === selected?.sectionId)?.name || 'Абонементы';
  const visibleItems = searchSaleCatalog(catalog, query, sectionId);
  const currentSection = saleSections.find((section) => section.id === sectionId);
  let pricing = { base: 0, discount: 0, total: 0 };
  let calculationError = '';
  try {
    if (item) pricing = saleTotal(Number(item.price), Number(quantity), Number(discount));
  } catch (err) {
    calculationError = err instanceof Error ? err.message : 'Проверьте сумму.';
  }
  useEffect(() => setParts({ cash: 0, card: pricing.total, gift: 0, credit: 0 }), [pricing.total]);
  const gift = (data['gift-cards'] || []).find(
    (row) => row.id === giftId && row.status === 'Активна',
  );
  const clearResult = () => {
    setDone(false);
    setError('');
    setReceipt(null);
    setReceiptOpen(false);
    setDebt(0);
  };
  const confirm = () => {
    if (!member || !item || done || calculationError) return;
    try {
      const payment = paymentPlan(
        pricing.total,
        method,
        parts,
        gift ? Number(gift.balance) : undefined,
      );
      if (
        category === 'Товары' &&
        (!Number.isFinite(Number(item.stock)) || Number(item.stock) < Number(quantity))
      )
        throw new Error('Недостаточно товара. Уменьшите количество.');
      const id = demoId('sale');
      const paid = Math.round((pricing.total - payment.credit) * 100) / 100;
      const details: DemoRecord = {
        id,
        name: item.name,
        description: item.short || item.description || item.name,
        category,
        date: TODAY,
        club: clubName.split(' · ').at(-1) || 'Центральный',
        client: member.fullName || member.name,
        memberId,
        amount: String(paid),
        total: String(pricing.total),
        basePrice: String(pricing.base),
        discount: String(discount),
        discountAmount: String(pricing.discount),
        quantity,
        method,
        cashAmount: String(payment.cash),
        cardAmount: String(payment.card),
        giftAmount: String(payment.gift),
        creditAmount: String(payment.credit),
        status: payment.credit ? (paid ? 'Частичная оплата' : 'В долг') : 'Оплачено',
        receiptRequested: String(printReceipt),
      };
      put('ledger', details);
      if (payment.gift && gift)
        put('gift-cards', {
          ...gift,
          balance: String(Math.round((Number(gift.balance) - payment.gift) * 100) / 100),
        });
      if (payment.credit)
        put('receivables', {
          id: `debt-${id}`,
          memberId,
          name: member.name,
          saleId: id,
          amount: String(payment.credit),
          date: TODAY,
          status: 'Не погашено',
        });
      if (isPlan) put('issued-plans', { ...item, id: demoId('issued'), memberId, issued: TODAY });
      else if (category === 'Товары')
        put('retail-products', { ...item, stock: String(Number(item.stock) - Number(quantity)) });
      else put('issued-services', { ...item, id: demoId('service'), memberId, issued: TODAY });
      if (printReceipt) {
        const next = {
          ...details,
          id: `receipt-${id}`,
          saleId: id,
          card: memberCards[member.id] || String(member.id + 99000),
        };
        put('receipts', next);
        setReceipt(next);
      }
      setDebt(payment.credit);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подтвердить продажу.');
    }
  };
  const openSection = (id: SaleSectionId | null) => {
    setSectionId(id);
    setQuery('');
    setItemId('');
    setQuantity('1');
    setDiscount('0');
    clearResult();
  };
  const renderItem = (entry: SaleCatalogItem) => {
    const row = entry.record;
    return (
      <button
        className="plastic-choice"
        aria-pressed={itemId === row.id}
        key={row.id}
        onClick={() => {
          setSectionId(entry.sectionId);
          setItemId(row.id);
          setQuantity('1');
          setDiscount('0');
          clearResult();
        }}
      >
        {entry.type === 'plan' ? (
          <MembershipCard
            compact
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
            <small>{entry.type === 'product' ? 'Товар ресепшена' : 'Услуга'}</small>
            <strong>{row.name}</strong>
            <span>{money(row.price)}</span>
            {entry.type === 'product' && (
              <small>
                Остаток ({row.unit}): {row.stock}
              </small>
            )}
          </span>
        )}
      </button>
    );
  };
  return (
    <div className="ws-stack sale-workspace">
      <section className="panel ws-panel client-picker-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>1. Клиент</h2>
            <p>Найдите клиента по карте, ФИО или номеру телефона.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate('registration', member)}>
            К регистрации посещения
          </Button>
        </div>
        <div className="ws-panel-body ws-stack">
          <ClientSearch
            mode="selection"
            purpose="покупки"
            members={members}
            onMember={(next) => {
              setMemberId(String(next.id));
              setDiscount('0');
              setGiftId('');
              clearResult();
            }}
          />
          {member && (
            <div className="checkout-client">
              <strong>{member.fullName || member.name}</strong>
              <span>Карта {memberCards[member.id] || String(member.id + 99000)}</span>
              <span>
                {member.phone} · {member.email}
              </span>
            </div>
          )}
        </div>
      </section>
      <section className="panel ws-panel sale-catalog" aria-label="Каталог продажи">
        <div className="ws-panel-heading">
          <div>
            <h2>2. {currentSection?.name || 'Выбор покупки'}</h2>
            <p>
              {currentSection?.description || 'Выберите раздел или найдите покупку по названию.'}
            </p>
          </div>
        </div>
        <div className="ws-panel-body ws-stack">
          {sectionId && (
            <div className="ws-actions">
              <Button variant="ghost" onClick={() => openSection(null)}>
                <ArrowLeft size={16} /> Все разделы продажи
              </Button>
            </div>
          )}
          <div className="sale-name-search">
            <label htmlFor="sale-name-query">Поиск по названию</label>
            <div>
              <Search size={20} aria-hidden="true" />
              <input
                id="sale-name-query"
                type="search"
                value={query}
                placeholder={
                  sectionId ? 'Название в этом разделе' : 'Абонемент, тренировка, товар или услуга'
                }
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Очистить поиск по названию"
                  onClick={() => setQuery('')}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
          {!sectionId && !query.trim() ? (
            <div className="sale-section-grid">
              {saleSections.map((section) => {
                const Icon = sectionIcons[section.id];
                const count = catalog.filter((entry) => entry.sectionId === section.id).length;
                return (
                  <button
                    className="sale-section-link"
                    key={section.id}
                    onClick={() => openSection(section.id)}
                  >
                    <Icon size={22} aria-hidden="true" />
                    <span>
                      <strong>{section.name}</strong>
                      <small>{section.description}</small>
                    </span>
                    <b>{count}</b>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : visibleItems.length ? (
            <>
              <p className="form-note" role="status">
                Найдено позиций: {visibleItems.length}
              </p>
              {saleSections
                .filter((section) => visibleItems.some((entry) => entry.sectionId === section.id))
                .map((section) => {
                  const entries = visibleItems.filter((entry) => entry.sectionId === section.id);
                  return (
                    <div className="ws-stack" key={section.id}>
                      {!sectionId && <h3>{section.name}</h3>}
                      <div
                        className={`plastic-card-grid ${section.id === 'goods-services' ? 'sale-item-grid' : ''}`}
                      >
                        {entries.map(renderItem)}
                      </div>
                    </div>
                  );
                })}
            </>
          ) : (
            <Empty
              title={query.trim() ? 'Ничего не найдено' : 'Пока нет позиций'}
              text={
                query.trim()
                  ? 'Попробуйте другое название или более короткий запрос.'
                  : sectionId === 'exceptions'
                    ? 'Позиции и правила этого раздела будут уточнены.'
                    : 'Доступные позиции появятся после добавления в каталог.'
              }
              action={
                query.trim() ? (
                  <Button variant="secondary" onClick={() => setQuery('')}>
                    Сбросить поиск
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      </section>
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <h2>3. Оплата</h2>
        </div>
        <div className="ws-panel-body ws-stack">
          {member && item ? (
            <>
              <dl className="ws-facts checkout-facts">
                <div>
                  <dt>ФИО</dt>
                  <dd>{member.fullName || member.name}</dd>
                </div>
                <div>
                  <dt>Номер карты</dt>
                  <dd>{memberCards[member.id] || String(member.id + 99000)}</dd>
                </div>
                <div>
                  <dt>Контакты</dt>
                  <dd>
                    {member.phone} · {member.email}
                  </dd>
                </div>
                <div>
                  <dt>Наименование покупки</dt>
                  <dd>{item.name}</dd>
                </div>
                <div>
                  <dt>Описание</dt>
                  <dd>{item.short || item.description || item.name}</dd>
                </div>
                <div>
                  <dt>Цена за единицу</dt>
                  <dd>{money(item.price)}</dd>
                </div>
              </dl>
              <div className="ws-fields">
                {category === 'Товары' && (
                  <label className="form-field">
                    <span>Количество</span>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      step="1"
                      value={quantity}
                      disabled={done}
                      onChange={(e) => {
                        setQuantity(e.target.value);
                        setError('');
                      }}
                    />
                  </label>
                )}
                <label className="form-field">
                  <span>Применить скидку</span>
                  <Select
                    value={discount}
                    disabled={done}
                    onChange={(e) => {
                      setDiscount(e.target.value);
                      setError('');
                    }}
                  >
                    <option value="0">Без скидки</option>
                    <option value="5">5% · пример</option>
                    <option value="10">10% · пример</option>
                    <option value="15">15% · пример</option>
                  </Select>
                </label>
              </div>
              <label className="ws-checkbox">
                <input
                  type="checkbox"
                  checked={printReceipt}
                  disabled={done}
                  onChange={(e) => setPrintReceipt(e.target.checked)}
                />
                Печатать чек
              </label>
              <p className="form-note">В прототипе будет подготовлен демочек для просмотра.</p>
              <div className="checkout-total">
                <span>Итого к оплате</span>
                <strong>{money(pricing.total)}</strong>
                {pricing.discount > 0 && (
                  <small>
                    Скидка: {money(pricing.discount)} · до скидки {money(pricing.base)}
                  </small>
                )}
              </div>
              <div className="payment-methods" role="radiogroup" aria-label="Способ оплаты">
                {paymentMethods.map((value, index) => {
                  const Icon = methodIcons[index];
                  return (
                    <button
                      role="radio"
                      aria-checked={method === value}
                      disabled={done}
                      key={value}
                      onKeyDown={(event) => {
                        const direction = ['ArrowRight', 'ArrowDown'].includes(event.key)
                          ? 1
                          : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                            ? -1
                            : 0;
                        if (!direction) return;
                        event.preventDefault();
                        const next =
                          (index + direction + paymentMethods.length) % paymentMethods.length;
                        setMethod(paymentMethods[next]);
                        setError('');
                        event.currentTarget.parentElement
                          ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                          [next]?.focus();
                      }}
                      tabIndex={method === value ? 0 : -1}
                      onClick={() => {
                        setMethod(value);
                        setError('');
                      }}
                    >
                      <Icon size={22} />
                      <strong>{value}</strong>
                      <small>
                        {value === 'Составная оплата'
                          ? 'Несколько способов в одной покупке'
                          : value === 'В кредит'
                            ? 'Зафиксировать задолженность'
                            : value === 'Подарочная карта'
                              ? 'Списать с демонстрационного остатка'
                              : 'Зачисление и подготовка чека'}
                      </small>
                    </button>
                  );
                })}
              </div>
              {method === 'Составная оплата' && (
                <div className="ws-fields">
                  {(['cash', 'card', 'gift', 'credit'] as const).map((key, index) => (
                    <label className="form-field" key={key}>
                      <span>
                        {
                          ['Наличными, ₽', 'Безналично, ₽', 'Подарочной картой, ₽', 'В долг, ₽'][
                            index
                          ]
                        }
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={done}
                        value={parts[key]}
                        onChange={(e) => {
                          setParts({ ...parts, [key]: Number(e.target.value) });
                          setError('');
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}
              {(method === 'Подарочная карта' ||
                (method === 'Составная оплата' && parts.gift > 0)) && (
                <label className="form-field">
                  <span>Подарочная карта</span>
                  <Select
                    value={giftId}
                    disabled={done}
                    onChange={(e) => {
                      setGiftId(e.target.value);
                      setError('');
                    }}
                  >
                    <option value="">Выберите демокарту</option>
                    {(data['gift-cards'] || [])
                      .filter((row) => row.status === 'Активна')
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name} · остаток {money(row.balance)}
                        </option>
                      ))}
                  </Select>
                </label>
              )}
              {(method === 'В кредит' || (method === 'Составная оплата' && parts.credit > 0)) && (
                <Notice>
                  Неоплаченная часть будет записана как задолженность выбранного клиента. Это
                  демонстрационный сценарий.
                </Notice>
              )}
              <Notice>Реальная оплата и печать кассового чека не выполняются.</Notice>
              {(error || calculationError) && (
                <p className="ws-error" role="alert">
                  {error || calculationError}
                </p>
              )}
              <div className="ws-actions">
                <Button disabled={done || !!calculationError} onClick={confirm}>
                  {done ? 'Продажа сохранена' : 'Подтвердить демопродажу'}
                </Button>
                {done && receipt && (
                  <Button variant="secondary" onClick={() => setReceiptOpen(true)}>
                    Показать чек
                  </Button>
                )}
              </div>
              {done && (
                <Notice tone="success">
                  Продажа сохранена в кассе и финансах клиента.
                  {isPlan && ' Карта добавлена клиенту.'}
                  {debt > 0 && ` Задолженность: ${money(debt)}.`}
                </Notice>
              )}
            </>
          ) : (
            <Empty
              title="Выберите клиента и покупку"
              text="Затем здесь появятся данные и варианты оплаты."
            />
          )}
        </div>
      </section>
      {receiptOpen && receipt && (
        <Modal
          title="Демонстрационный чек"
          subtitle="Не является фискальным документом"
          onClose={closeReceipt}
        >
          <dl className="ws-facts">
            <div>
              <dt>Клиент</dt>
              <dd>{receipt.client}</dd>
            </div>
            <div>
              <dt>Карта</dt>
              <dd>{receipt.card}</dd>
            </div>
            <div>
              <dt>Покупка</dt>
              <dd>
                {receipt.name} × {receipt.quantity}
              </dd>
            </div>
            <div>
              <dt>Скидка</dt>
              <dd>{money(receipt.discountAmount)}</dd>
            </div>
            <div>
              <dt>Итого</dt>
              <dd>{money(receipt.total)}</dd>
            </div>
            <div>
              <dt>Оплата</dt>
              <dd>{receipt.method}</dd>
            </div>
            <div>
              <dt>Задолженность</dt>
              <dd>{money(receipt.creditAmount)}</dd>
            </div>
          </dl>
        </Modal>
      )}
    </div>
  );
}
