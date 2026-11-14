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
  SectionTitle,
  StatusBadge,
} from './ui';
import { Notice, SearchBox, Stats, Tabs } from './WorkspaceUI';
import { ClientSearch } from './ClientSearch';
import { initialMembers } from '../data/mock';
import { UI_RULES } from '../design-system/registry';
import { ReceptionShift } from './ReceptionShift';
import { CatalogSectionCard } from './CatalogSectionCard';
import { ScheduleCopyDialog } from './ScheduleCopyDialog';
import { createWorkspaceData } from '../data/workspace';
import { planWeekCopy } from '../lib/schedule-copy';
import { ClientBookingDialog } from './ClientBookingDialog';
import { WorkspaceProvider } from './WorkspaceProvider';
import { demoUsers } from '../data/roles';
import { NewMemberDialog } from './NewMemberDialog';
import { ScheduleAttendees } from './ScheduleAttendees';
import { useWorkspace } from './WorkspaceProvider';

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
        <Button variant="secondary" onClick={() => setBookingExample(true)}>
          Записать — пример
        </Button>
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
      </div>
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
      <div className="panel ws-panel-body ws-stack">
        <h3>Переходы каталога</h3>
        <p className="ui-rule-purpose">
          При наведении меняется цвет рамки. Клавиша Tab показывает внутренний контур, который не
          обрезается по краям блока.
        </p>
        <div className="ui-rule-grid">
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
        </div>
      </div>
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
