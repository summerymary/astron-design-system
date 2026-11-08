import { Select } from '../components/Select';
import { useCallback, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, CupSoda, Plus } from 'lucide-react';
import { Button, Modal } from '../components/ui';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import {
  Back,
  DataTable,
  Empty,
  FieldControl,
  Notice,
  RecordDetails,
  RecordForm,
  SearchBox,
  SectionLinks,
  Stats,
  Status,
  Tabs,
} from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import type { DemoRecord, Field } from '../data/workspace';
import { money, prettyDate, TODAY } from '../data/workspace';
import { inventoryStock, validatePlan } from '../lib/workspace-rules';
import { membershipKinds } from '../data/membership-kinds';
import { MembershipCard } from '../components/MembershipCard';
import { CatalogSectionCard } from '../components/CatalogSectionCard';
import { planSaleSection, saleSections } from '../lib/sale-catalog';
import type { SaleSectionId } from '../lib/sale-catalog';
import { quantityLabel } from '../data/membership-kinds';
import { matchesSearch } from '../lib/directory-search';

const clubField: Field = {
  key: 'club',
  label: 'Клуб',
  options: ['Центральный', 'Парк', 'Речной'],
  required: true,
};
const datePlus = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const planSteps = [
  'Основное',
  'Срок и визиты',
  'Доступ',
  'Продажа',
  'Онлайн-витрина',
  'Бонусы',
  'Дополнительно',
];
const planFields: Field[][] = [
  [
    {
      key: 'kind',
      label: 'Назначение абонемента',
      required: true,
    },
    { key: 'name', label: 'Название карты', required: true },
    {
      key: 'type',
      label: 'Учёт посещений',
      options: ['Безлимитный', 'По посещениям', 'Разовое посещение'],
    },
    { key: 'short', label: 'Короткое описание' },
    { key: 'description', label: 'Описание для клиента', type: 'textarea' },
  ],
  [
    { key: 'duration', label: 'Срок действия, дней', type: 'number', min: 1, required: true },
    {
      key: 'visits',
      label: 'Количество посещений',
      type: 'number',
      min: 0,
      hint: 'Для безлимитного абонемента количество не ограничено.',
    },
    {
      key: 'activation',
      label: 'Начало действия',
      options: ['С первого посещения', 'С даты покупки'],
    },
    {
      key: 'hours',
      label: 'Часы посещения',
      type: 'textarea',
      hint: 'Информация для клиента. Эти часы сами по себе не ограничивают проход.',
    },
  ],
  [
    { key: 'club', label: 'Клубы', options: ['Все клубы', 'Центральный', 'Парк', 'Речной'] },
    {
      key: 'direction',
      label: 'Направление',
      options: ['Все направления', 'Сила', 'Баланс', 'Кардио'],
    },
    {
      key: 'training',
      label: 'Тип тренировок',
      options: ['Групповые и тренажёрный зал', 'Групповые', 'Персональные', 'Тренажёрный зал'],
    },
    { key: 'age', label: 'Возрастные условия' },
    { key: 'gender', label: 'Пол', options: ['Любой', 'Женский', 'Мужской'] },
    { key: 'mode', label: 'Посещение', options: ['Офлайн', 'Онлайн', 'Онлайн и офлайн'] },
    { key: 'freezeEnabled', label: 'Заморозка', options: ['Нет', 'Да'] },
    { key: 'freeze', label: 'Условия заморозки', type: 'textarea' },
  ],
  [
    { key: 'price', label: 'Цена, ₽', type: 'number', min: 0, required: true },
    { key: 'discount', label: 'Онлайн-скидка, %', type: 'number', min: 0 },
    { key: 'online', label: 'Покупка онлайн', options: ['Доступен', 'Недоступен'] },
  ],
  [
    { key: 'storefront', label: 'Категория витрины', options: ['Клубные карты', 'Тренировки'] },
    { key: 'onlineTraining', label: 'Онлайн-тренировки', options: ['Нет', 'Да'] },
  ],
  [],
  [
    { key: 'spa', label: 'Доступ в SPA', options: ['Нет', 'Да'] },
    { key: 'secondHolder', label: 'Второй владелец', options: ['Нет', 'Да'] },
  ],
];
export function MembershipWorkspace({ navigate }: { navigate: Navigate }) {
  const { data, put } = useWorkspace();
  const [category, setCategory] = useState<string | null>(null);
  const [draft, setDraft] = useState<DemoRecord | null>(null);
  const [step, setStep] = useState(planSteps[0]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Все');
  const [sectionId, setSectionId] = useState<SaleSectionId | null>(null);
  const [categoryForm, setCategoryForm] = useState<DemoRecord | 'new' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const closeCategory = useCallback(() => setCategoryForm(null), []);
  const selected = data.categories.find((row) => row.id === category);
  const currentSection = saleSections.find((section) => section.id === sectionId);
  const sectionPlans = data.plans.filter(
    (plan) => !sectionId || planSaleSection(plan) === sectionId,
  );
  const categories = data.categories.filter(
    (row) => row.saleSection === sectionId || sectionPlans.some((plan) => plan.category === row.id),
  );
  const openSection = (id: SaleSectionId | null) => {
    setSectionId(id);
    setCategory(null);
    setQuery('');
    setFilter('Все');
  };
  const savePlan = (publish: boolean) => {
    if (!draft) return;
    const invalid = validatePlan(draft, publish);
    if (invalid) {
      setStep(invalid.step);
      setError(invalid.message);
      return;
    }
    put('plans', { ...draft, currency: 'RUB', status: publish ? 'Опубликован' : 'Черновик' });
    openSection(planSaleSection(draft));
    setDraft(null);
    setError('');
    setMessage(publish ? 'Абонемент опубликован в демокаталоге.' : 'Черновик сохранён.');
  };
  if (draft)
    return (
      <div className="ws-stack">
        <Back
          onClick={() => {
            setDraft(null);
            setError('');
          }}
        >
          К абонементам
        </Back>
        <div className="ws-builder">
          <section className="panel ws-panel">
            <div className="ws-panel-heading">
              <div>
                <h2>{draft.name || 'Новый абонемент'}</h2>
                <p>Настройте условия и проверьте карточку справа.</p>
              </div>
              <Status>{draft.status || 'Черновик'}</Status>
            </div>
            <Tabs items={planSteps} value={step} onChange={setStep} label="Настройка абонемента" />
            <div className="ws-panel-body">
              <div className="ws-fields">
                {step === 'Основное' && (
                  <>
                    <label className="form-field">
                      <span>Раздел каталога</span>
                      <Select
                        value={planSaleSection(draft)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            saleSection: e.target.value,
                            corporate: e.target.value === 'corporate' ? 'Да' : 'Нет',
                          })
                        }
                      >
                        {saleSections
                          .filter((section) => section.id !== 'goods-services')
                          .map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.name}
                            </option>
                          ))}
                      </Select>
                    </label>
                    <label className="form-field">
                      <span>Цвет карты</span>
                      <Select
                        value={draft.kindId || 'gym'}
                        onChange={(e) => {
                          const kind = membershipKinds.find((kind) => kind.id === e.target.value)!;
                          setDraft({ ...draft, kindId: kind.id, color: kind.foreground });
                        }}
                      >
                        {membershipKinds.map((kind) => (
                          <option value={kind.id} key={kind.id}>
                            {kind.colorName}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="form-field">
                      <span>Категория</span>
                      <Select
                        value={draft.category || ''}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      >
                        <option value="">Без категории</option>
                        {data.categories.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </>
                )}
                {planFields[planSteps.indexOf(step)].map((field) => (
                  <FieldControl
                    key={field.key}
                    field={field}
                    value={draft[field.key] ?? ''}
                    onChange={(value) => {
                      setDraft({ ...draft, [field.key]: value });
                      setError('');
                    }}
                  />
                ))}
              </div>
              {step === 'Основное' && (
                <p className="form-note">
                  Название и назначение можно задать свободно. Цвет помогает различать карты и не
                  меняет цену, срок или условия.
                </p>
              )}
              {step === 'Бонусы' && (
                <Empty
                  title="Бонусы не настроены"
                  text="В текущей версии источника для этого шага нет доступных параметров."
                />
              )}
              {error && (
                <p className="ws-error" role="alert">
                  {error}
                </p>
              )}
              <div className="ws-actions ws-step-actions">
                <Button
                  variant="secondary"
                  disabled={step === planSteps[0]}
                  onClick={() => setStep(planSteps[planSteps.indexOf(step) - 1])}
                >
                  <ArrowLeft size={14} />
                  Назад
                </Button>
                {step !== planSteps.at(-1) && (
                  <Button
                    variant="secondary"
                    onClick={() => setStep(planSteps[planSteps.indexOf(step) + 1])}
                  >
                    Далее
                    <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            </div>
            <div className="ws-panel-footer">
              {data.plans.some((plan) => plan.id === draft.id) && draft.status !== 'В архиве' && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    put('plans', { ...draft, status: 'В архиве' });
                    setDraft(null);
                    setMessage('Абонемент перемещён в архив.');
                  }}
                >
                  В архив
                </Button>
              )}
              <Button variant="secondary" onClick={() => savePlan(false)}>
                Сохранить черновик
              </Button>
              <Button onClick={() => savePlan(true)}>Опубликовать</Button>
            </div>
          </section>
          <aside className="panel ws-plan-preview">
            <span className="eyebrow">КАРТОЧКА ДЛЯ КЛИЕНТА</span>
            <MembershipCard
              compact
              name={draft.name || 'Название абонемента'}
              kindId={draft.kindId}
              detail={draft.short || draft.kind}
              footer={money(draft.price)}
            />
            <dl className="ws-facts">
              <div>
                <dt>Посещения</dt>
                <dd>
                  {draft.type === 'Безлимитный'
                    ? 'Без ограничений'
                    : draft.type === 'Разовое посещение'
                      ? '1 посещение'
                      : `${draft.visits || '—'} занятий`}
                </dd>
              </div>
              <div>
                <dt>Срок</dt>
                <dd>{draft.duration || '—'} дней</dd>
              </div>
              <div>
                <dt>Клуб</dt>
                <dd>{draft.club || 'Все клубы'}</dd>
              </div>
              <div>
                <dt>Начало</dt>
                <dd>{draft.activation || 'С первого посещения'}</dd>
              </div>
            </dl>
            {draft.hours && <p>{draft.hours}</p>}
            {draft.description && <p>{draft.description}</p>}
          </aside>
        </div>
      </div>
    );
  const plans = sectionPlans.filter(
    (row) =>
      (!category || row.category === category) &&
      matchesSearch([row.name, row.short, row.description, row.kind].join(' '), query) &&
      (filter === 'Все' ||
        (filter === 'Онлайн' ? row.online === 'Доступен' : row.status === filter)),
  );
  const otherResults = [
    ...(data['retail-products'] || []),
    ...(data['reception-services'] || []),
  ].filter((row) => matchesSearch(row.name, query));
  const renderOtherItems = (rows: DemoRecord[]) => (
    <div className="membership-service-grid">
      {rows.map((row) => (
        <div key={row.id} className="membership-service-card">
          <strong>{row.name}</strong>
          <span>{money(row.price)}</span>
          <Status>{row.status}</Status>
        </div>
      ))}
    </div>
  );
  const renderPlans = (rows: DemoRecord[]) => (
    <div className="membership-catalog-grid">
      {rows.map((row) => (
        <button
          key={row.id}
          className="membership-catalog-card"
          aria-label={`Редактировать: ${row.name}`}
          onClick={() => {
            setDraft({ ...row, saleSection: planSaleSection(row) });
            setStep(planSteps[0]);
            setError('');
          }}
        >
          <MembershipCard
            compact
            name={row.name}
            kindId={row.kindId}
            detail={`${quantityLabel(row.duration, 'day')} · ${row.type === 'Безлимитный' ? 'без ограничений' : quantityLabel(row.visits, 'visit')}`}
            footer={money(row.price)}
          />
          <span className="membership-catalog-meta">
            <Status>{row.status}</Status>
            <span>{row.online === 'Доступен' ? 'Доступен онлайн' : 'В клубе'}</span>
          </span>
        </button>
      ))}
    </div>
  );
  const startPlan = () => {
    const base = data.plans.find((plan) => planSaleSection(plan) === sectionId);
    const kind = membershipKinds.find(
      (kind) => kind.id === (sectionId === 'personal' ? 'personal' : 'gym'),
    )!;
    setDraft({
      ...base,
      id: demoId('plan'),
      name: '',
      saleSection: sectionId || 'memberships',
      corporate: sectionId === 'corporate' ? 'Да' : 'Нет',
      category: category || base?.category || data.categories[0]?.id || '',
      kindId: base?.kindId || kind.id,
      kind: base?.kind || kind.description,
      type: base?.type || kind.type,
      duration: base?.duration || kind.duration,
      visits: base?.visits || kind.visits,
      price: '',
      discount: '0',
      activation: 'С первого посещения',
      club: 'Все клубы',
      online: 'Недоступен',
      color: base?.color || kind.foreground,
      status: 'Черновик',
    });
    setStep(planSteps[0]);
    setError('');
  };
  return (
    <div className="ws-stack membership-workspace">
      {message && <Notice tone="success">{message}</Notice>}
      <div className="membership-navigation-row">
        {sectionId && <Back onClick={() => openSection(null)}>Все разделы</Back>}
        <SearchBox
          value={query}
          onChange={setQuery}
          label="Поиск в каталоге абонементов"
          placeholder={sectionId ? 'Поиск в разделе по названию' : 'Поиск по всему каталогу'}
        />
      </div>
      {!sectionId && !query.trim() ? (
        <div className="membership-section-grid" aria-label="Разделы каталога">
          {saleSections.map((section) => (
            <CatalogSectionCard
              key={section.id}
              id={section.id}
              count={
                section.id === 'goods-services'
                  ? (data['retail-products'] || []).length +
                    (data['reception-services'] || []).length
                  : data.plans.filter((plan) => planSaleSection(plan) === section.id).length
              }
              onClick={() => openSection(section.id)}
            />
          ))}
        </div>
      ) : sectionId === 'goods-services' ? (
        <section className="panel ws-panel">
          <div className="ws-panel-heading">
            <h2>Товары и услуги</h2>
            <Button variant="secondary" onClick={() => navigate('services')}>
              Перейти к продаже <ChevronRight size={16} />
            </Button>
          </div>
          <div className="ws-panel-body ws-stack">
            {[
              { label: 'Товары ресепшена', rows: data['retail-products'] || [] },
              { label: 'Услуги клуба', rows: data['reception-services'] || [] },
            ].map((group) => (
              <section key={group.label} className="ws-stack">
                <h3>{group.label}</h3>
                {renderOtherItems(group.rows.filter((row) => matchesSearch(row.name, query)))}
                {!group.rows.some((row) => matchesSearch(row.name, query)) && (
                  <Empty title="Позиций не найдено" />
                )}
              </section>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel ws-panel">
          <div className="ws-panel-heading">
            <h2>{currentSection?.name || 'Результаты поиска'}</h2>
            {sectionId && (
              <Button onClick={startPlan}>
                <Plus size={16} />
                Абонемент
              </Button>
            )}
          </div>
          <Tabs
            items={['Все', 'Опубликован', 'Черновик', 'Онлайн', 'В архиве']}
            value={filter}
            onChange={setFilter}
            label="Фильтр абонементов"
          />
          {sectionId && (
            <details className="ws-disclosure membership-category-filter">
              <summary>
                {selected ? `Категория: ${selected.name}` : 'Категории и группировка'}
              </summary>
              <div className="ws-toolbar membership-category-toolbar">
                <label className="form-field">
                  <span>Категория</span>
                  <Select
                    value={category || ''}
                    onChange={(e) => setCategory(e.target.value || null)}
                  >
                    <option value="">Все категории</option>
                    {categories.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <Button variant="secondary" onClick={() => setCategoryForm('new')}>
                  <Plus size={15} />
                  Категория
                </Button>
                {selected && (
                  <Button variant="ghost" onClick={() => setCategoryForm(selected)}>
                    Изменить категорию
                  </Button>
                )}
              </div>
            </details>
          )}
          <div className="ws-panel-body ws-stack">
            {plans.length || (!sectionId && otherResults.length) ? (
              sectionId ? (
                renderPlans(plans)
              ) : (
                <>
                  {saleSections
                    .filter((section) => section.id !== 'goods-services')
                    .map((section) => {
                      const rows = plans.filter((plan) => planSaleSection(plan) === section.id);
                      return rows.length ? (
                        <section className="ws-stack" key={section.id}>
                          <h3>{section.name}</h3>
                          {renderPlans(rows)}
                        </section>
                      ) : null;
                    })}
                  {otherResults.length > 0 && (
                    <section className="ws-stack">
                      <h3>Товары и услуги</h3>
                      {renderOtherItems(otherResults)}
                    </section>
                  )}
                </>
              )
            ) : (
              <Empty
                title="Абонементы не найдены"
                text="Измените поиск или фильтр. В каждом разделе можно добавлять свои тарифы."
              />
            )}
          </div>
        </section>
      )}
      <SectionLinks ids={['services', 'directories']} navigate={navigate} />
      {categoryForm && (
        <RecordForm
          title={categoryForm === 'new' ? 'Новая категория' : 'Категория абонементов'}
          fields={[
            { key: 'name', label: 'Название', required: true },
            { key: 'description', label: 'Описание для сотрудников', type: 'textarea' },
            { key: 'group', label: 'Группа' },
            { ...clubField, options: ['Все клубы', ...clubField.options!] },
            { key: 'discount', label: 'Корпоративная скидка', options: ['Нет', 'Да'] },
            { key: 'sort', label: 'Порядок', type: 'number', min: 0 },
          ]}
          initial={categoryForm === 'new' ? undefined : categoryForm}
          onClose={closeCategory}
          onSave={(record) => {
            put('categories', {
              ...record,
              saleSection: sectionId || record.saleSection || 'memberships',
              status: 'Активна',
            });
            setCategory(record.id);
            closeCategory();
            setMessage('Категория сохранена.');
          }}
        />
      )}
    </div>
  );
}

export { RegistrationWorkspace } from './VisitRegistration';

export function StatisticsWorkspace() {
  const { data } = useWorkspace();
  const [report, setReport] = useState<string | null>(null);
  const [from, setFrom] = useState('2026-11-01');
  const [to, setTo] = useState(TODAY);
  const [club, setClub] = useState('Все клубы');
  const [compare, setCompare] = useState('Без сравнения');
  const [group, setGroup] = useState('По дням');
  const filtered = data.ledger.filter(
    (row) =>
      row.category !== 'Бар' &&
      row.date >= from &&
      row.date <= to &&
      (club === 'Все клубы' || row.club === club),
  );
  const total = filtered.reduce((sum, row) => sum + Number(row.amount), 0);
  const grouped = new Map<string, number>();
  filtered.forEach((row) => {
    const key =
      group === 'По клубам' ? row.club : group === 'По категориям' ? row.category : row.date;
    grouped.set(key, (grouped.get(key) || 0) + Number(row.amount));
  });
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const previous = data.ledger
    .filter(
      (row) =>
        row.category !== 'Бар' &&
        row.date >= datePlus(from, -days) &&
        row.date < from &&
        (club === 'Все клубы' || row.club === club),
    )
    .reduce((sum, row) => sum + Number(row.amount), 0);
  if (!report)
    return (
      <div className="ws-stack">
        <div className="ws-card-grid">
          {['Обзор продаж', 'Выручка'].map((name) => (
            <button className="panel ws-link-card" key={name} onClick={() => setReport(name)}>
              <span>
                <strong>{name}</strong>
                <small>Период, клуб, сравнение и детализация</small>
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
        {[
          'Клиенты',
          'Посещаемость',
          'Тренеры',
          'Обратная связь',
          'Звонки',
          'Прогнозы и когорты',
        ].map((name) => (
          <section className="panel ws-panel-body" key={name}>
            <div className="ws-subheading">
              <h3>{name}</h3>
              <Status>Пока недоступно</Status>
            </div>
            <p className="ws-muted">
              В источнике отчёты этой категории недоступны. Их экраны будут разработаны после
              уточнения состава и прав доступа.
            </p>
          </section>
        ))}
        <Notice>
          В прототипе отчёты рассчитываются по вымышленным продажам. В источнике просмотрен экран
          параметров; получение данных завершилось ошибкой.
        </Notice>
      </div>
    );
  return (
    <div className="ws-stack">
      <Back onClick={() => setReport(null)}>Все отчёты</Back>
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>{report}</h2>
            <p>Часовой пояс: Москва · валюта: ₽</p>
          </div>
        </div>
        <div className="ws-toolbar ws-report-filters">
          <label className="form-field">
            <span>Начало периода</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="form-field">
            <span>Конец периода</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="form-field">
            <span>Клуб</span>
            <Select value={club} onChange={(e) => setClub(e.target.value)}>
              {['Все клубы', 'Центральный', 'Парк', 'Речной'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </label>
          <label className="form-field">
            <span>Сравнение</span>
            <Select value={compare} onChange={(e) => setCompare(e.target.value)}>
              <option>Без сравнения</option>
              <option>Предыдущий период</option>
            </Select>
          </label>
          <label className="form-field">
            <span>Детализация</span>
            <Select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option>По дням</option>
              <option>По клубам</option>
              <option>По категориям</option>
            </Select>
          </label>
        </div>
      </section>
      {!from || !to || from > to ? (
        <Notice tone="warning">Укажите корректный период.</Notice>
      ) : (
        <>
          <Stats
            items={[
              { label: 'Выручка', value: money(total) },
              { label: 'Продажи', value: filtered.length },
              {
                label: 'Средний чек',
                value: money(filtered.length ? Math.round(total / filtered.length) : 0),
              },
              ...(compare !== 'Без сравнения'
                ? [
                    {
                      label: 'Предыдущий период',
                      value: money(previous),
                      note: previous
                        ? `${Math.round((total / previous - 1) * 100)}% к предыдущему`
                        : 'Нет продаж за прошлый период',
                    },
                  ]
                : []),
            ]}
          />
          <section className="panel ws-panel">
            <div className="ws-panel-heading">
              <h2>Распределение выручки</h2>
            </div>
            <div className="ws-panel-body ws-bars">
              {[...grouped.entries()].map(([key, amount]) => (
                <div key={key}>
                  <span>{group === 'По дням' ? prettyDate(key) : key}</span>
                  <div>
                    <i style={{ width: `${(amount / Math.max(...grouped.values(), 1)) * 100}%` }} />
                  </div>
                  <strong>{money(amount)}</strong>
                </div>
              ))}
              {!grouped.size && <Empty title="За этот период продаж нет" />}
            </div>
          </section>
          <section className="panel ws-panel">
            <div className="ws-panel-heading">
              <h2>Продажи за период</h2>
            </div>
            <DataTable
              rows={filtered}
              columns={[
                { key: 'date', label: 'Дата' },
                { key: 'name', label: 'Позиция' },
                { key: 'club', label: 'Клуб' },
                { key: 'amount', label: 'Сумма' },
                { key: 'method', label: 'Оплата' },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}

export { SaleWorkspace } from './ClientSale';

export function BarWorkspace({
  navigate,
  clubName,
  limited = false,
}: {
  navigate: Navigate;
  clubName: string;
  limited?: boolean;
}) {
  const { data, put, barOpen, setBarOpen } = useWorkspace();
  const cart = JSON.parse(
    data['bar-cart']?.find((r) => r.id === 'current')?.items || '{}',
  ) as Record<string, number>;
  const setCart = (value: Record<string, number>) =>
    put('bar-cart', { id: 'current', items: JSON.stringify(value) });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [method, setMethod] = useState('Карта');
  const [message, setMessage] = useState('');
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => setClosing(false), []);
  const products = data.products.filter((row) => row.status === 'Активен');
  const lines = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ product: products.find((row) => row.id === id)!, quantity }))
    .filter((line) => line.product);
  const total = lines.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0);
  if (!barOpen)
    return (
      <div className="ws-stack">
        <SectionLinks
          ids={
            limited
              ? ['bar-catalog', 'bar-sales']
              : ['bar-catalog', 'bar-sales', 'bar-categories', 'bar-collections', 'bar-inventory']
          }
          navigate={navigate}
        />
        <section className="panel ws-shift-gate">
          <span className="ws-feature-icon">
            <CupSoda size={30} />
          </span>
          <h2>Бар готов к работе</h2>
          <p>{clubName} · Бар у ресепшена</p>
          <Button onClick={() => setBarOpen(true)}>Открыть демосмену</Button>
          <small>Заказы сохраняются в памяти прототипа. Реальной оплаты нет.</small>
        </section>
      </div>
    );
  return (
    <div className="ws-stack">
      <div className="ws-subheading">
        <Status>Смена открыта</Status>
        <SectionLinks
          ids={
            limited
              ? ['bar-catalog', 'bar-sales']
              : ['bar-catalog', 'bar-sales', 'bar-categories', 'bar-collections', 'bar-inventory']
          }
          navigate={navigate}
        />
        <Button variant="ghost" onClick={() => setClosing(true)}>
          Закрыть смену…
        </Button>
      </div>
      {message && <Notice tone="success">{message}</Notice>}
      <div className="ws-pos">
        <section className="panel ws-panel">
          <div className="ws-toolbar">
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Название, артикул или штрихкод"
            />
          </div>
          <Tabs
            items={['Все', ...data['bar-categories'].map((row) => row.name)]}
            value={category}
            onChange={setCategory}
            label="Категории бара"
          />
          <div className="ws-product-grid">
            {products
              .filter(
                (row) =>
                  (category === 'Все' || row.category === category) &&
                  `${row.name} ${row.sku} ${row.barcode}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((product) => (
                <button
                  key={product.id}
                  disabled={(cart[product.id] || 0) >= Number(product.stock)}
                  onClick={() => setCart({ ...cart, [product.id]: (cart[product.id] || 0) + 1 })}
                >
                  <CupSoda size={23} />
                  <strong>{product.name}</strong>
                  <b>{money(product.price)}</b>
                  <small>
                    Остаток: {product.stock} {product.unit}
                  </small>
                </button>
              ))}
          </div>
        </section>
        <section className="panel ws-panel ws-check">
          <div className="ws-panel-heading">
            <h2>Текущий заказ</h2>
          </div>
          <div className="ws-panel-body ws-stack">
            {!lines.length && <Empty title="Заказ пуст" text="Выберите товар в каталоге." />}
            {lines.map(({ product, quantity }) => (
              <div className="ws-cart-line" key={product.id}>
                <strong>
                  {product.name}
                  <small>{money(Number(product.price) * quantity)}</small>
                </strong>
                <div className="ws-quantity">
                  <button
                    aria-label={`Уменьшить: ${product.name}`}
                    onClick={() => setCart({ ...cart, [product.id]: quantity - 1 })}
                  >
                    −
                  </button>
                  <span>{quantity}</span>
                  <button
                    aria-label={`Увеличить: ${product.name}`}
                    disabled={quantity >= Number(product.stock)}
                    onClick={() => setCart({ ...cart, [product.id]: quantity + 1 })}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <label className="form-field">
              <span>Оплата</span>
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Карта</option>
                <option>Наличные</option>
              </Select>
            </label>
            <div className="ws-total">
              <span>Итого</span>
              <strong>{money(total)}</strong>
            </div>
            <Button
              disabled={!lines.length}
              onClick={() => {
                if (lines.some((line) => line.quantity > Number(line.product.stock))) {
                  setMessage('Остатки изменились. Проверьте заказ.');
                  return;
                }
                lines.forEach(({ product, quantity }) => {
                  put('products', { ...product, stock: String(Number(product.stock) - quantity) });
                  put('ledger', {
                    id: demoId('sale'),
                    name: `${product.name} × ${quantity}`,
                    category: 'Бар',
                    date: TODAY,
                    club: clubName.split(' · ').at(-1) || 'Центральный',
                    client: 'Гость',
                    amount: String(Number(product.price) * quantity),
                    method,
                    status: 'Оплачено',
                  });
                });
                setCart({});
                setMessage('Демозаказ сохранён в кассе; остатки обновлены. Реальной оплаты нет.');
              }}
            >
              Подтвердить демозаказ
            </Button>
          </div>
        </section>
      </div>
      {closing && (
        <Modal
          title="Закрыть демосмену бара?"
          subtitle="Незавершённый заказ будет очищен. Сохранённые продажи останутся в кассе."
          onClose={close}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={close}>
              Продолжить работу
            </Button>
            <Button
              onClick={() => {
                setBarOpen(false);
                setCart({});
                close();
              }}
            >
              Закрыть смену
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function InventoryWorkspace({
  navigate,
  bar = false,
}: {
  navigate: Navigate;
  bar?: boolean;
}) {
  const { data, put } = useWorkspace();
  const productsCollection = bar ? 'products' : 'retail-products';
  const documentsCollection = bar ? 'inventory' : 'retail-inventory';
  const [form, setForm] = useState<DemoRecord | 'new' | null>(null);
  const [opened, setOpened] = useState<DemoRecord | null>(null);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState('');
  const closeForm = useCallback(() => setForm(null), []);
  const close = useCallback(() => {
    setOpened(null);
    setPosting(false);
  }, []);
  const fields: Field[] = [
    { key: 'name', label: 'Номер / название документа', required: true },
    {
      key: 'type',
      label: 'Операция',
      options: ['Поступление', 'Перемещение', 'Списание'],
      required: true,
    },
    { key: 'date', label: 'Дата', type: 'date', required: true },
    { key: 'supplier', label: 'Поставщик' },
    {
      key: 'from',
      label: 'Откуда',
      options: bar
        ? ['Центральный · Бар', 'Центральный · Склад', 'Парк · Бар']
        : ['Центральный · Ресепшен', 'Центральный · Склад', 'Парк · Ресепшен'],
    },
    {
      key: 'to',
      label: 'Куда',
      options: bar
        ? ['Центральный · Бар', 'Центральный · Склад', 'Парк · Бар']
        : ['Центральный · Ресепшен', 'Центральный · Склад', 'Парк · Ресепшен'],
    },
    {
      key: 'product',
      label: 'Товар',
      options: data[productsCollection].map((row) => row.name),
      required: true,
    },
    { key: 'qty', label: 'Количество в базовых единицах', type: 'number', min: 1, required: true },
    { key: 'cost', label: 'Закупочная цена, ₽', type: 'number', min: 0 },
    { key: 'batch', label: 'Партия' },
  ];
  const viewRows = data[documentsCollection].map((row) => ({
    ...row,
    product:
      data[productsCollection].find((product) => product.id === row.product)?.name || row.product,
  }));
  const post = () => {
    if (!opened || opened.status === 'Проведён') return;
    const product = data[productsCollection].find(
      (row) => row.id === opened.product || row.name === opened.product,
    );
    if (!product) {
      setMessage('Товар не найден в каталоге.');
      return;
    }
    let nextStock: number;
    try {
      nextStock = inventoryStock(opened, product);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось провести документ.');
      close();
      return;
    }
    put(productsCollection, { ...product, stock: String(nextStock) });
    put(documentsCollection, { ...opened, product: product.id, status: 'Проведён' });
    close();
    setMessage(
      opened.type === 'Перемещение'
        ? 'Демодокумент проведён. Общий остаток товара не изменился.'
        : 'Демодокумент проведён. Общий остаток товара обновлён.',
    );
  };
  return (
    <div className="ws-stack">
      <SectionLinks
        ids={bar ? ['bar-catalog', 'bar'] : ['products', 'services']}
        navigate={navigate}
      />
      {message && <Notice>{message}</Notice>}
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>Складские документы</h2>
            <p>
              В этом прототипе остатки общие. Учёт по отдельным складам требует уточнения правил.
            </p>
          </div>
          <Button onClick={() => setForm('new')}>
            <Plus size={15} />
            Документ
          </Button>
        </div>
        <DataTable
          rows={viewRows}
          columns={[
            { key: 'name', label: 'Документ' },
            { key: 'date', label: 'Дата' },
            { key: 'product', label: 'Товар' },
            { key: 'qty', label: 'Количество' },
            { key: 'status', label: 'Статус' },
          ]}
          onOpen={(row) =>
            setOpened(data[documentsCollection].find((record) => record.id === row.id)!)
          }
        />
      </section>
      {form && (
        <RecordForm
          title="Складской документ"
          fields={fields}
          initial={
            form === 'new'
              ? undefined
              : {
                  ...form,
                  product:
                    data[productsCollection].find((row) => row.id === form.product)?.name ||
                    form.product,
                }
          }
          onClose={closeForm}
          submit="Сохранить черновик"
          onSave={(record) => {
            put(documentsCollection, {
              ...record,
              product:
                data[productsCollection].find((row) => row.name === record.product)?.id ||
                record.product,
              status: 'Черновик',
            });
            closeForm();
            setMessage('Черновик сохранён. Остатки не изменились.');
          }}
        />
      )}
      {opened && (
        <RecordDetails
          title={opened.name}
          record={{
            ...opened,
            product:
              data[productsCollection].find((row) => row.id === opened.product)?.name ||
              opened.product,
          }}
          fields={fields}
          onClose={close}
          actions={
            opened.status === 'Черновик' ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setForm(opened);
                    close();
                  }}
                >
                  Редактировать
                </Button>
                {posting ? (
                  <div className="ws-confirm">
                    <p>
                      Провести документ? Он повлияет на демоостатки и станет доступен только для
                      просмотра.
                    </p>
                    <Button variant="secondary" onClick={() => setPosting(false)}>
                      Отмена
                    </Button>
                    <Button onClick={post}>Подтвердить проведение</Button>
                  </div>
                ) : (
                  <Button onClick={() => setPosting(true)}>Провести…</Button>
                )}
              </>
            ) : (
              <Status>Проведён</Status>
            )
          }
        />
      )}
    </div>
  );
}

export { CashWorkspace } from './CashWorkspace';
