import { ClientFinanceJournal } from './ClientFinanceJournal';
import { managementMetrics, managementNetworkMetric } from '../data/management-metrics';
import { ProductCard } from './ProductCard';
import { ClientActionButton } from './ClientActionButton';
import { ClientPhotoDialog } from './ClientPhotoDialog';
import { QuantityStepper } from './QuantityStepper';
import { VisitPassList } from './VisitPassList';
import { getClientProfile } from '../data/clientProfile';
import { availableVisitPasses } from '../lib/registration';
import { useState } from 'react';
import { Check, Edit3, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  CountBadge,
  DisclosureMenu,
  IconButton,
  Modal,
  SectionTitle,
  StatusBadge,
} from './ui';
import { Notice, SearchBox, Stats, Tabs, SegmentedFilter } from './WorkspaceUI';
import { ClientSearch } from './ClientSearch';
import { initialMembers } from '../data/mock';
import { UI_RULES } from '../design-system/registry';
import { ReportCatalogue } from './ReportCatalogue';
import { ReportBars } from './ReportBars';
import { ReportChart } from './ReportChart';
import { ReportMonthPicker } from './ReportMonthPicker';
import { ReportWeekPicker } from './ReportWeekPicker';
import { statisticsReports, reportTitle } from '../data/statistics';
import { ReceptionShift } from './ReceptionShift';
import { CatalogSectionCard, CatalogSectionGrid } from './CatalogSectionCard';
import { MembershipCatalog } from './MembershipCatalog';
import { matchesCatalogPlan } from '../lib/membership-catalog';
import { planSaleSection } from '../lib/sale-catalog';
import { MembershipCard } from './MembershipCard';
import { ScheduleCopyDialog } from './ScheduleCopyDialog';
import { createWorkspaceData } from '../data/workspace';
import { planWeekCopy } from '../lib/schedule-copy';
import { ClientBookingDialog } from './ClientBookingDialog';
import { WorkspaceProvider } from './WorkspaceProvider';
import { demoUsers } from '../data/roles';
import { NewMemberDialog } from './NewMemberDialog';
import { ScheduleAttendees } from './ScheduleAttendees';
import { useWorkspace } from './WorkspaceProvider';

import { CompanyTopUpDialog } from './CompanyTopUpDialog';
import { ReceptionPayment, initialReceptionPayment } from './ReceptionPayment';
import { CallDialog } from './CallDialog';
import { RestoreCardDialog } from './RestoreCardDialog';
import { MembershipDetails } from './MembershipDetails';
import { ScheduleDayBoard } from './ScheduleDayBoard';
import { ShiftTimeline } from './ShiftTimeline';
import { PinEntry } from './PinEntry';
import { Field } from './Field';
import { ClientLink, PhoneAction, RowActions } from './RecordActions';
import { NavigationCard } from './WorkspaceUI';
import { ReportFilterBar } from './ReportFilterBar';
import { CallJournal } from './CallJournal';
import { ReviewJournal } from './ReviewJournal';
import { ReportTreeTable } from './ReportTreeTable';
import type { ReportTreeSort } from '../lib/report-tree';

function ReportTreeExample() {
  const [sort, setSort] = useState<ReportTreeSort>({ key: 'views', asc: false });
  const [opened, setOpened] = useState('');
  return (
    <section className="panel ws-panel-body ws-stack">
      <h3>Вложенные строки отчёта</h3>
      <p className="ws-muted">
        Раскрытие, сортировка внутри уровня и закреплённое название при прокрутке. В родительской
        строке три уникальных посетителя; один человек мог видеть оба предложения.
      </p>
      <ReportTreeTable
        label="Пример вложенного отчёта"
        nodes={[
          {
            id: 'memberships',
            name: 'Абонементы',
            values: { views: 12, visitors: 3 },
            children: [
              { id: 'iron', name: 'Железная карта', values: { views: 8, visitors: 2 } },
              { id: 'light', name: 'Лайт', values: { views: 4, visitors: 2 } },
            ],
          },
        ]}
        columns={[
          { key: 'views', label: 'Просмотры' },
          { key: 'visitors', label: 'Посетители' },
        ]}
        sort={sort}
        onSort={setSort}
        onOpen={(node) => setOpened(node.name)}
      />
      {opened && <p role="status">Выбрано: {opened}</p>}
    </section>
  );
}

function MembershipCatalogExample() {
  const [query, setQuery] = useState('');
  const [data] = useState(createWorkspaceData);
  return (
    <div className="panel ws-panel-body ws-stack">
      <h3>Группы и подгруппы абонементов</h3>
      <SearchBox
        value={query}
        onChange={setQuery}
        label="Поиск в примере абонементов"
        placeholder="Название, группа или подгруппа"
      />
      <MembershipCatalog
        section="memberships"
        plans={data.plans.filter(
          (plan) =>
            planSaleSection(plan) === 'memberships' &&
            matchesCatalogPlan(plan, 'memberships', query),
        )}
        searching={!!query.trim()}
        showEmpty
        renderPlans={(plans) => (
          <div className="membership-catalog-grid">
            {plans.map((plan) => (
              <MembershipCard
                compact
                key={plan.id}
                name={plan.name}
                kindId={plan.kindId}
                detail={plan.short}
              />
            ))}
          </div>
        )}
      />
    </div>
  );
}

function AdminAccountExample() {
  const [open, setOpen] = useState(false);
  return (
    <section className="panel ws-panel-body ws-stack">
      <h3>Вход в личный кабинет администратора</h3>
      <p className="muted">
        Четыре цифры, подтверждение клавишей Enter и понятная ошибка. Демонстрационный код: 1234.
      </p>
      {open ? (
        <>
          <Notice tone="success">
            Кабинет открыт. Начисления доступны только своему сотруднику.
          </Notice>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Закрыть кабинет
          </Button>
        </>
      ) : (
        <PinEntry onUnlock={() => setOpen(true)} />
      )}
    </section>
  );
}

function ReceptionExample() {
  const { data } = useWorkspace();
  const [payment, setPayment] = useState(initialReceptionPayment);
  const [companyResult, setCompanyResult] = useState('');
  const [quantityExample, setQuantityExample] = useState(1);
  const [member, setMember] = useState(initialMembers[0]);
  const [dialog, setDialog] = useState('');
  const pass = getClientProfile(member, data).subscriptions[0];
  return (
    <section className="panel ws-panel-body ws-stack">
      <h3>Операции ресепшена — рабочие примеры</h3>
      <div className="reception-product-grid">
        <ProductCard
          product={{ ...data['retail-products'][0], stock: '5' }}
          quantity={quantityExample}
          onAdd={() => setQuantityExample((value) => Math.min(5, value + 1))}
        />
      </div>
      <QuantityStepper
        label="Количество — пример"
        value={quantityExample}
        max={5}
        onChange={setQuantityExample}
      />
      <ReceptionPayment
        members={initialMembers}
        value={payment}
        onChange={setPayment}
        total={100}
      />
      <div className="ws-actions">
        <Button variant="secondary" onClick={() => setDialog('call')}>
          Позвонить клиенту
        </Button>
        <Button variant="secondary" onClick={() => setDialog('restore')}>
          Восстановить карту
        </Button>
        <Button variant="secondary" onClick={() => setDialog('pass')}>
          История абонемента
        </Button>
      </div>
      <Button variant="secondary" onClick={() => setDialog('company')}>
        Пополнить счёт компании — пример
      </Button>
      {companyResult && <Notice tone="success">{companyResult}</Notice>}
      {dialog === 'company' && (
        <CompanyTopUpDialog
          company={data.companies[0]}
          clubId="central"
          user={demoUsers.find((user) => user.role === 'administrator')!}
          onClose={() => setDialog('')}
          onSuccess={(message) => {
            setDialog('');
            setCompanyResult(message);
          }}
        />
      )}
      <h3>Две смены одновременно и передача места</h3>
      <p className="muted">
        Две дорожки — два компьютера ресепшена. Последовательные смены на одной дорожке показывают
        передачу места. Цвет обозначает администратора; имя и время всегда подписаны.
      </p>
      <ShiftTimeline
        rows={data.shifts.filter((row) => row.start.startsWith('2026-11-06'))}
        employees={data.employees}
        allShifts={data.shifts}
        from="2026-11-06"
        to="2026-11-06"
      />
      <div className="calendar-scroll" style={{ maxHeight: 280 }}>
        <ScheduleDayBoard
          events={data.events
            .filter((event) => event.day === '2026-11-06' && event.club === 'Центральный')
            .slice(0, 3)}
          rooms={[{ key: 'demo-room', label: 'Большой зал', room: 'Большой зал' }]}
          onOpen={(event) => setDialog(`schedule:${event.id}`)}
        />
      </div>
      {dialog.startsWith('schedule:') && (
        <Modal
          title={data.events.find((event) => event.id === dialog.slice(9))?.name || 'Занятие'}
          onClose={() => setDialog('')}
        >
          <p>Выбрано занятие. В прототипе здесь открывается список участников.</p>
        </Modal>
      )}
      {dialog === 'call' && (
        <CallDialog
          name={member.fullName || member.name}
          phone={member.phone}
          hidden
          onClose={() => setDialog('')}
        />
      )}
      {dialog === 'restore' && (
        <RestoreCardDialog
          member={member}
          members={initialMembers}
          user={demoUsers.find((user) => user.role === 'administrator')!}
          clubName="Астрон · Центральный"
          onUpdate={setMember}
          onClose={() => setDialog('')}
        />
      )}
      {dialog === 'pass' && (
        <MembershipDetails
          pass={pass}
          member={member}
          members={initialMembers}
          visits={[]}
          canOperate
          user={demoUsers.find((user) => user.role === 'administrator')!}
          clubName="Астрон · Центральный"
          onClose={() => setDialog('')}
        />
      )}
    </section>
  );
}

function AttendanceExample() {
  const { data } = useWorkspace();
  const [result, setResult] = useState('');
  const event = data.events.find(
    (row) => row.day === '2026-11-06' && row.time === '15:10' && row.kind !== 'personal',
  );
  return event ? (
    <>
      <ScheduleAttendees
        event={event}
        members={initialMembers}
        editable
        onRegister={(_member, _kind, name) => setResult(`Посещение списано: ${name}.`)}
        onSell={() => setResult('В прототипе откроется продажа подходящего абонемента.')}
      />
      {result && <Notice>{result}</Notice>}
    </>
  ) : null;
}

export function DesignRules() {
  const [reportMonthExample, setReportMonthExample] = useState('2026-11');
  const [reportWeekExample, setReportWeekExample] = useState('2026-11-06');
  const [bookingExample, setBookingExample] = useState(false);
  const [examplePassId, setExamplePassId] = useState('');
  const examplePasses = availableVisitPasses(
    getClientProfile(initialMembers[0]).subscriptions,
    '2026-11-06T14:38',
    '1998-04-12',
  );
  const [tab, setTab] = useState('Абонементы');
  const [mode, setMode] = useState('День');
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState('');
  const [exampleQuery, setExampleQuery] = useState('');
  const [attendance, setAttendance] = useState(false);
  const [exampleBookings, setExampleBookings] = useState<number[]>([]);
  const [copyExample, setCopyExample] = useState(false);
  const [exampleSchedule] = useState(createWorkspaceData);
  const [newClientExample, setNewClientExample] = useState(false);
  const [photoExample, setPhotoExample] = useState(false);
  const [fieldExample, setFieldExample] = useState('');
  const [exampleCall, setExampleCall] = useState(false);
  const [zeroCategory, setZeroCategory] = useState(false);
  const [filterExample, setFilterExample] = useState('all');
  return (
    <section className="ds-section ui-rules" aria-label="Единые правила интерфейса">
      <SectionTitle
        title="Одна задача — один элемент"
        subtitle="Эти правила действуют для всех страниц, ролей и тем. Ниже — рабочие компоненты, а не отдельные рисунки."
      />
      <Notice>
        Перед созданием нового элемента сначала выбирается существующий вариант. Если подходящего
        нет, его правила и пример добавляются сюда до повторного использования.
      </Notice>
      <div className="panel ws-panel-body ws-stack">
        <h3>Запись клиента</h3>
        <p>
          Одинаковое окно в карточке и регистрации. Групповые занятия, резерв или персональная
          запись к закреплённому тренеру.
        </p>
        <ClientActionButton action="book" onClick={() => setBookingExample(true)} />
      </div>
      {bookingExample && (
        <WorkspaceProvider>
          <ClientBookingDialog
            member={initialMembers[0]}
            user={demoUsers.find((user) => user.role === 'administrator')!}
            clubName="Центральный"
            onClose={() => setBookingExample(false)}
            onBooked={(event, reserved) =>
              setResult(
                `Пример: ${reserved ? 'резерв' : 'запись'} на ${event.name} в ${event.time}.`,
              )
            }
          />
        </WorkspaceProvider>
      )}
      <div className="panel ws-panel-body ws-stack">
        <h3>Посещение из списка занятия</h3>
        <p>
          «Отметить» списывает одно посещение подходящего абонемента. При нескольких картах
          требуется выбор. Повторное нажатие не списывает ещё раз.
        </p>
        <WorkspaceProvider>
          <AttendanceExample />
        </WorkspaceProvider>
      </div>
      <div className="panel ws-panel-body ws-stack">
        <h3>Абонемент для посещения</h3>
        <p>Только доступные карты. Выбор строки не списывает посещение.</p>
        <VisitPassList passes={examplePasses} value={examplePassId} onChange={setExamplePassId} />
      </div>
      <div className="panel ws-panel-body ws-stack">
        <h3>Действия и состояния</h3>
        <div className="ws-actions" role="group" aria-label="Действия с клиентом — пример">
          <ClientActionButton action="book" onClick={() => setBookingExample(true)} />
          <ClientActionButton
            action="visit"
            onClick={() => setResult('Открыт пример регистрации посещения. Посещение не списано.')}
          />
          <ClientActionButton
            action="sell"
            onClick={() => setResult('Открыт пример продажи клиенту. Оплата не выполнена.')}
          />
          <ClientActionButton
            action="profile"
            onClick={() => setResult('Открыт пример карточки клиента.')}
          />
        </div>
        <div className="ws-actions">
          <Button>
            <Plus size={18} />
            Добавить
          </Button>
          <Button variant="secondary">Редактировать</Button>
          <Button variant="ghost">Отмена</Button>
          <Button variant="accent">Продать</Button>
          <Button
            variant="success"
            aria-pressed={attendance}
            disabled={attendance}
            onClick={() => setAttendance(true)}
          >
            <Check size={18} />
            {attendance ? 'Присутствует' : 'Отметить'}
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            <Trash2 size={18} />
            Удалить пример
          </Button>
          <Button disabled>Недоступно</Button>
          <IconButton label="Редактировать пример">
            <Edit3 size={18} />
          </IconButton>
          <DisclosureMenu
            label="Дополнительные действия примера"
            icon={<MoreHorizontal size={18} />}
          >
            <div>
              <button type="button" onClick={() => setResult('Дополнительное действие выбрано.')}>
                Открыть сведения
              </button>
            </div>
          </DisclosureMenu>
        </div>
        <div className="ws-actions" aria-label="Образцы статусов">
          <CountBadge>6</CountBadge>
          {[
            'Действует',
            'Ожидает оплаты',
            'Отменено',
            'В работе',
            'Заморожен',
            'Не активен',
            'Завершён',
          ].map((value) => (
            <StatusBadge key={value}>{value}</StatusBadge>
          ))}
        </div>
        {result && <Notice tone="success">{result}</Notice>}
        <h3>Разделы и режимы</h3>
        <Tabs
          items={['Абонементы', 'Посещения', 'Финансы']}
          value={tab}
          onChange={setTab}
          label="Пример вкладок"
        />
        <Tabs
          variant="segmented"
          items={['День', 'Неделя', 'Список']}
          value={mode}
          onChange={setMode}
          label="Пример режимов"
        />
      </div>
      <div className="panel ws-panel-body ws-stack">
        <h3>Показатели</h3>
        <Stats
          items={[
            { label: 'Клиенты сегодня', value: 42 },
            { label: 'Записи', value: 18 },
            { label: 'Продажи', value: '26 400 ₽' },
          ]}
        />
      </div>
      <div className="panel ws-panel-body ws-stack">
        <h3>Фоновые графики руководителей</h3>
        <p>
          Линия показывает значения по дням, большая цифра — последнюю точку. Выручка накапливается
          с начала месяца. Период и демонстрационный характер данных подписаны; у показателя без
          истории графика нет. Количество клубов сопровождает схема шести связанных площадок.
        </p>
        <Stats
          items={[
            managementNetworkMetric,
            managementMetrics.networkRevenue,
            managementMetrics.activeClients,
            managementMetrics.renewals,
          ].map((metric) => ({ ...metric, note: metric.detail }))}
        />
      </div>
      <div className="panel ws-panel-body ws-stack">
        <h3>Финансовый журнал клиента</h3>
        <WorkspaceProvider>
          <ClientFinanceJournal member={initialMembers[0]} members={initialMembers} />
        </WorkspaceProvider>
      </div>
      <div className="panel ws-panel-body ws-stack">
        <h3>Смена ресепшена</h3>
        <ReceptionShift
          shift={{ start: '2026-11-06T08:00', end: '2026-11-06T20:00' }}
          onOpen={() => setResult('В приложении откроется рабочий день сотрудника.')}
        />
      </div>
      <div className="panel ws-panel-body ws-stack">
        <h3>Проверка клиента перед созданием</h3>
        <p>
          Пример: Смирнова Анна, дата рождения 12.04.1998 или телефон +7 999 123-45-67. Одно
          совпадение ФИО не вызывает предупреждение.
        </p>
        <Button variant="secondary" onClick={() => setNewClientExample(true)}>
          Новый клиент — пример
        </Button>
        <Button variant="secondary" onClick={() => setPhotoExample(true)}>
          Фото клиента — пример
        </Button>
      </div>
      {photoExample && (
        <ClientPhotoDialog
          member={initialMembers[0]}
          onClose={() => setPhotoExample(false)}
          onSave={() => {
            setPhotoExample(false);
            setResult('Пример: новый портрет выбран. Данные приложения не изменены.');
          }}
        />
      )}
      {newClientExample && (
        <NewMemberDialog
          members={initialMembers}
          hidePhones
          onClose={() => setNewClientExample(false)}
          onOpen={(member) => {
            setNewClientExample(false);
            setResult(`В приложении откроется карточка: ${member.fullName || member.name}.`);
          }}
          onCreate={(draft) => {
            setNewClientExample(false);
            setResult(
              `Пример: отдельная карточка ${draft.fullName}. Данные приложения не изменены.`,
            );
          }}
          onUpdate={(member) => {
            setNewClientExample(false);
            setResult(
              `Пример обновления: ${member.fullName || member.name}. Абонементы и история сохраняются.`,
            );
          }}
        />
      )}
      <div className="panel ws-panel-body ws-stack">
        <h3>Копирование недели расписания</h3>
        <p>
          Предыдущая или выбранная неделя переносится в открытую неделю календаря. Сначала
          показываются занятия и причины пропуска; записи клиентов не копируются.
        </p>
        <Button variant="secondary" onClick={() => setCopyExample(true)}>
          Копировать неделю — пример
        </Button>
      </div>
      {copyExample && (
        <ScheduleCopyDialog
          events={exampleSchedule.events}
          rooms={exampleSchedule.rooms}
          club="Центральный"
          targetDay="2026-11-09"
          onClose={() => setCopyExample(false)}
          onCopy={(source) => {
            const plan = planWeekCopy(
              exampleSchedule.events,
              exampleSchedule.rooms,
              'Центральный',
              source,
              '2026-11-09',
            );
            setResult(
              `Пример: будет добавлено ${plan.items.filter((item) => !item.reason).length} занятий без записей клиентов.`,
            );
            setCopyExample(false);
          }}
        />
      )}
      <div className="panel ws-panel-body ws-stack ui-search-examples">
        <h3>Одинаковый поиск</h3>
        <p className="ui-rule-purpose">
          Единое оформление; поиск клиента дополнен подсказками и клавишей Enter. Для примера можно
          ввести 100001.
        </p>
        <div className="ws-fields">
          <SearchBox
            value={exampleQuery}
            onChange={setExampleQuery}
            placeholder="Поиск по записям"
            label="Пример поиска по записям"
          />
          <ClientSearch
            members={initialMembers}
            hidePhones
            onMember={(member) => setResult(`Выбран клиент: ${member.fullName || member.name}`)}
          />
        </div>
        <h3>Запись прямо из поиска</h3>
        <ClientSearch
          members={initialMembers}
          mode="selection"
          purpose="занятия"
          hidePhones
          resultAction={(member) => ({
            label: exampleBookings.includes(member.id) ? 'Уже записан' : 'Записать клиента',
            disabled: exampleBookings.includes(member.id),
          })}
          onMember={(member) => {
            setExampleBookings((ids) => [...ids, member.id]);
            setResult(`Пример записи: ${member.fullName || member.name}. Посещение не списано.`);
          }}
        />
      </div>
      <AdminAccountExample />
      <MembershipCatalogExample />
      <div className="panel ws-panel">
        <div className="ws-panel-heading">
          <h3>Переходы каталога</h3>
        </div>
        <div className="ws-panel-body ws-stack">
          <p className="ui-rule-purpose">
            При наведении меняется цвет рамки. Клавиша Tab показывает внутренний контур, который не
            обрезается по краям блока.
          </p>
          <WorkspaceProvider>
            <ReceptionExample />
          </WorkspaceProvider>
          <CatalogSectionGrid>
            <CatalogSectionCard
              id="memberships"
              count={7}
              onClick={() => setResult('Выбран раздел абонементов.')}
            />
            <CatalogSectionCard
              id="personal"
              count={1}
              onClick={() => setResult('Выбран персональный тренинг.')}
            />
          </CatalogSectionGrid>
        </div>
      </div>
      <div className="ws-stack">
        <h3>Каталог отчётов — рабочий пример</h3>
        <div className="panel ws-panel-body">
          <ReportBars
            unit="Посещений"
            rows={[
              { name: 'Центральный', value: 12, label: '12' },
              { name: 'Парк', value: 5, label: '5' },
              { name: 'Речной', value: 0, label: '0' },
            ]}
          />
        </div>
        <ReportCatalogue
          reports={statisticsReports.filter((r) =>
            ['unique_visits', 'gtrener_rating', 'clients_ltv'].includes(r.id),
          )}
          onOpen={(id) =>
            setResult(
              `Выбран отчёт: ${reportTitle(statisticsReports.find((r) => r.id === id)!)}. Данные приложения не изменены.`,
            )
          }
        />
        <h3>Период отчёта и уникальные клиенты</h3>
        <ReportMonthPicker month={reportMonthExample} onChange={setReportMonthExample} />
        <p className="ws-muted">
          Выбран месяц: {reportMonthExample}. Стрелки переключают месяц, включая переход между
          годами.
        </p>
        <h3>Общие поля и действия строк</h3>
        <SegmentedFilter
          label="Пример фильтра"
          layout="grid"
          value={filterExample}
          onChange={setFilterExample}
          items={[
            { id: 'all', label: 'Все', count: 8 },
            { id: 'active', label: 'Активные', count: 6 },
            { id: 'paused', label: 'Заморожены', count: 2 },
          ]}
        />
        <Field
          label="Пример обязательного поля"
          required
          hint="Подсказка связана с полем"
          error={
            fieldExample && fieldExample.length < 3 ? 'Введите хотя бы три символа' : undefined
          }
        >
          <input required value={fieldExample} onChange={(e) => setFieldExample(e.target.value)} />
        </Field>
        <div className="ws-actions">
          <ClientLink onClick={() => setResult('Открыта демонстрационная карточка клиента')}>
            Анна Смирнова
          </ClientLink>
          <PhoneAction
            name="Анна Смирнова"
            phone="+7 999 123-45-67"
            onClick={() => setExampleCall(true)}
          />
          <RowActions
            label="Пример действий строки"
            actions={[
              { label: 'Покупатели', onClick: () => setResult('Открыт список покупателей') },
              { label: 'Операции', onClick: () => setResult('Открыты операции') },
            ]}
          />
        </div>
        {exampleCall && (
          <CallDialog
            name="Анна Смирнова"
            phone="+7 999 123-45-67"
            hidden={false}
            onClose={() => setExampleCall(false)}
          />
        )}
        <NavigationCard
          title="Общая карточка перехода"
          caption="Одинаковый переход в разделах, отчётах и главной странице"
          onClick={() => setResult('Карточка перехода выбрана')}
        />
        <ReportFilterBar>
          <Field data-filter="to" label="Дата отчёта">
            <input
              type="date"
              value={reportWeekExample}
              onChange={(e) => setReportWeekExample(e.target.value)}
            />
          </Field>
          <Field data-filter="operator" label="Дополнительный фильтр">
            <input value={fieldExample} onChange={(e) => setFieldExample(e.target.value)} />
          </Field>
        </ReportFilterBar>
        <ReportTreeExample />
        <Button
          variant="secondary"
          aria-pressed={zeroCategory}
          onClick={() => setZeroCategory(!zeroCategory)}
        >
          Переключить нулевую категорию
        </Button>
        <p className="ws-muted">
          Диаграммы используют ширину своего блока: круг до 380 px, временной график высотой 380/320
          px, подписи 16 px и полосы 24 px. На телефоне обе половины возрастной диаграммы остаются
          видимыми. Малые значения сохраняют свою пропорцию.
        </p>
        <ReportChart
          chart={{
            id: 'guide-stable-colors',
            title: 'Устойчивые цвета результатов',
            unit: 'Клиентов',
            kind: 'donut',
            series: [{ key: 'count', label: 'Клиентов' }],
            rows: [
              { id: 'Продлил', name: 'Продлили', values: [zeroCategory ? 0 : 2] },
              { id: 'Не продлил', name: 'Не продлили', values: [3] },
              { id: 'Окно ещё открыто', name: 'Окно открыто', values: [1] },
            ],
          }}
        />
        <ReportChart
          chart={{
            id: 'guide-cohorts',
            title: 'Когорты по годам',
            unit: 'Клиентов',
            kind: 'stacked',
            series: [
              { key: 'Продлил', label: 'Продлили' },
              { key: 'Не продлил', label: 'Не продлили' },
              { key: 'Окно ещё открыто', label: 'Окно открыто' },
            ],
            rows: [
              { id: '2025', name: '2025', values: [6, 4, 0], note: '6/10 завершённых окон' },
              { id: '2026', name: '2026', values: [4, 3, 3], note: '4/7 завершённых окон' },
            ],
          }}
        />
        <h3>Единые журналы</h3>
        <CallJournal
          rows={exampleSchedule.calls || []}
          members={initialMembers}
          hidePhones
          onMember={() => setResult('Выбран клиент из общего журнала')}
          onCall={() => setExampleCall(true)}
        />
        <ReviewJournal
          rows={exampleSchedule['client-reviews'] || []}
          members={initialMembers}
          onMember={() => setResult('Выбран клиент из отзывов')}
        />
        <h3>Накопительный результат тренера</h3>
        <ReportMonthPicker
          month={reportMonthExample}
          onChange={setReportMonthExample}
          label="Накопительно по месяц включительно"
        />
        <p className="ws-muted">
          Период: с 1 января {reportMonthExample.slice(0, 4)} года по конец выбранного месяца.
          Будущие суммы остаются неизвестными, доля оплаты — общая оплата / общие продажи ПТ.
        </p>
        <h3>Частота посещений по безлимиту — пример</h3>
        <ReportBars
          unit="Клиентов"
          rows={[
            { name: 'Менее 5', value: 3, label: '3' },
            { name: 'От 5 до 10, не включая 10', value: 4, label: '4' },
            { name: 'От 50 до 60, не включая 60', value: 1, label: '1' },
            { name: '60 и больше', value: 0, label: '0' },
          ]}
        />
        <p className="ws-muted">
          Восемь интервалов не пересекаются. Демо-частота: визиты / известные активные дни × 30.
          Точный метод источника не раскрыт; клиенты без срока или с неполной историей заморозок
          остаются отдельно от нулевых посещений.
        </p>
        <h3>Занятость тренеров за неделю</h3>
        <ReportWeekPicker day={reportWeekExample} onChange={setReportWeekExample} />
        <p className="ws-muted">
          Выбрана неделя с датой {reportWeekExample}. Стрелки меняют неделю целиком. В матрице семь
          дней с датами и строки времени начала, название, тренер и место каждого занятия; пустые
          дни сохраняются. На телефоне данные показаны карточками, без потери дней.
        </p>
        <ReportChart
          chart={{
            id: 'guide-unique',
            title: 'Сколько клубов посещает один клиент — пример',
            kind: 'donut',
            unit: 'Клиентов',
            series: [{ key: 'count', label: 'Клиентов' }],
            rows: [
              { id: 'one', name: '1 клуб', values: [60] },
              { id: 'two', name: '2 клуба', values: [30] },
              { id: 'three', name: '3 клуба', values: [10] },
            ],
            note: 'Каждый человек учитывается один раз. Число и доля доступны без наведения и цвета.',
          }}
        />
        <ReportChart
          chart={{
            id: 'guide-pyramid',
            title: 'Пол и возраст — пример',
            kind: 'pyramid',
            unit: 'Клиентов',
            series: [
              { key: 'male', label: 'Мужчины' },
              { key: 'female', label: 'Женщины' },
            ],
            rows: [
              { id: '24', name: '24 года', values: [12, 18] },
              { id: '25', name: '25 лет', values: [20, 16] },
            ],
            note: 'Сравниваются две группы одного возраста по общей шкале. Точные числа не зависят от цвета.',
          }}
        />
        <ReportChart
          chart={{
            id: 'guide-revenue',
            title: 'Выручка по месяцам — пример',
            unit: '₽',
            format: 'money',
            kind: 'columns',
            series: [{ key: 'amount', label: 'Выручка' }],
            rows: [
              { id: '2026-09', name: '2026-09', values: [600000] },
              { id: '2026-10', name: '2026-10', values: [900000] },
              { id: '2026-11', name: '2026-11', values: [300000] },
            ],
            reference: { value: 600000, label: 'Среднее за месяц' },
            note: 'Категории сравниваются полосами; ход времени — по календарю. Все суммы вымышлены.',
          }}
        />
      </div>
      <WorkspaceProvider>
        <ReceptionExample />
      </WorkspaceProvider>
      <div className="ui-rule-grid">
        {UI_RULES.map((rule) => (
          <article className="panel ws-panel-body" key={rule.id}>
            <h3>{rule.title}</h3>
            <p className="ui-rule-purpose">{rule.purpose}</p>
            <ul>
              {rule.rules.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      {confirm && (
        <ConfirmDialog
          title="Удалить пример?"
          subject="Демонстрационный элемент"
          description="Это пример общего подтверждения. Данные приложения не изменятся."
          confirmLabel="Удалить пример"
          cancelLabel="Оставить пример"
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            setResult('Пример подтверждения завершён. Данные приложения сохранены.');
          }}
        />
      )}
    </section>
  );
}
