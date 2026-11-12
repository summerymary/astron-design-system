import { accessWindowLabel, ageOnDate } from '../lib/registration';
import { daysInClub as countDaysInClub, demoStamp, nextDemoNow } from '../lib/demo-clock';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CalendarDays,
  Camera,
  Check,
  CreditCard,
  Edit3,
  Phone,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Plus,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import {
  Avatar,
  Button,
  DisclosureMenu,
  IconButton,
  Modal,
  StateContent,
  StatusBadge,
} from '../components/ui';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { Back, DataTable, Empty, Notice, RecordForm, Tabs } from '../components/WorkspaceUI';
import { TODAY } from '../data/workspace';
import { clientTabs, getClientProfile } from '../data/clientProfile';
import type { ClientTabId, SubscriptionStatus } from '../data/clientProfile';
import type { AdminSectionId } from '../data/admin';
import { visitKinds } from '../data/admin';
import { demoClubs } from '../data/roles';
import { profileBookingOptions } from '../data/profileBookings';
import { findClientChat, readChatMessages } from '../lib/client-messages';
import { ChatHistory } from '../components/ChatHistory';
import { MembershipTag } from '../components/MembershipTag';
import { clientName, hiddenPhone } from '../lib/client-display';
import { ClientComments, PinnedClientComment } from '../components/ClientComments';
import type { DemoUser, Member, Scenario, Visit } from '../types';
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
  return <Empty title={title} text={description} />;
}
export function ClientProfile({
  member,
  visits,
  bookings,
  canOperate,
  canSell = false,
  user,
  scenario,
  onReset,
  onBack,
  backLabel = 'К списку клиентов',
  onRegistration,
  onAction,
  onUpdate,
}: {
  member: Member;
  visits: Visit[];
  bookings: string[];
  canOperate: boolean;
  canSell?: boolean;
  user: DemoUser;
  scenario: Scenario;
  onReset: () => void;
  onBack: () => void;
  backLabel?: string;
  onRegistration: () => void;
  onAction: (id: AdminSectionId) => void;
  onUpdate: (member: Member) => void;
}) {
  const { data, put } = useWorkspace();
  const profile = getClientProfile(member, data);
  const clientAge = ageOnDate(profile.birthDate, TODAY);
  const [tab, setTab] = useState<ClientTabId>('subscriptions');
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
  const [callActive, setCallActive] = useState(false);
  const phoneHidden = user.role === 'administrator';
  const pinnedId =
    data['client-pins']?.find((row) => row.id === String(member.id))?.commentId || '';
  const pinnedNote = notes.find((row) => row.id === pinnedId);
  const [previewAction, setPreviewAction] = useState<string | null>(null);
  const closePreview = useCallback(() => setPreviewAction(null), []);
  const subscriptions = profile.subscriptions.filter((subscription) => subscription.kindId);
  const additionalServices = [
    ...profile.subscriptions
      .filter((subscription) => !subscription.kindId)
      .map((subscription) => ({
        id: subscription.id,
        name: subscription.name,
        boughtAt: subscription.boughtAt,
      })),
    ...(data['issued-services'] || [])
      .filter((row) => row.memberId === String(member.id))
      .map((row) => ({
        id: row.id,
        name: row.name,
        boughtAt: row.issued.split('-').reverse().join('.'),
      })),
  ];
  const shownSubscriptions = subscriptions.filter((s) => filter === 'all' || s.status === filter);
  const sortedVisits = [...visits].sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const upcoming = profileBookingOptions.filter((item) => bookings.includes(item.id));
  const daysInClub = countDaysInClub(member.joined);
  const balanceBlock = (
    <div className="client-balance">
      <span>
        <Wallet size={14} />
        Лицевой счёт
      </span>
      <strong>{money(profile.balance)}</strong>
      {canOperate && (
        <div>
          <Button variant="ghost" onClick={() => setPreviewAction('Пополнение счёта')}>
            Пополнить <Plus size={12} />
          </Button>
          <Button variant="ghost" onClick={() => setPreviewAction('Возврат средств')}>
            Возврат
          </Button>
        </div>
      )}
    </div>
  );
  return (
    <div className="client-page">
      <Back hideIcon className="client-return-link" onClick={onBack}>
        {backLabel === 'Назад' ? 'Вернуться' : backLabel}
      </Back>
      <div className="client-page-grid">
        <div className="client-main">
          <section className="client-identity" aria-label="Основные сведения клиента">
            <div className="client-identity-top">
              <div className="client-photo">
                <Avatar member={member} portrait />
                {canOperate && (
                  <IconButton
                    variant="secondary"
                    label="Сфотографировать клиента"
                    onClick={() => setPreviewAction('Фотография клиента')}
                  >
                    <Camera size={14} />
                  </IconButton>
                )}
              </div>
              <div className="client-name-block">
                <div className="client-name-copy">
                  <h1>{clientName(member)}</h1>
                  <div className="client-name-meta">
                    {member.archived && <span className="client-info-status">В архиве</span>}
                    <span>
                      <CreditCard size={13} />
                      Карта <b>{profile.card}</b>
                    </span>
                  </div>
                </div>
                {canOperate && (
                  <div className="client-profile-tools">
                    <IconButton
                      variant="secondary"
                      label="Редактировать клиента"
                      onClick={() => setForm('edit')}
                    >
                      <Edit3 size={18} />
                    </IconButton>
                    <DisclosureMenu
                      className="client-more"
                      label="Другие действия"
                      icon={<MoreHorizontal size={19} />}
                    >
                      <div>
                        {['Зачислить нулём', 'Продать подарочную', 'Добавить отзыв'].map(
                          (action) => (
                            <button
                              key={action}
                              type="button"
                              onClick={() => {
                                setPreviewAction(action);
                              }}
                            >
                              {action}
                            </button>
                          ),
                        )}
                      </div>
                    </DisclosureMenu>
                  </div>
                )}
              </div>
              <div className="client-facts-row">
                <dl className="client-contact-facts">
                  <Fact label="Телефон">
                    <span className="client-phone">
                      {phoneHidden ? hiddenPhone(member.phone) : member.phone}
                      <IconButton
                        variant="secondary"
                        label="Позвонить клиенту"
                        title="Позвонить клиенту"
                        onClick={() => {
                          setCallActive(false);
                          setPreviewAction('Звонок клиенту');
                        }}
                      >
                        <Phone size={18} />
                      </IconButton>
                    </span>
                  </Fact>
                  <Fact label="Дата рождения">{profile.birthDate}</Fact>
                  <Fact label="Пол">{profile.gender}</Fact>
                  <Fact label="Организация">{profile.organization}</Fact>
                </dl>
              </div>
              {balanceBlock}
              {!canOperate && canSell && (
                <div className="client-primary-actions">
                  <Button
                    variant="accent"
                    className="client-sell-button"
                    onClick={() => onAction('services')}
                  >
                    <ShoppingBag size={15} />
                    Продать
                  </Button>
                </div>
              )}
              {canOperate && (
                <div className="client-primary-actions">
                  <Button onClick={onRegistration}>
                    <Check size={15} />
                    Отметить посещение
                  </Button>
                  <Button
                    variant="accent"
                    className="client-sell-button"
                    onClick={() => onAction('services')}
                  >
                    <ShoppingBag size={15} />
                    Продать
                  </Button>
                </div>
              )}
            </div>
          </section>
          {canOperate && clientAge !== null && clientAge < 14 && (
            <Notice tone="warning">
              Клиенту {clientAge} лет. Занятия разрешены только с тренером или ответственным
              взрослым.
            </Notice>
          )}
          <PinnedClientComment
            note={pinnedNote}
            onAdd={canOperate ? () => setForm('comment') : undefined}
          />
          <section className="client-history" aria-label="Данные клиента">
            <Tabs
              className="client-tabs"
              items={clientTabs.map((item) => ({
                ...item,
                count: item.id === 'subscriptions' ? subscriptions.length : undefined,
              }))}
              value={tab}
              onChange={(value) => setTab(value as ClientTabId)}
              label="Разделы карточки клиента"
              idPrefix="client-tab"
              panelId="client-tab-panel"
            />
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
                                subscriptions.filter(
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
                                  {accessWindowLabel(sub) && (
                                    <small>{accessWindowLabel(sub)}</small>
                                  )}
                                  {sub.ageMin && (
                                    <small>
                                      Возраст {sub.ageMin}–{sub.ageMax} лет
                                    </small>
                                  )}
                                </div>
                                <StatusBadge>{subscriptionLabels[sub.status]}</StatusBadge>
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
                          Записей: {shownSubscriptions.length} из {subscriptions.length}
                        </span>
                        <span>Архив сохраняется в истории клиента</span>
                      </div>
                    </>
                  )}
                  {tab === 'info' && (
                    <div className="client-info-groups">
                      <section className="ws-client-overview">
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
                          <Fact label="Личный кабинет">
                            {profile.personalAccount ? 'Есть' : 'Нет'}
                          </Fact>
                          <Fact label="Приложение">{profile.mobileApp ? 'Есть' : 'Нет'}</Fact>
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
                  {tab === 'finances' && additionalServices.length > 0 && (
                    <section className="ws-panel-body" aria-label="Дополнительные услуги клиента">
                      <h3>Дополнительные услуги</h3>
                      <ul className="client-service-list">
                        {additionalServices.map((service) => (
                          <li key={service.id}>
                            <strong>{service.name}</strong>
                            <span>Куплено {service.boughtAt}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {tab === 'comments' && (
                    <ClientComments
                      notes={notes}
                      pinnedId={pinnedId}
                      onPin={
                        canOperate
                          ? (commentId) => put('client-pins', { id: String(member.id), commentId })
                          : undefined
                      }
                      onAdd={canOperate ? () => setForm('comment') : undefined}
                    />
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
                          <section key={row.id} aria-label={`Канал: ${row.channel}`}>
                            <h3>{row.channel}</h3>
                            <ChatHistory
                              entries={readChatMessages(row)}
                              name={clientName(member)}
                            />
                          </section>
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
      </div>
      {previewAction && (
        <Modal title={previewAction} subtitle={clientName(member)} onClose={closePreview}>
          {previewAction === 'Звонок клиенту' ? (
            <div className="client-call-panel">
              <Phone size={28} />
              <h3>{clientName(member)}</h3>
              <p>{phoneHidden ? hiddenPhone(member.phone) : member.phone}</p>
              <p role="status">
                {callActive
                  ? 'Демонстрационный звонок идёт'
                  : 'В прототипе звонок будет имитирован, без внешнего соединения.'}
              </p>
              <Button
                onClick={() => {
                  if (callActive) closePreview();
                  else setCallActive(true);
                }}
              >
                {callActive ? 'Завершить звонок' : 'Начать демозвонок'}
              </Button>
            </div>
          ) : (
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
          )}
        </Modal>
      )}
      {form === 'comment' && (
        <RecordForm
          title="Добавить комментарий"
          fields={[
            { key: 'text', label: 'Комментарий для сотрудников', type: 'textarea', required: true },
          ]}
          onClose={closeForm}
          onSave={(record) => {
            if (!record.text.trim()) return 'Напишите комментарий.';
            put('comments', {
              ...record,
              text: record.text.trim(),
              memberId: String(member.id),
              author: user.name,
              createdAt: demoStamp(nextDemoNow()),
            });
            closeForm();
            setTab('comments');
          }}
        />
      )}
      {form === 'edit' && (
        <RecordForm
          title="Сведения о клиенте"
          fields={[
            { key: 'fullName', label: 'Фамилия, имя, отчество', required: true },
            { key: 'phone', label: 'Телефон', type: 'tel', required: true },
            { key: 'birthDate', label: 'Дата рождения', type: 'date' },
            { key: 'gender', label: 'Пол', options: ['Не указан', 'Женский', 'Мужской'] },
            { key: 'organization', label: 'Организация' },
            { key: 'email', label: 'Электронная почта', type: 'email' },
            { key: 'tags', label: 'Теги через запятую' },
          ]}
          initial={{
            id: String(member.id),
            fullName: member.fullName || member.name,
            phone: member.phone,
            birthDate:
              member.birthDate ??
              (profile.birthDate === 'Не указана'
                ? ''
                : profile.birthDate.split('.').reverse().join('-')),
            gender: profile.gender,
            organization: profile.organization === 'Не привязан' ? '' : profile.organization,
            email: member.email,
            tags: member.tags || '',
          }}
          onClose={closeForm}
          onSave={(record) => {
            if (!record.fullName.trim()) return 'Укажите фамилию, имя и отчество.';
            if (
              !/^\+?[\d\s()−-]+$/.test(record.phone) ||
              !/^\d{10,15}$/.test(record.phone.replace(/\D/g, ''))
            )
              return 'Укажите телефон: от 10 до 15 цифр.';
            onUpdate({
              ...member,
              name: record.fullName.trim(),
              fullName: record.fullName.trim(),
              phone: record.phone.trim(),
              birthDate: record.birthDate,
              gender: record.gender,
              organization: record.organization.trim(),
              email: record.email.trim(),
              tags: record.tags,
            });
            put('logs', {
              id: demoId('log'),
              name: 'Изменение карточки клиента',
              memberId: String(member.id),
              date: demoStamp(nextDemoNow()),
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
