import { PaymentMethodPicker } from '../components/PaymentMethodPicker';
import { QuantityStepper } from '../components/QuantityStepper';
import { Field } from '../components/Field';
import { redeemGift, replaceRecord } from '../lib/reception-operations';
import { supportsTraining } from '../lib/training-kind';
import { saleTrainerSelection } from '../lib/personal-training';
import type { TrainingKind } from '../lib/training-kind';
import { accessWindowLabel } from '../lib/registration';
import { clientName, hiddenPhone } from '../lib/client-display';
import { demoStamp, nextDemoNow } from '../lib/demo-clock';
import { Select } from '../components/Select';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Member } from '../types';
import type { Navigate } from '../components/WorkspaceUI';
import { Button, Modal } from '../components/ui';
import { Notice, Empty, SearchBox } from '../components/WorkspaceUI';
import { ClientSearch } from '../components/ClientSearch';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { MembershipCard } from '../components/MembershipCard';
import { CatalogSectionCard, CatalogSectionGrid } from '../components/CatalogSectionCard';
import { MembershipCatalog } from '../components/MembershipCatalog';
import { quantityLabel } from '../data/membership-kinds';
import { memberCards } from '../data/admin';
import { money, TODAY } from '../data/workspace';
import type { DemoRecord } from '../data/workspace';
import { paymentPlan, saleTotal } from '../lib/checkout';
import type { PaymentMethod, PaymentParts } from '../lib/checkout';

import { saleCatalog, saleSections, searchSaleCatalog } from '../lib/sale-catalog';
import type { PlanSectionId, SaleCatalogItem, SaleSectionId } from '../lib/sale-catalog';
export function SaleWorkspace({
  members,
  initialMember,
  navigate,
  clubName,
  employeeName,
  allowRegistration = true,
  initialSection = null,
  hidePhones = false,
  training = null,
  initialTrainerId = null,
}: {
  members: Member[];
  initialMember: Member | null;
  navigate: Navigate;
  clubName: string;
  employeeName: string;
  allowRegistration?: boolean;
  initialSection?: SaleSectionId | null;
  hidePhones?: boolean;
  training?: TrainingKind | null;
  initialTrainerId?: string | null;
}) {
  const { data, put, transact } = useWorkspace();
  const saleRoot = useRef<HTMLDivElement>(null);
  const submitArea = useRef<HTMLDivElement>(null);
  const [saleStep, setSaleStep] = useState<'client' | 'catalog' | 'payment'>(
    initialMember ? 'catalog' : 'client',
  );
  const [clientSearchOpen, setClientSearchOpen] = useState(!initialMember);
  const [memberId, setMemberId] = useState(String(initialMember?.id || ''));
  const [sectionId, setSectionId] = useState<SaleSectionId | null>(initialSection);
  const [query, setQuery] = useState('');
  const [trainerId, setTrainerId] = useState(initialTrainerId || '');
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
  useEffect(() => {
    if (saleStep !== 'payment' || !saleRoot.current || saleRoot.current.clientWidth > 740) return;
    const frame = requestAnimationFrame(() => submitArea.current?.scrollIntoView({ block: 'end' }));
    return () => cancelAnimationFrame(frame);
  }, [saleStep, itemId, method]);
  const member = members.find((member) => String(member.id) === memberId);
  const {
    assigned: assignedTrainers,
    trainers,
    selected: personalTrainer,
  } = saleTrainerSelection(data, member?.id, trainerId);
  const catalog = saleCatalog(data, training, personalTrainer?.categoryId || null);
  const selected = catalog.find((entry) => entry.record.id === itemId);
  const item = selected?.record;
  const isPlan = selected?.type === 'plan';
  const isPersonalPlan =
    isPlan &&
    item &&
    supportsTraining({ training: item.training, kindId: item.kindId }, 'personal');
  const category =
    selected?.type === 'product'
      ? 'Товары'
      : selected?.type === 'service'
        ? 'Услуги'
        : saleSections.find((section) => section.id === selected?.sectionId)?.name || 'Абонементы';
  const visibleItems = searchSaleCatalog(catalog, query, sectionId);
  const showPersonalTrainer =
    training === 'personal' ||
    sectionId === 'personal' ||
    (!!query.trim() &&
      visibleItems.some((entry) =>
        supportsTraining(
          { training: entry.record.training, kindId: entry.record.kindId },
          'personal',
        ),
      ));
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
      if (
        isPersonalPlan &&
        (!personalTrainer || item.trainerCategory !== personalTrainer.categoryId)
      )
        throw new Error('Выберите персональный абонемент категории закреплённого тренера.');
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
      const stamp = demoStamp(nextDemoNow());
      const details: DemoRecord = {
        id,
        name: item.name,
        description: item.short || item.description || item.name,
        category,
        itemId: item.id,
        kindId: item.kindId || '',
        trainerId: isPersonalPlan ? personalTrainer?.id || '' : '',
        date: stamp.slice(0, 10),
        time: stamp.slice(11),
        cashier: employeeName,
        receiptNumber: printReceipt ? `DEMO-${id.slice(-8).toUpperCase()}` : '',
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
      transact((current) => {
        const next = replaceRecord(current, 'ledger', details);
        return payment.gift && gift
          ? redeemGift(next, gift.id, payment.gift, {
              id: `sale-gift:${id}`,
              date: stamp,
              name: 'Оплата покупки',
              comment: item.name,
              saleId: id,
            })
          : next;
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
      if (isPlan) {
        put('issued-plans', {
          ...item,
          id: demoId('issued'),
          memberId,
          issued: TODAY,
          saleId: id,
          purchasePrice: String(pricing.total),
          club: details.club,
          ...(isPersonalPlan && personalTrainer
            ? { trainerId: personalTrainer.id, trainerCategory: personalTrainer.categoryId }
            : {}),
        });
        if (
          isPersonalPlan &&
          personalTrainer &&
          !assignedTrainers.some((trainer) => trainer.id === personalTrainer.id)
        )
          put('personal-clients', {
            id: `${personalTrainer.id}:${memberId}`,
            memberId,
            trainerId: personalTrainer.id,
            goal: '',
          });
      } else if (category === 'Товары')
        put('retail-products', { ...item, stock: String(Number(item.stock) - Number(quantity)) });
      else put('issued-services', { ...item, id: demoId('service'), memberId, issued: TODAY });
      if (printReceipt) {
        const next = {
          ...details,
          id: `receipt-${id}`,
          saleId: id,
          card: member.cardNumber ?? memberCards[member.id] ?? String(member.id + 99000),
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
          setSaleStep(member ? 'payment' : 'client');
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
                ? `${quantityLabel(row.duration, 'day')} · безлимит посещений`
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
        {entry.type === 'plan' && accessWindowLabel(row) && (
          <span className="pass-access-note">{accessWindowLabel(row)}</span>
        )}
        {entry.type === 'plan' && row.ageMin && (
          <span className="pass-access-note">
            Возраст {row.ageMin}–{row.ageMax} лет
          </span>
        )}
      </button>
    );
  };
  return (
    <div ref={saleRoot} className={`sale-workspace sale-step-${saleStep}`}>
      <nav className="sale-step-nav" aria-label="Шаги продажи">
        {(['client', 'catalog', 'payment'] as const).map((step, index) => (
          <button
            key={step}
            aria-current={saleStep === step ? 'step' : undefined}
            disabled={(step === 'catalog' && !member) || (step === 'payment' && (!member || !item))}
            onClick={() => setSaleStep(step)}
          >
            {index + 1}. {['Клиент', 'Покупка', 'Оплата'][index]}
          </button>
        ))}
      </nav>
      <div className="sale-layout">
        <div className="sale-main ws-stack">
          <section className="panel ws-panel client-picker-panel">
            <div className="ws-panel-heading">
              <div>
                <h2>1. Клиент</h2>
                {(!member || clientSearchOpen) && (
                  <p>Найдите клиента по карте, ФИО или номеру телефона.</p>
                )}
              </div>
              {member && (
                <Button variant="ghost" onClick={() => setClientSearchOpen(!clientSearchOpen)}>
                  {clientSearchOpen ? 'Скрыть поиск' : 'Другой клиент'}
                </Button>
              )}
            </div>
            <div className="ws-panel-body ws-stack">
              {(!member || clientSearchOpen) && (
                <ClientSearch
                  hidePhones={hidePhones}
                  mode="selection"
                  purpose="покупки"
                  members={members}
                  onMember={(next) => {
                    setMemberId(String(next.id));
                    setTrainerId('');
                    setClientSearchOpen(false);
                    setSaleStep('catalog');
                    setDiscount('0');
                    setGiftId('');
                    clearResult();
                  }}
                />
              )}
              {member && (
                <div className="checkout-client">
                  <strong>{member.fullName || member.name}</strong>
                  <span>
                    Карта {member.cardNumber ?? memberCards[member.id] ?? String(member.id + 99000)}
                  </span>
                  <span>
                    {hidePhones ? hiddenPhone(member.phone) : member.phone} · {member.email}
                  </span>
                </div>
              )}
              {member && allowRegistration && (
                <button
                  className="client-text-action"
                  onClick={() => navigate('registration', member)}
                >
                  К регистрации посещения
                </button>
              )}
              {member && (
                <Button className="sale-next" onClick={() => setSaleStep('catalog')}>
                  Выбрать покупку
                </Button>
              )}
            </div>
          </section>
          <section className="panel ws-panel sale-catalog" aria-label="Каталог продажи">
            <div className="ws-panel-heading sale-catalog-heading">
              <div>
                <h2>
                  2.{' '}
                  {training
                    ? training === 'personal'
                      ? 'Абонементы на персональные тренировки'
                      : 'Абонементы на групповые занятия'
                    : currentSection?.name || 'Выбор покупки'}
                </h2>
                <p>
                  {(training
                    ? 'Показаны только абонементы, которые подходят для выбранной предзаписи.'
                    : currentSection?.description) ||
                    'Выберите раздел или найдите покупку по названию.'}
                </p>
              </div>
              {sectionId && (
                <Button
                  className="sale-section-back"
                  variant="ghost"
                  aria-label="Все разделы продажи"
                  title="Все разделы продажи"
                  onClick={() => openSection(null)}
                >
                  <ArrowLeft size={16} /> <span>Все разделы продажи</span>
                </Button>
              )}
            </div>
            <div className="ws-panel-body ws-stack">
              <div className={`sale-catalog-controls${showPersonalTrainer ? ' has-trainer' : ''}`}>
                <div className="ws-actions sale-search-row">
                  <SearchBox
                    value={query}
                    onChange={setQuery}
                    label="Поиск по названию"
                    placeholder={
                      sectionId
                        ? 'Название, группа или подгруппа'
                        : training
                          ? 'Найти подходящий абонемент'
                          : 'Абонемент, тренировка, товар или услуга'
                    }
                  />
                  {(training || sectionId || query.trim()) && (
                    <span className="ws-muted" role="status">
                      Найдено: {visibleItems.length}
                    </span>
                  )}
                </div>
                {showPersonalTrainer && (
                  <div className="sale-catalog-trainer">
                    <Select
                      aria-label="Персональный тренер"
                      searchable
                      searchLabel="Поиск тренера"
                      searchPlaceholder="Имя или категория тренера"
                      value={personalTrainer?.id || ''}
                      onChange={(event) => {
                        setTrainerId(event.target.value);
                        setItemId('');
                        setQuery('');
                        clearResult();
                      }}
                    >
                      {!personalTrainer && trainers.length > 0 && (
                        <option value="">Выберите закреплённого тренера</option>
                      )}
                      {!trainers.length && <option value="">Нет действующих тренеров</option>}
                      {trainers.map((trainer) => (
                        <option key={trainer.id} value={trainer.id}>
                          {trainer.name} · {trainer.category}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
              {showPersonalTrainer && personalTrainer && (
                <p className="sale-trainer-note">
                  {personalTrainer.category} · {money(personalTrainer.lessonPrice)} за занятие ·
                  демо-тариф.
                  {!assignedTrainers.length &&
                    ' При покупке клиент будет закреплён за выбранным тренером.'}
                </p>
              )}
              {showPersonalTrainer && !personalTrainer ? (
                <Empty
                  title="Выберите тренера"
                  text={
                    assignedTrainers.length > 1
                      ? 'У клиента несколько закреплённых тренеров. После выбора откроются тарифы его категории.'
                      : 'Действующих тренеров для продажи пока нет.'
                  }
                />
              ) : !training && !sectionId && !query.trim() ? (
                <CatalogSectionGrid>
                  {saleSections.map((section) => {
                    const countedCatalog =
                      section.id === 'personal' && !personalTrainer && assignedTrainers.length > 1
                        ? saleCatalog(data, training).filter((entry) =>
                            assignedTrainers.some(
                              (trainer) => trainer.categoryId === entry.record.trainerCategory,
                            ),
                          )
                        : catalog;
                    const count = countedCatalog.filter(
                      (entry) => entry.sectionId === section.id,
                    ).length;
                    return (
                      <CatalogSectionCard
                        key={section.id}
                        id={section.id}
                        count={count}
                        onClick={() => openSection(section.id)}
                      />
                    );
                  })}
                </CatalogSectionGrid>
              ) : visibleItems.length ? (
                <>
                  {saleSections
                    .filter((section) =>
                      visibleItems.some((entry) => entry.sectionId === section.id),
                    )
                    .map((section) => {
                      const entries = visibleItems.filter(
                        (entry) => entry.sectionId === section.id,
                      );
                      return (
                        <div className="ws-stack" key={section.id}>
                          {!sectionId && section.id !== 'personal' && <h3>{section.name}</h3>}
                          {section.id === 'goods-services' ? (
                            <div className="plastic-card-grid sale-item-grid">
                              {entries.map(renderItem)}
                            </div>
                          ) : (
                            <MembershipCatalog
                              key={`${section.id}:${section.id === 'personal' ? personalTrainer?.categoryId : ''}`}
                              section={section.id as PlanSectionId}
                              plans={entries.map((entry) => entry.record)}
                              searching={!!query.trim() || !sectionId || !!training}
                              scopeLabel={
                                section.id === 'personal' && personalTrainer
                                  ? `Тарифы · ${personalTrainer.category}`
                                  : undefined
                              }
                              renderPlans={(rows) => (
                                <div className="plastic-card-grid">
                                  {rows.map((row) =>
                                    renderItem(
                                      entries.find((entry) => entry.record.id === row.id)!,
                                    ),
                                  )}
                                </div>
                              )}
                            />
                          )}
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
        </div>
        {saleStep === 'payment' && member && item && (
          <section className="panel ws-panel checkout-panel">
            <div className="ws-panel-heading">
              <h2>3. Оплата</h2>
              <Button
                className="sale-next"
                variant="ghost"
                onClick={() => {
                  setSaleStep('catalog');
                  saleRoot.current?.scrollIntoView({ block: 'start' });
                }}
              >
                <ArrowLeft size={16} /> К покупке
              </Button>
            </div>
            <div className="ws-panel-body ws-stack">
              {member && item ? (
                <>
                  <div className="checkout-options ws-stack">
                    <div className="checkout-review ws-stack">
                      <div className="checkout-summary">
                        <strong>{item.name}</strong>
                        <span>
                          {clientName(member)} · карта{' '}
                          {member.cardNumber ?? memberCards[member.id] ?? String(member.id + 99000)}
                        </span>
                        <span>За единицу: {money(item.price)}</span>
                        {isPersonalPlan && personalTrainer && (
                          <span>
                            {personalTrainer.name} · {personalTrainer.category}
                          </span>
                        )}
                      </div>
                      <details className="checkout-contact-details">
                        <summary>Контакты и описание покупки</summary>
                        <dl className="ws-facts checkout-facts">
                          <div>
                            <dt>ФИО</dt>
                            <dd>{member.fullName || member.name}</dd>
                          </div>
                          <div>
                            <dt>Номер карты</dt>
                            <dd>
                              {member.cardNumber ??
                                memberCards[member.id] ??
                                String(member.id + 99000)}
                            </dd>
                          </div>
                          <div>
                            <dt>Контакты</dt>
                            <dd>
                              {hidePhones ? hiddenPhone(member.phone) : member.phone} ·{' '}
                              {member.email}
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
                      </details>
                    </div>
                    <div className="checkout-settings ws-stack">
                      <div className="ws-fields">
                        {category === 'Товары' && (
                          <QuantityStepper
                            label="Количество"
                            value={Number(quantity)}
                            max={Math.min(999, Number(item.stock))}
                            disabled={done}
                            onChange={(value) => {
                              setQuantity(String(value));
                              setError('');
                            }}
                          />
                        )}
                        <Field className="form-field" label={<> Применить скидку </>}>
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
                        </Field>
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

                      <PaymentMethodPicker
                        value={method}
                        disabled={done}
                        onChange={(value) => {
                          setMethod(value);
                          setError('');
                        }}
                      />
                      {method === 'Составная оплата' && (
                        <div className="ws-fields">
                          {(['cash', 'card', 'gift', 'credit'] as const).map((key, index) => (
                            <Field
                              className="form-field"
                              key={key}
                              label={
                                <>
                                  {
                                    [
                                      'Наличными, ₽',
                                      'Безналично, ₽',
                                      'Подарочной картой, ₽',
                                      'В долг, ₽',
                                    ][index]
                                  }
                                </>
                              }
                            >
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
                            </Field>
                          ))}
                        </div>
                      )}
                      {(method === 'Подарочная карта' ||
                        (method === 'Составная оплата' && parts.gift > 0)) && (
                        <Field className="form-field" label={<> Подарочная карта </>}>
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
                        </Field>
                      )}
                      {(method === 'В кредит' ||
                        (method === 'Составная оплата' && parts.credit > 0)) && (
                        <Notice>
                          Неоплаченная часть будет записана как задолженность выбранного клиента.
                          Это демонстрационный сценарий.
                        </Notice>
                      )}

                      {(error || calculationError) && (
                        <p className="ws-error" role="alert">
                          {error || calculationError}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="checkout-submit" ref={submitArea}>
                    <div className="checkout-total">
                      <span>Итого к оплате</span>
                      <strong>{money(pricing.total)}</strong>
                      {pricing.discount > 0 && (
                        <small>
                          Скидка: {money(pricing.discount)} · до скидки {money(pricing.base)}
                        </small>
                      )}
                    </div>
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
                    <small className="form-note">Без реальной оплаты и печати</small>
                    {done && (
                      <Notice tone="success">
                        Продажа сохранена в кассе и финансах клиента.
                        {isPlan && ' Карта добавлена клиенту.'}
                        {debt > 0 && ` Задолженность: ${money(debt)}.`}
                      </Notice>
                    )}
                  </div>
                </>
              ) : (
                <Empty
                  title="Выберите клиента и покупку"
                  text="Затем здесь появятся данные и варианты оплаты."
                />
              )}
            </div>
          </section>
        )}
      </div>
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
