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
  MessageSquare,
  MoreHorizontal,
  Plus,
  ShoppingBag,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { Avatar, Badge, Button, Modal, StateContent } from '../components/ui';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { DataTable, RecordForm, Stats } from '../components/WorkspaceUI';
import { AdminQuickLinks } from '../components/AdminQuickLinks';
import { clientTabs, getClientProfile } from '../data/clientProfile';
import type { ClientTabId, SubscriptionStatus } from '../data/clientProfile';
import type { AdminSectionId } from '../data/admin';
import { visitKinds } from '../data/admin';
import { demoClubs } from '../data/roles';
import { profileBookingOptions } from '../data/profileBookings';
import { findClientChat, readChatMessages } from '../lib/client-messages';
import { MembershipTag } from '../components/MembershipTag';
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
  onUpdate,
  showQuickLinks = true,
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
  onUpdate: (member: Member) => void;
  showQuickLinks?: boolean;
}) {
  const { data, put } = useWorkspace();
  const profile = getClientProfile(member, data);
  const [tab, setTab] = useState<ClientTabId>('info');
  const [form, setForm] = useState<'edit' | 'comment' | null>(null);
  const closeForm = useCallback(() => setForm(null), []);
  const clientSales = data.ledger.filter(
    (row) =>
      row.category !== 'Бар' && (row.memberId === String(member.id) || row.client === member.name),
  );
  const notes = (data.comments || []).filter((row) => row.memberId === String(member.id));
  const eventBookings = data.events.filter((row) =>
    (row.attendees || '').split(',').includes(String(member.id)),
  );
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
      <div className="client-page-grid">
        <div className="client-main">
          <section className="client-identity" aria-label="Основные сведения клиента">
            <div className="client-identity-top">
              <button
                className="client-back icon-button"
                aria-label="К списку клиентов"
                title="К списку клиентов"
                onClick={onBack}
              >
                <ArrowLeft size={18} />
              </button>
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
                <h1>{member.name}</h1>
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
                  <Button
                    variant="secondary"
                    onClick={() => onAction('messages')}
                    aria-label="Написать сообщение"
                  >
                    <MessageSquare size={15} />
                    Написать
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
                            if (action === 'Редактировать данные') setForm('edit');
                            else if (action === 'Добавить комментарий') setForm('comment');
                            else setPreviewAction(action);
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
                  {tab === 'subscriptions' && (
                    <div className="client-section-heading">
                      <span>{activeCount} действующих</span>
                      {canOperate && (
                        <button className="client-text-action" onClick={() => onAction('services')}>
                          Продать услугу <ArrowUpRight size={14} />
                        </button>
                      )}
                    </div>
                  )}
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
                        <ul className="client-membership-list" aria-label="Абонементы клиента">
                          {shownSubscriptions.map((sub) => (
                            <li key={sub.id}>
                              <div className="client-membership-row">
                                <div className="client-membership-name" title={sub.name}>
                                  <MembershipTag name={sub.name} kindId={sub.kindId} textOnly />
                                </div>
                                <span className={`subscription-status status-${sub.status}`}>
                                  <i aria-hidden="true" />
                                  {subscriptionLabels[sub.status]}
                                </span>
                                <div>
                                  <small>{sub.endsAt ? 'Действует до' : 'Активация'}</small>
                                  <strong>{sub.endsAt || 'Ожидается'}</strong>
                                </div>
                                <div>
                                  <small>Остаток</small>
                                  <strong>
                                    {sub.remaining === null ? 'Безлимит' : sub.remaining}
                                  </strong>
                                </div>
                              </div>
                              <details className="client-membership-details ws-disclosure">
                                <summary>Подробнее</summary>
                                <dl className="ws-facts">
                                  <Fact label="Покупка">{sub.boughtAt}</Fact>
                                  <Fact label="Активация">
                                    {sub.activatedAt || 'Не активирован'}
                                  </Fact>
                                  <Fact label="Действует до">
                                    {sub.endsAt || 'Срок начнётся после активации'}
                                  </Fact>
                                  <Fact label="Посещений использовано">{sub.used}</Fact>
                                  <Fact label="Номер">{sub.id}</Fact>
                                </dl>
                              </details>
                            </li>
                          ))}
                        </ul>
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
                      <section className="ws-client-overview">
                        <Stats
                          items={[
                            {
                              label: 'Оплачено в демопримерах',
                              value: money(
                                clientSales.reduce((sum, row) => sum + Number(row.amount), 0),
                              ),
                            },
                            { label: 'Продажи', value: clientSales.length },
                            {
                              label: 'Статус клиента',
                              value: member.archived ? 'В архиве' : 'Активен',
                            },
                          ]}
                        />
                        <div className="client-info-summary-footer">
                          <p className="ws-muted">Теги: {member.tags || 'Не добавлены'}</p>
                          {canOperate && (
                            <Button variant="secondary" onClick={() => setForm('edit')}>
                              Редактировать сведения
                            </Button>
                          )}
                        </div>
                      </section>
                      <section className="client-info-card" aria-labelledby="client-contacts-title">
                        <h3 id="client-contacts-title">Контакты</h3>
                        <dl>
                          <Fact label="Электронная почта">{member.email || 'Не указана'}</Fact>
                          <Fact label="Адрес">Не указан</Fact>
                          <Fact label="Социальные сети">Не указаны</Fact>
                          <Fact label="Организация">{profile.organization}</Fact>
                        </dl>
                      </section>
                      <section className="client-info-card" aria-labelledby="client-history-title">
                        <h3 id="client-history-title">История в клубе</h3>
                        <dl>
                          <Fact label="Дата регистрации">{member.joined}</Fact>
                          <Fact label="Дней в клубе">{daysInClub}</Fact>
                          <Fact label="Последний визит">
                            {sortedVisits[0] ? dateTime(sortedVisits[0].enteredAt) : 'Нет записей'}
                          </Fact>
                          <Fact label="Как узнал о клубе">{profile.source}</Fact>
                          <Fact label="Кто рекомендовал">Не указан</Fact>
                        </dl>
                      </section>
                      <section className="client-info-card" aria-labelledby="client-training-title">
                        <h3 id="client-training-title">Тренировки и документы</h3>
                        <dl>
                          <Fact label="Цель тренировок">{profile.goal}</Fact>
                          <Fact label="Документ на льготу">Не добавлен</Fact>
                          <Fact label="Загруженные документы">Нет документов</Fact>
                          <Fact label="Скидка ко дню рождения">Не задана</Fact>
                        </dl>
                      </section>
                      <section className="client-info-card" aria-labelledby="client-consents-title">
                        <h3 id="client-consents-title">Связь и доступ</h3>
                        <dl>
                          <Fact label="Получать СМС">
                            <span className="client-info-status">
                              {profile.smsConsent ? <Check size={15} aria-hidden="true" /> : null}
                              {profile.smsConsent ? 'Да' : 'Нет'}
                            </span>
                          </Fact>
                          <Fact label="Получать письма">
                            <span className="client-info-status">
                              {profile.emailConsent ? <Check size={15} aria-hidden="true" /> : null}
                              {profile.emailConsent ? 'Да' : 'Нет'}
                            </span>
                          </Fact>
                          <Fact label="Чёрный список">
                            <span className="client-info-status">Нет</span>
                          </Fact>
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
                  {tab === 'finances' && !!clientSales.length && (
                    <div className="ws-panel-body">
                      <h3>Покупки в прототипе</h3>
                      <DataTable
                        rows={clientSales}
                        columns={[
                          { key: 'name', label: 'Покупка' },
                          { key: 'date', label: 'Дата' },
                          { key: 'amount', label: 'Оплачено, ₽' },
                          { key: 'creditAmount', label: 'В долг, ₽' },
                          { key: 'status', label: 'Статус' },
                          { key: 'method', label: 'Оплата' },
                        ]}
                      />
                    </div>
                  )}
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
                  {tab === 'comments' && (
                    <div className="ws-panel-body ws-stack">
                      {notes.map((row) => (
                        <div className="client-comment" key={row.id}>
                          <div>
                            <strong>
                              Александра Крылова <small>Сегодня</small>
                            </strong>
                            <p>{row.text}</p>
                          </div>
                        </div>
                      ))}
                      {canOperate && (
                        <Button variant="secondary" onClick={() => setForm('comment')}>
                          <Plus size={14} />
                          Добавить заметку
                        </Button>
                      )}
                    </div>
                  )}
                  {tab === 'actions' && (
                    <DataTable
                      rows={data.logs.filter((row) => row.memberId === String(member.id))}
                      columns={[
                        { key: 'date', label: 'Время' },
                        { key: 'name', label: 'Действие' },
                        { key: 'user', label: 'Сотрудник' },
                      ]}
                      empty={
                        <EmptyTab
                          title="Действий пока нет"
                          description="Изменения карточки и новые посещения появятся здесь."
                        />
                      }
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
                  {tab === 'bookings' && !!eventBookings.length && (
                    <div className="ws-panel-body">
                      <h3>Новые записи из расписания</h3>
                      <DataTable
                        rows={eventBookings}
                        columns={[
                          { key: 'name', label: 'Занятие' },
                          { key: 'day', label: 'Дата' },
                          { key: 'time', label: 'Начало' },
                          { key: 'room', label: 'Зал' },
                        ]}
                      />
                    </div>
                  )}
                  {tab === 'calls' && (
                    <EmptyTab
                      title="Звонков пока нет"
                      description="Здесь будет история звонков клиенту."
                    />
                  )}
                  {tab === 'messages' && (
                    <div className="ws-panel-body ws-stack">
                      {data.chats
                        .filter((row) => row.memberId === String(member.id))
                        .map((row) => (
                          <div className="ws-chat-history" key={row.id}>
                            {readChatMessages(row).map((entry, index) => (
                              <p key={index} className={entry.sender === 'club' ? 'from-club' : ''}>
                                <span className="sr-only">
                                  {entry.sender === 'club' ? 'Клуб: ' : 'Клиент: '}
                                </span>
                                {entry.text}
                              </p>
                            ))}
                          </div>
                        ))}
                      {!data.chats.some((row) => row.memberId === String(member.id)) && (
                        <p>Переписка пока не начата.</p>
                      )}
                      {canOperate && (
                        <Button variant="secondary" onClick={() => onAction('messages')}>
                          <MessageSquare size={15} />
                          {findClientChat(data.chats, member.id)
                            ? 'Открыть чат'
                            : 'Написать сообщение'}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
        {canOperate && showQuickLinks && <AdminQuickLinks onAction={onAction} />}
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
      {form === 'comment' && (
        <RecordForm
          title="Новая заметка"
          fields={[
            { key: 'text', label: 'Комментарий для сотрудников', type: 'textarea', required: true },
          ]}
          onClose={closeForm}
          onSave={(record) => {
            put('comments', { ...record, memberId: String(member.id) });
            closeForm();
            setTab('comments');
          }}
        />
      )}
      {form === 'edit' && (
        <RecordForm
          title="Сведения о клиенте"
          fields={[
            { key: 'name', label: 'Имя и фамилия', required: true },
            { key: 'fullName', label: 'Полное ФИО' },
            { key: 'phone', label: 'Телефон', type: 'tel' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'tags', label: 'Теги через запятую' },
            { key: 'clientState', label: 'Статус клиента', options: ['Активен', 'В архиве'] },
          ]}
          initial={{
            id: String(member.id),
            name: member.name,
            fullName: member.fullName || member.name,
            phone: member.phone,
            email: member.email,
            tags: member.tags || '',
            clientState: member.archived ? 'В архиве' : 'Активен',
          }}
          onClose={closeForm}
          onSave={(record) => {
            onUpdate({
              ...member,
              name: record.name,
              fullName: record.fullName,
              phone: record.phone,
              email: record.email,
              tags: record.tags,
              archived: record.clientState === 'В архиве',
            });
            put('logs', {
              id: demoId('log'),
              name: 'Изменение карточки клиента',
              memberId: String(member.id),
              date: '2026-11-06T14:40',
              user: 'Александра Крылова',
              service: 'Клиенты',
              type: 'Аудит',
              request: 'DEMO',
              status: 'Выполнено',
              description: 'Изменены демонстрационные сведения клиента.',
            });
            closeForm();
          }}
        />
      )}
    </div>
  );
}
