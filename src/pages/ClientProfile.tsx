import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Infinity as InfinityIcon,
  MessageSquare,
  MoreHorizontal,
  Plus,
  ShoppingBag,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { Avatar, Badge, Button, Modal, StateContent } from '../components/ui';
import { AdminQuickLinks } from '../components/AdminQuickLinks';
import { clientTabs, getClientProfile } from '../data/clientProfile';
import type { ClientTabId, SubscriptionStatus } from '../data/clientProfile';
import type { AdminSectionId } from '../data/admin';
import { visitKinds } from '../data/admin';
import { demoClubs } from '../data/roles';
import { profileBookingOptions } from '../data/profileBookings';
import type { Member, Scenario, Visit } from '../types';

const subscriptionLabels: Record<SubscriptionStatus, string> = {
  active: 'Действует',
  expired: 'Завершён',
  pending: 'Не активирован',
  paused: 'Заморожен',
};
const money = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;
const dateTime = (value: string) => {
  const [date, time] = value.split('T');
  return `${date.split('-').reverse().join('.')} · ${time}`;
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function EmptyTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="client-tab-empty">
      <span>
        <FileText size={23} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function ClientProfile({
  member,
  visits,
  bookings,
  canOperate,
  scenario,
  onReset,
  onBack,
  onRegistration,
  onAction,
}: {
  member: Member;
  visits: Visit[];
  bookings: string[];
  canOperate: boolean;
  scenario: Scenario;
  onReset: () => void;
  onBack: () => void;
  onRegistration: () => void;
  onAction: (id: AdminSectionId) => void;
}) {
  const profile = getClientProfile(member);
  const [tab, setTab] = useState<ClientTabId>('subscriptions');
  const [filter, setFilter] = useState('all');
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [previewAction, setPreviewAction] = useState<string | null>(null);
  const closePreview = useCallback(() => setPreviewAction(null), []);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const shownSubscriptions = profile.subscriptions.filter(
    (s) => filter === 'all' || s.status === filter,
  );
  const sortedVisits = [...visits].sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));
  const activeCount = profile.subscriptions.filter((s) => s.status === 'active').length;
  const currentTab = clientTabs.find((t) => t.id === tab)!;
  const maskedPhone = member.phone.startsWith('+7')
    ? `+7 ••• •••-••-${member.phone.replace(/\D/g, '').slice(-2)}`
    : member.phone;
  const upcoming = profileBookingOptions.filter((item) => bookings.includes(item.id));
  const [joinDay, joinMonth, joinYear] = member.joined.split('.').map(Number);
  const daysInClub = Math.max(
    0,
    Math.floor((Date.UTC(2026, 10, 1) - Date.UTC(joinYear, joinMonth - 1, joinDay)) / 86400000),
  );
  return (
    <div className="client-page">
      <div className="client-page-topline">
        <button className="client-back" onClick={onBack}>
          <ArrowLeft size={15} />
          Назад
        </button>
        <span>
          Клиенты <span>/</span> Карточка клиента
        </span>
        <span className="client-demo-label">Демоданные</span>
      </div>
      <div className="client-page-grid">
        <div className="client-main">
          <section className="client-identity" aria-label="Основные сведения клиента">
            <div className="client-identity-top">
              <div className="client-photo">
                <Avatar member={member} />
                {canOperate && (
                  <button
                    aria-label="Сфотографировать клиента"
                    onClick={() => setPreviewAction('Фотография клиента')}
                  >
                    <Camera size={14} />
                  </button>
                )}
              </div>
              <div className="client-name-block">
                <span className="eyebrow">КЛИЕНТ КЛУБА · #{member.id}</span>
                <h1>
                  {member.name}
                  <span>.</span>
                </h1>
                <div className="client-name-meta">
                  <Badge status={member.status} />
                  <span>
                    <CreditCard size={13} />
                    Карта <b>{profile.card}</b>
                  </span>
                  <span>В клубе с {member.joined}</span>
                </div>
              </div>
              {canOperate && (
                <div className="client-primary-actions">
                  <Button onClick={onRegistration}>
                    <Check size={15} />
                    Отметить посещение
                  </Button>
                  <Button variant="secondary" onClick={() => onAction('services')}>
                    <ShoppingBag size={15} />
                    Продать
                  </Button>
                  <details className="client-more">
                    <summary aria-label="Другие действия">
                      <MoreHorizontal size={19} />
                    </summary>
                    <div>
                      {[
                        'Редактировать данные',
                        'Зачислить нулём',
                        'Продать подарочную',
                        'Добавить комментарий',
                        'Добавить отзыв',
                      ].map((action) => (
                        <button
                          key={action}
                          onClick={(e) => {
                            e.currentTarget.closest('details')?.removeAttribute('open');
                            setPreviewAction(action);
                          }}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
            <div className="client-facts-row">
              <dl className="client-contact-facts">
                <Fact label="Телефон">
                  <span className="client-phone">
                    {phoneVisible ? member.phone : maskedPhone}
                    <button
                      aria-label={phoneVisible ? 'Скрыть телефон' : 'Показать телефон'}
                      aria-pressed={phoneVisible}
                      onClick={() => setPhoneVisible(!phoneVisible)}
                    >
                      {phoneVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </span>
                </Fact>
                <Fact label="Дата рождения">{profile.birthDate}</Fact>
                <Fact label="Пол">{profile.gender}</Fact>
                <Fact label="Организация">{profile.organization}</Fact>
              </dl>
              <div className="client-balance">
                <span>
                  <Wallet size={14} />
                  Лицевой счёт
                </span>
                <strong>{money(profile.balance)}</strong>
                {canOperate && (
                  <div>
                    <button onClick={() => setPreviewAction('Пополнение счёта')}>
                      Пополнить <Plus size={12} />
                    </button>
                    <button onClick={() => setPreviewAction('Возврат средств')}>Возврат</button>
                  </div>
                )}
              </div>
            </div>
            <div className="client-context-row">
              <div>
                <span className={profile.personalAccount ? 'connected' : ''}>
                  <Check size={12} />
                  Личный кабинет: {profile.personalAccount ? 'есть' : 'нет'}
                </span>
                <span className={profile.mobileApp ? 'connected' : ''}>
                  <Smartphone size={12} />
                  Приложение: {profile.mobileApp ? 'есть' : 'нет'}
                </span>
              </div>
              <p>
                <MessageSquare size={13} />
                {profile.note || 'Комментарий к карточке пока не добавлен'}
              </p>
            </div>
          </section>

          <section className="client-history" aria-label="Данные клиента">
            <div className="client-tabs" role="tablist" aria-label="Разделы карточки клиента">
              {clientTabs.map((item, i) => (
                <button
                  key={item.id}
                  id={`client-tab-${item.id}`}
                  role="tab"
                  aria-selected={tab === item.id}
                  aria-controls="client-tab-panel"
                  tabIndex={tab === item.id ? 0 : -1}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  onClick={() => setTab(item.id)}
                  onKeyDown={(event) => {
                    let next = i;
                    if (event.key === 'ArrowRight') next = (i + 1) % clientTabs.length;
                    else if (event.key === 'ArrowLeft')
                      next = (i - 1 + clientTabs.length) % clientTabs.length;
                    else if (event.key === 'Home') next = 0;
                    else if (event.key === 'End') next = clientTabs.length - 1;
                    else return;
                    event.preventDefault();
                    setTab(clientTabs[next].id);
                    tabRefs.current[next]?.focus();
                  }}
                >
                  {item.label}
                  {item.id === 'subscriptions' && <span>{profile.subscriptions.length}</span>}
                </button>
              ))}
            </div>
            <div
              id="client-tab-panel"
              role="tabpanel"
              aria-labelledby={`client-tab-${tab}`}
              tabIndex={0}
            >
              {scenario !== 'default' ? (
                <StateContent
                  scenario={scenario}
                  onReset={onReset}
                  onAdd={onReset}
                  emptyState={{
                    title: 'В этом разделе пока нет записей',
                    description: 'Данные появятся после действий с клиентом.',
                    actionLabel: 'Показать демоданные',
                  }}
                />
              ) : (
                <>
                  <div className="client-section-heading">
                    <div>
                      <h2>
                        {currentTab.label}
                        {tab === 'subscriptions' && <span>{activeCount} действующих</span>}
                      </h2>
                      <p>
                        {tab === 'subscriptions'
                          ? 'Абонементы, услуги и покупки клиента.'
                          : tab === 'visits'
                            ? 'Последние посещения во всех клубах сети.'
                            : tab === 'finances'
                              ? 'Операции по лицевому счёту клиента.'
                              : tab === 'info'
                                ? 'Контакты, предпочтения и сведения о клиенте.'
                                : tab === 'bookings'
                                  ? 'Ближайшие занятия, на которые записан клиент.'
                                  : 'История взаимодействий с клиентом.'}
                      </p>
                    </div>
                    {tab === 'subscriptions' && canOperate && (
                      <button className="client-text-action" onClick={() => onAction('services')}>
                        Продать услугу <ArrowUpRight size={14} />
                      </button>
                    )}
                  </div>
                  {tab === 'subscriptions' && (
                    <>
                      <div className="client-sub-filters" aria-label="Фильтр абонементов">
                        {[
                          { id: 'all', label: 'Все' },
                          { id: 'active', label: 'Действующие' },
                          { id: 'pending', label: 'Не активированы' },
                          { id: 'expired', label: 'Завершённые' },
                          { id: 'paused', label: 'Замороженные' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            aria-pressed={filter === item.id}
                            onClick={() => setFilter(item.id)}
                          >
                            {item.label}
                            <span>
                              {
                                profile.subscriptions.filter(
                                  (s) => item.id === 'all' || s.status === item.id,
                                ).length
                              }
                            </span>
                          </button>
                        ))}
                      </div>
                      {shownSubscriptions.length ? (
                        <div className="client-table-wrap">
                          <table className="client-sub-table">
                            <caption className="sr-only">Абонементы и услуги клиента</caption>
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Наименование</th>
                                <th>
                                  Совершено
                                  <br />
                                  посещений
                                </th>
                                <th>
                                  Дата
                                  <br />
                                  покупки
                                </th>
                                <th>
                                  Дата
                                  <br />
                                  активации
                                </th>
                                <th>
                                  Осталось
                                  <br />
                                  посещений
                                </th>
                                <th>
                                  Дата
                                  <br />
                                  окончания
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {shownSubscriptions.map((sub) => (
                                <tr key={sub.id} className={`subscription-${sub.status}`}>
                                  <td data-label="ID">
                                    <span className="client-record-id">{sub.id}</span>
                                  </td>
                                  <td data-label="Наименование">
                                    <strong>{sub.name}</strong>
                                    <span className={`subscription-status status-${sub.status}`}>
                                      <i />
                                      {subscriptionLabels[sub.status]}
                                    </span>
                                  </td>
                                  <td data-label="Совершено посещений">{sub.used}</td>
                                  <td data-label="Дата покупки">{sub.boughtAt}</td>
                                  <td data-label="Дата активации">
                                    {sub.activatedAt ?? 'Не активирован'}
                                  </td>
                                  <td data-label="Осталось посещений">
                                    {sub.remaining === null ? (
                                      <span
                                        className="client-unlimited"
                                        aria-label="Без ограничений"
                                      >
                                        <InfinityIcon size={17} />
                                      </span>
                                    ) : (
                                      <b>{sub.remaining}</b>
                                    )}
                                  </td>
                                  <td data-label="Дата окончания">{sub.endsAt ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <EmptyTab
                          title="Нет абонементов в этой категории"
                          description="Выберите другую категорию, чтобы посмотреть остальные покупки."
                        />
                      )}
                      <div className="client-table-footer">
                        <span>
                          Записей: {shownSubscriptions.length} из {profile.subscriptions.length}
                        </span>
                        <span>Архив сохраняется в истории клиента</span>
                      </div>
                    </>
                  )}
                  {tab === 'info' && (
                    <div className="client-info-groups">
                      <section>
                        <h3>Контакты и профиль</h3>
                        <dl>
                          <Fact label="E-mail">{member.email || 'Не указан'}</Fact>
                          <Fact label="Адрес">Не указан</Fact>
                          <Fact label="Цель тренировки">{profile.goal}</Fact>
                          <Fact label="Организация">{profile.organization}</Fact>
                          <Fact label="Социальные сети">Не указаны</Fact>
                          <Fact label="Документ на льготу">Не добавлен</Fact>
                        </dl>
                      </section>
                      <section>
                        <h3>Участие в клубе</h3>
                        <dl>
                          <Fact label="Дата регистрации">{member.joined}</Fact>
                          <Fact label="Время жизни">{daysInClub} дн. в клубе</Fact>
                          <Fact label="Последний визит">
                            {sortedVisits[0] ? dateTime(sortedVisits[0].enteredAt) : 'Нет записей'}
                          </Fact>
                          <Fact label="Источник">{profile.source}</Fact>
                          <Fact label="Реферал">Не указан</Fact>
                          <Fact label="Получать СМС">{profile.smsConsent ? 'Да' : 'Нет'}</Fact>
                          <Fact label="Получать письма">{profile.emailConsent ? 'Да' : 'Нет'}</Fact>
                          <Fact label="Чёрный список">Нет</Fact>
                          <Fact label="Загруженные документы">Нет документов</Fact>
                          <Fact label="Скидка в честь дня рождения">Не задана</Fact>
                        </dl>
                      </section>
                    </div>
                  )}
                  {tab === 'visits' &&
                    (sortedVisits.length ? (
                      <div className="client-table-wrap">
                        <table className="client-simple-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Дата посещения</th>
                              <th>Место посещения</th>
                              <th>Клуб</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedVisits.map((visit, i) => (
                              <tr key={visit.id}>
                                <td>{String(i + 1).padStart(2, '0')}</td>
                                <td>{dateTime(visit.enteredAt)}</td>
                                <td>{visitKinds[visit.kind]}</td>
                                <td>{demoClubs.find((c) => c.id === visit.clubId)?.name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyTab
                        title="Посещений пока нет"
                        description="Здесь появятся зарегистрированные посещения клиента."
                      />
                    ))}
                  {tab === 'finances' &&
                    (profile.balance > 0 ? (
                      <div className="client-table-wrap">
                        <table className="client-simple-table">
                          <thead>
                            <tr>
                              <th>Тип операции</th>
                              <th>Сумма</th>
                              <th>Время операции</th>
                              <th>Описание</th>
                              <th>Финансовая операция</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>Пополнение</td>
                              <td>
                                <strong className="client-positive">
                                  +{money(profile.balance)}
                                </strong>
                              </td>
                              <td>28.10.2026 · 18:42</td>
                              <td>Пополнение лицевого счёта</td>
                              <td>DEMO-{member.id}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyTab
                        title="Операций пока нет"
                        description="История операций по лицевому счёту будет отображаться здесь."
                      />
                    ))}
                  {tab === 'comments' &&
                    (profile.note ? (
                      <div className="client-comment">
                        <span className="client-comment-avatar">АК</span>
                        <div>
                          <strong>
                            Александра Крылова <small>Администратор · 28 октября, 18:45</small>
                          </strong>
                          <p>{profile.note}</p>
                        </div>
                      </div>
                    ) : (
                      <EmptyTab
                        title="Комментариев пока нет"
                        description="Здесь будут заметки сотрудников о клиенте."
                      />
                    ))}
                  {tab === 'actions' && (
                    <EmptyTab
                      title="Журнал действий ещё не заполнен"
                      description="Здесь будет история изменений карточки. Состав записей будет определён на следующем этапе."
                    />
                  )}
                  {tab === 'bookings' &&
                    (upcoming.length ? (
                      <div className="client-bookings">
                        {upcoming.map((item) => (
                          <div key={item.id}>
                            <span>
                              <CalendarDays size={20} />
                            </span>
                            <div>
                              <strong>{item.title}</strong>
                              <small>{item.subtitle}</small>
                            </div>
                            <b>{item.time}</b>
                            <span className="client-booking-status">Записан</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyTab
                        title="Нет ближайших записей"
                        description="Клиент пока не записан на занятия."
                      />
                    ))}
                  {tab === 'reviews' && (
                    <EmptyTab
                      title="Отзывов пока нет"
                      description="Отзывы клиента будут собраны в этом разделе."
                    />
                  )}
                  {tab === 'calls' && (
                    <EmptyTab
                      title="Звонков пока нет"
                      description="Здесь будет история звонков клиенту."
                    />
                  )}
                  {tab === 'messages' && (
                    <EmptyTab
                      title="Переписка пока не начата"
                      description="Здесь будут сообщения и история общения с клиентом."
                    />
                  )}
                </>
              )}
            </div>
          </section>
        </div>
        {canOperate && <AdminQuickLinks onAction={onAction} />}
      </div>
      {previewAction && (
        <Modal title={previewAction} subtitle={member.name} onClose={closePreview}>
          <div className="client-action-preview">
            <span>
              <FileText size={27} />
            </span>
            <h3>Экран в разработке</h3>
            <p>
              Экран и доступные действия будут разработаны на следующем этапе. Операции пока не
              выполняются.
            </p>
            <Button variant="secondary" onClick={closePreview}>
              К карточке клиента
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
