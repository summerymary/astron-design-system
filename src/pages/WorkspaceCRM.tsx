import { Select } from '../components/Select';
import { useCallback, useState } from 'react';
import { ArrowRight, Check, Plus, Send } from 'lucide-react';
import { Button } from '../components/ui';
import { useWorkspace } from '../components/WorkspaceProvider';
import {
  Back,
  Empty,
  Notice,
  RecordForm,
  ResourcePage,
  SearchBox,
  SectionLinks,
  Stats,
  Status,
  Tabs,
} from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import type { AdminSectionId } from '../data/admin';
import type { DemoRecord, Field, Resource } from '../data/workspace';
import { prettyDate, TODAY } from '../data/workspace';
import { leadTask, leadTransitions } from '../lib/workspace-rules';
import {
  appendClientMessage,
  clientChatDraft,
  findClientChat,
  readChatMessages,
} from '../lib/client-messages';
import type { Member } from '../types';
import { AttentionFlags } from '../components/AttentionFlags';
import { CrmScenarios } from './CrmScenarios';
import { parseStages, stageAction, stageMeaning } from '../lib/crm';

export function CRMWorkspace({
  section,
  navigate,
}: {
  section: AdminSectionId;
  navigate: Navigate;
}) {
  const { data, put } = useWorkspace();
  const savedView = data['crm-view']?.find((row) => row.id === 'active');
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState(savedView?.stage || 'Все этапы');
  const [pipeline, setPipeline] = useState(savedView?.pipeline || 'Все воронки');
  const [completed, setCompleted] = useState(
    ['Покупка', 'Отказ'].includes(savedView?.stage || '') ? 'Завершены' : 'В работе',
  );
  const [selectedId, setSelectedId] = useState<string | null>(savedView?.leadId || null);
  const [form, setForm] = useState<DemoRecord | 'new' | null>(null);
  const [taskFilter, setTaskFilter] = useState('Сегодня');
  const [message, setMessage] = useState('');
  const closeForm = useCallback(() => setForm(null), []);
  const lead = data.leads.find((row) => row.id === selectedId);
  const openLeads = (name = 'Все воронки', status = 'Все этапы', leadId = '') => {
    put('crm-view', { id: 'active', pipeline: name, stage: status, leadId });
    navigate('leads');
  };
  const stages = [
    ...new Set(
      data.pipelines
        .filter((row) => pipeline === 'Все воронки' || row.name === pipeline)
        .flatMap((row) => parseStages(row.stages))
        .filter(Boolean),
    ),
  ];
  const fields: Field[] = [
    { key: 'name', label: 'Фамилия и имя', required: true },
    { key: 'phone', label: 'Телефон', type: 'tel', required: true },
    { key: 'club', label: 'Клуб', options: ['Центральный', 'Парк', 'Речной'] },
    {
      key: 'pipeline',
      label: 'Сценарий работы',
      options: data.pipelines.filter((row) => row.status !== 'В архиве').map((row) => row.name),
    },
    {
      key: 'source',
      label: 'Источник',
      options: ['Сайт', 'Рекомендация', 'Социальные сети', 'Звонок'],
    },
    { key: 'owner', label: 'Ответственный', options: data.employees.map((row) => row.name) },
    { key: 'task', label: 'Следующая задача' },
    { key: 'due', label: 'Срок задачи', type: 'date' },
    { key: 'note', label: 'Примечание', type: 'textarea' },
  ];
  const advance = (next: string) => {
    if (!lead) return;
    put('leads', {
      ...lead,
      stage: next,
      history: `${lead.history || ''}\n06.11 · Этап: ${next}`,
      task: leadTask(next, lead.task),
      done: '',
    });
    setMessage(`Этап изменён: ${next}.`);
    setStage('Все этапы');
    setCompleted(['Покупка', 'Отказ'].includes(next) ? 'Завершены' : 'В работе');
  };
  if (section === 'crm') {
    const tasks = data.leads.filter(
      (row) =>
        row.task &&
        (taskFilter === 'Готово'
          ? row.done === 'Да'
          : row.done !== 'Да' &&
            (taskFilter === 'Просрочено' ? row.due < TODAY : row.due === TODAY)),
    );
    return (
      <div className="ws-stack">
        <Stats
          items={[
            {
              label: 'Заявки в работе',
              value: data.leads.filter((row) => !['Покупка', 'Отказ'].includes(row.stage)).length,
            },
            {
              label: 'Задачи на сегодня',
              value: data.leads.filter((row) => row.due === TODAY && row.done !== 'Да').length,
            },
            {
              label: 'Просрочено',
              value: data.leads.filter((row) => row.due && row.due < TODAY && row.done !== 'Да')
                .length,
            },
          ]}
        />
        <div className="crm-home-links">
          <button onClick={() => openLeads()}>
            <strong>Заявки</strong>
            <span>
              Люди, которые интересуются клубом. Контакты, текущий статус и следующее действие.
            </span>
          </button>
          <button onClick={() => navigate('pipelines')}>
            <strong>Сценарии работы с заявками</strong>
            <span>
              Путь от первого обращения до покупки. Что означает каждый статус и что делать дальше.
            </span>
          </button>
          <button onClick={() => navigate('segments')}>
            <strong>Группы клиентов</strong>
            <span>
              Соберите нужную аудиторию, например людей, которым назначено пробное занятие.
            </span>
          </button>
          <button onClick={() => navigate('retention')}>
            <strong>Вернуть клиентов в клуб</strong>
            <span>Кому нужно позвонить, чтобы помочь вернуться к занятиям.</span>
          </button>
        </div>
        <section className="panel ws-panel">
          <div className="ws-panel-heading">
            <div>
              <h2>Задачи по заявкам</h2>
              <p>Что нужно сделать и с кем связаться. Завершение задачи не меняет статус заявки.</p>
            </div>
          </div>
          <Tabs
            items={['Сегодня', 'Просрочено', 'Готово']}
            value={taskFilter}
            onChange={setTaskFilter}
            label="Задачи CRM"
          />
          <div className="ws-panel-body">
            {tasks.length ? (
              tasks.map((row) => (
                <div className="ws-task" key={row.id}>
                  <button
                    className="ws-task-check"
                    aria-label={`${row.done === 'Да' ? 'Вернуть задачу' : 'Завершить задачу'}: ${row.name}`}
                    onClick={() => put('leads', { ...row, done: row.done === 'Да' ? '' : 'Да' })}
                  >
                    {row.done === 'Да' && <Check size={14} />}
                  </button>
                  <span>
                    <strong>{row.task}</strong>
                    <small>
                      {row.name} · {prettyDate(row.due)}
                    </small>
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => openLeads(row.pipeline, 'Все этапы', row.id)}
                  >
                    Открыть заявку
                    <ArrowRight size={14} />
                  </Button>
                </div>
              ))
            ) : (
              <Empty
                title="В этой категории задач нет"
                text="Задачи из заявок появятся здесь после назначения срока."
              />
            )}
          </div>
        </section>
      </div>
    );
  }
  if (section === 'pipelines')
    return <CrmScenarios onLeads={(name, status) => openLeads(name, status)} />;
  if (section === 'retention') {
    const config: Resource = {
      title: 'Клиенты на контроле',
      singular: 'Случай удержания',
      description:
        'Сохранённый демонстрационный срез. Риски автоматически не пересчитываются, сообщения не отправляются.',
      fields: [
        { key: 'name', label: 'Клиент', required: true },
        { key: 'risk', label: 'Риск', options: ['Средний', 'Высокий'] },
        { key: 'reason', label: 'Причина', type: 'textarea' },
        { key: 'owner', label: 'Ответственный', options: data.employees.map((row) => row.name) },
        { key: 'due', label: 'Срок', type: 'date' },
        { key: 'status', label: 'Статус', options: ['Новый', 'В работе', 'Завершён'] },
      ],
      columns: ['name', 'risk', 'reason', 'owner', 'due', 'status'],
      rows: [],
      links: ['crm'],
    };
    return <ResourcePage collection="retention" config={config} navigate={navigate} />;
  }
  if (section === 'segments') return <SegmentsWorkspace navigate={navigate} />;
  const shown = data.leads.filter(
    (row) =>
      `${row.name} ${row.phone}`.toLowerCase().includes(query.toLowerCase()) &&
      (stage === 'Все этапы' || row.stage === stage) &&
      (pipeline === 'Все воронки' || row.pipeline === pipeline) &&
      (completed === 'Завершены'
        ? ['Покупка', 'Отказ'].includes(row.stage)
        : !['Покупка', 'Отказ'].includes(row.stage)),
  );
  const transitions = lead
    ? leadTransitions(
        lead.stage,
        data.pipelines.find((row) => row.name === lead.pipeline)?.stages.split('\n') || [],
      )
    : [];
  return (
    <div className="ws-stack">
      <SectionLinks ids={['crm', 'segments', 'pipelines', 'retention']} navigate={navigate} />
      {message && <Notice tone="success">{message}</Notice>}
      <section className={`panel ws-panel ws-master-detail ${lead ? 'has-selection' : ''}`}>
        <div className="ws-panel-heading">
          <div>
            <h2>Заявки</h2>
            <p>У каждого обращения — ответственный и следующий шаг.</p>
          </div>
          <Button onClick={() => setForm('new')}>
            <Plus size={15} />
            Заявка
          </Button>
        </div>
        <Tabs
          items={['В работе', 'Завершены']}
          value={completed}
          onChange={(value) => {
            setCompleted(value);
            setSelectedId(null);
          }}
          label="Состояние заявок"
        />
        <div className="ws-toolbar">
          <SearchBox
            value={query}
            onChange={(value) => {
              setQuery(value);
              setSelectedId(null);
            }}
            placeholder="Имя или телефон"
          />
          <Select
            aria-label="Сценарий заявок"
            value={pipeline}
            onChange={(e) => {
              setPipeline(e.target.value);
              setStage('Все этапы');
              setSelectedId(null);
            }}
          >
            <option value="Все воронки">Все сценарии</option>
            {data.pipelines.map((row) => (
              <option key={row.id}>{row.name}</option>
            ))}
          </Select>
          <Select
            aria-label="Статус заявки"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setSelectedId(null);
            }}
          >
            <option value="Все этапы">Любой статус</option>
            {[...new Set([...stages, 'Отказ'])].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
          <Button
            variant="ghost"
            onClick={() => {
              setQuery('');
              setPipeline('Все воронки');
              setStage('Все этапы');
              setCompleted('В работе');
            }}
          >
            Сбросить фильтры
          </Button>
        </div>
        <div className="ws-split">
          <div className="ws-master-list">
            {shown.map((row) => (
              <button
                className={row.id === selectedId ? 'selected' : ''}
                key={row.id}
                onClick={() => setSelectedId(row.id)}
              >
                <strong>{row.name}</strong>
                <small>
                  {row.club} · {row.source}
                </small>
                <Status>{row.stage}</Status>
                <small>{row.task || 'Работа завершена'}</small>
              </button>
            ))}
            {!shown.length && <Empty />}
          </div>
          <div className="ws-detail">
            {lead ? (
              <>
                <Back onClick={() => setSelectedId(null)}>К списку заявок</Back>
                <div className="ws-subheading">
                  <h2>{lead.name}</h2>
                  <Button variant="secondary" onClick={() => setForm(lead)}>
                    Изменить
                  </Button>
                </div>
                <p>{lead.phone}</p>
                <Status>{lead.stage}</Status>
                <p className="crm-lead-explanation">{stageMeaning(lead.stage)}</p>
                <dl className="ws-facts">
                  <div>
                    <dt>Сценарий работы</dt>
                    <dd>{lead.pipeline}</dd>
                  </div>
                  <div>
                    <dt>Ответственный</dt>
                    <dd>{lead.owner}</dd>
                  </div>
                  <div>
                    <dt>Следующее действие</dt>
                    <dd>{lead.task || 'Не назначен'}</dd>
                  </div>
                  <div>
                    <dt>Срок</dt>
                    <dd>{prettyDate(lead.due)}</dd>
                  </div>
                </dl>
                <div className="ws-actions">
                  {transitions.map((next) => (
                    <Button key={next} onClick={() => advance(next)}>
                      {stageAction(next)}
                      <ArrowRight size={14} />
                    </Button>
                  ))}
                  {!['Покупка', 'Отказ'].includes(lead.stage) && (
                    <Button variant="ghost" onClick={() => advance('Отказ')}>
                      Закрыть как отказ
                    </Button>
                  )}
                </div>
                <details className="ws-disclosure">
                  <summary>О заявке</summary>
                  <p>{lead.note || 'Примечаний нет.'}</p>
                  <p>
                    {lead.club} · {lead.source}
                  </p>
                </details>
                <div className="ws-timeline">
                  <h3>История</h3>
                  {lead.history
                    ?.split('\n')
                    .filter(Boolean)
                    .map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                </div>
                <small className="ws-muted">
                  Смена этапов — демонстрация процесса. Правила переходов будут уточнены с командой
                  клуба.
                </small>
              </>
            ) : (
              <Empty
                title="Выберите заявку"
                text="Здесь появятся контакт, задача и история работы."
              />
            )}
          </div>
        </div>
      </section>
      {form && (
        <RecordForm
          title={form === 'new' ? 'Новая заявка' : 'Изменить заявку'}
          fields={fields}
          initial={form === 'new' ? undefined : form}
          onClose={closeForm}
          onSave={(record) => {
            const availableStages = parseStages(
              data.pipelines.find((row) => row.name === record.pipeline)?.stages || 'Новая',
            );
            const first = availableStages[0];
            put('leads', {
              ...record,
              stage:
                availableStages.includes(record.stage) || record.stage === 'Отказ'
                  ? record.stage
                  : first,
              history: record.history || '06.11 · Заявка добавлена в прототип',
            });
            closeForm();
            setMessage('Заявка сохранена.');
          }}
        />
      )}
    </div>
  );
}

function SegmentsWorkspace({ navigate }: { navigate: Navigate }) {
  const { data, put } = useWorkspace();
  const [query, setQuery] = useState('');
  const [segmentId, setSegmentId] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [newSegment, setNewSegment] = useState(false);
  const [message, setMessage] = useState('');
  const close = useCallback(() => setNewSegment(false), []);
  const segment = data.segments.find((row) => row.id === segmentId);
  const rows = data.leads.filter(
    (row) =>
      `${row.name} ${row.phone}`.toLowerCase().includes(query.toLowerCase()) &&
      (!segment ||
        (segment.members
          ? segment.members.split(',').includes(row.id)
          : row.stage === segment.stage &&
            (segment.club === 'Все клубы' || row.club === segment.club))),
  );
  return (
    <div className="ws-stack">
      <SectionLinks ids={['crm', 'leads']} navigate={navigate} />
      {message && <Notice tone="success">{message}</Notice>}
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>Работа с базой</h2>
            <p>Сохраните выбранные заявки в отдельный сегмент.</p>
          </div>
          <Button onClick={() => setNewSegment(true)} disabled={!selected.length}>
            <Plus size={15} />
            Сегмент из выбранных
          </Button>
        </div>
        <div className="ws-toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Имя или телефон" />
          <Select
            aria-label="Сохранённый сегмент"
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
          >
            <option value="all">Все заявки</option>
            {data.segments.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
          <span>{selected.length} выбрано</span>
        </div>
        <div className="ws-panel-body">
          <label className="ws-checkbox">
            <input
              type="checkbox"
              checked={!!rows.length && rows.every((row) => selected.includes(row.id))}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...new Set([...selected, ...rows.map((row) => row.id)])]
                    : selected.filter((id) => !rows.some((row) => row.id === id)),
                )
              }
            />
            Выбрать все показанные
          </label>
          {rows.map((row) => (
            <label className="ws-segment-row" key={row.id}>
              <input
                type="checkbox"
                checked={selected.includes(row.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, row.id]
                      : selected.filter((id) => id !== row.id),
                  )
                }
              />
              <strong>{row.name}</strong>
              <span>{row.club}</span>
              <Status>{row.stage}</Status>
            </label>
          ))}
        </div>
      </section>
      {newSegment && (
        <RecordForm
          title="Новый сегмент"
          fields={[
            { key: 'name', label: 'Название сегмента', required: true },
            { key: 'description', label: 'Описание', type: 'textarea' },
          ]}
          onClose={close}
          onSave={(record) => {
            put('segments', { ...record, members: selected.join(',') });
            close();
            setMessage(`Сегмент сохранён. Заявок: ${selected.length}.`);
            setSelected([]);
          }}
        />
      )}
    </div>
  );
}

export function MessagesWorkspace({
  external,
  navigate,
  initialMember,
  members,
}: {
  external: boolean;
  navigate: Navigate;
  initialMember: Member | null;
  members: Member[];
}) {
  const { data, put } = useWorkspace();
  const displayChats = data.chats.map((row) => {
    const member = members.find((item) => String(item.id) === row.memberId);
    return member ? { ...row, name: member.name } : row;
  });
  const existingClientChat = initialMember
    ? findClientChat(displayChats, initialMember.id)
    : undefined;
  const draft =
    initialMember && !external && !existingClientChat ? clientChatDraft(initialMember) : null;
  const [selectedId, setSelectedId] = useState<string | null>(
    () => existingClientChat?.id || draft?.id || null,
  );
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('Все каналы');
  const [attention, setAttention] = useState('Все');
  const [text, setText] = useState('');
  const [messageError, setMessageError] = useState('');
  const chat =
    displayChats.find((row) => row.id === selectedId) || (draft?.id === selectedId ? draft : null);
  const rows = [...(draft ? [draft] : []), ...displayChats].filter(
    (row) =>
      (external ? row.channel !== 'Поддержка' : row.channel === 'Поддержка') &&
      (attention === 'Все' ||
        (attention === 'Важные' ? row.important === 'true' : row.unread === 'true')) &&
      row.name.toLowerCase().includes(query.toLowerCase()) &&
      (channel === 'Все каналы' || row.channel === channel),
  );
  return (
    <div className="ws-stack">
      <SectionLinks
        ids={external ? ['messages'] : ['external-messages', 'notifications']}
        navigate={navigate}
      />
      <section className={`panel ws-panel ws-master-detail ${chat ? 'has-selection' : ''}`}>
        <div className="ws-panel-heading">
          <div>
            <h2>{external ? 'Внешние обращения' : 'Сообщения клиентам'}</h2>
            <p>Переписка хранится в памяти прототипа. Реальной отправки нет.</p>
          </div>
        </div>
        <div className="ws-toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Имя клиента" />
          {external && (
            <Select
              aria-label="Канал обращений"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              {['Все каналы', 'Telegram', 'ВКонтакте', 'WhatsApp'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          )}
        </div>
        <div className="ws-split">
          <div className="ws-master-list">
            <Tabs
              items={['Все', 'Важные', 'Не просмотрены']}
              value={attention}
              onChange={setAttention}
              label="Отметки чатов"
            />
            {rows.map((row) => (
              <button
                key={row.id}
                className={row.id === selectedId ? 'selected' : ''}
                onClick={() => {
                  setSelectedId(row.id);
                  setText('');
                  setMessageError('');
                }}
              >
                <strong>
                  {row.name}
                  <time>{row.time}</time>
                </strong>
                <small>{row.channel}</small>
                <small className="attention-labels">
                  {row.important === 'true' && '★ Важное '}
                  {row.unread === 'true' && '● Не просмотрено'}
                </small>
                <p>{row.preview}</p>
                <Status>{row.status}</Status>
              </button>
            ))}
            {!rows.length && <Empty />}
          </div>
          <div className="ws-detail ws-chat">
            {chat ? (
              <>
                <Back onClick={() => setSelectedId(null)}>К обращениям</Back>
                <div className="ws-subheading">
                  <div>
                    <h2>{chat.name}</h2>
                    <p>{chat.channel}</p>
                  </div>
                  {data.chats.some((row) => row.id === chat.id) && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        put('chats', {
                          ...chat,
                          status: chat.status === 'Решено' ? 'В работе' : 'Решено',
                        })
                      }
                    >
                      {chat.status === 'Решено' ? 'Вернуть в работу' : 'Вопрос решён'}
                    </Button>
                  )}
                </div>
                <AttentionFlags record={chat} onChange={(row) => put('chats', row)} />
                <div
                  className={`ws-chat-history${readChatMessages(chat).length ? '' : ' is-empty'}`}
                  role="log"
                  aria-label={`Переписка: ${chat.name}`}
                >
                  {readChatMessages(chat).map((entry, index) => (
                    <p className={entry.sender === 'club' ? 'from-club' : ''} key={index}>
                      <span className="sr-only">
                        {entry.sender === 'club' ? 'Клуб: ' : 'Клиент: '}
                      </span>
                      {entry.text}
                    </p>
                  ))}
                </div>
                {!readChatMessages(chat).length && (
                  <p className="ws-muted">Переписка ещё не начата. Напишите первое сообщение.</p>
                )}
                <form
                  className="ws-chat-compose"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const body = String(new FormData(event.currentTarget).get('message') || '');
                    try {
                      put('chats', appendClientMessage(chat, body));
                      setText('');
                      setMessageError('');
                    } catch (error) {
                      setMessageError(
                        error instanceof Error ? error.message : 'Проверьте сообщение.',
                      );
                    }
                  }}
                >
                  <label className="form-field">
                    <span>Сообщение клиенту</span>
                    <textarea
                      name="message"
                      rows={3}
                      value={text}
                      maxLength={2000}
                      required
                      onInput={(e) => setText(e.currentTarget.value)}
                      onChange={(e) => {
                        setText(e.target.value);
                        setMessageError('');
                      }}
                      placeholder="Напишите сообщение"
                    />
                  </label>
                  <Button type="submit" disabled={!text.trim()}>
                    <Send size={15} />
                    Отправить демосообщение
                  </Button>
                </form>
                {messageError && <Notice tone="warning">{messageError}</Notice>}
              </>
            ) : (
              <Empty title="Выберите обращение" text="Диалог откроется здесь." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function NotificationsWorkspace({ navigate }: { navigate: Navigate }) {
  const { data, put } = useWorkspace();
  const [filter, setFilter] = useState('Все');
  const rows = data.notifications.filter(
    (row) =>
      filter === 'Все' || (filter === 'Важные' ? row.important === 'true' : row.status === 'Новое'),
  );
  return (
    <section className="panel ws-panel">
      <div className="ws-panel-heading">
        <div>
          <h2>Лента уведомлений</h2>
          <p>Просмотр списка сам по себе не меняет статус.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() =>
            data.notifications.forEach((row) =>
              put('notifications', { ...row, status: 'Просмотрено', unread: 'false' }),
            )
          }
        >
          Отметить все просмотренными
        </Button>
      </div>
      <Tabs
        items={['Все', 'Новые', 'Важные']}
        value={filter}
        onChange={setFilter}
        label="Фильтр уведомлений"
      />
      <div className="ws-panel-body">
        {rows.map((row) => (
          <article className="ws-notification" key={row.id}>
            <span className={`ws-notice-dot ${row.status === 'Новое' ? 'unread' : ''}`} />
            <div>
              <h3>{row.name}</h3>
              <p>{row.text}</p>
              <small>
                {row.type} · {row.time}
              </small>
              <AttentionFlags
                record={{ ...row, unread: String(row.status === 'Новое') }}
                onChange={(next) =>
                  put('notifications', {
                    ...next,
                    status: next.unread === 'true' ? 'Новое' : 'Просмотрено',
                  })
                }
              />
            </div>
            <div className="ws-actions">
              <Button variant="secondary" onClick={() => navigate(row.section as AdminSectionId)}>
                Открыть
                <ArrowRight size={14} />
              </Button>
              {row.status === 'Новое' && (
                <Button
                  variant="ghost"
                  onClick={() => put('notifications', { ...row, status: 'Просмотрено' })}
                >
                  Просмотрено
                </Button>
              )}
            </div>
          </article>
        ))}
        {!rows.length && (
          <Empty title="Новых уведомлений нет" text="Все события уже просмотрены." />
        )}
      </div>
    </section>
  );
}
