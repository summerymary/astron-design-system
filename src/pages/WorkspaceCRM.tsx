import { useCallback, useState } from 'react';
import { ArrowRight, Check, Plus, Send } from 'lucide-react';
import { Button } from '../components/ui';
import { useWorkspace } from '../components/WorkspaceProvider';
import {
  Back,
  Empty,
  LinkCards,
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

export function CRMWorkspace({
  section,
  navigate,
}: {
  section: AdminSectionId;
  navigate: Navigate;
}) {
  const { data, put } = useWorkspace();
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('Все этапы');
  const [pipeline, setPipeline] = useState('Все воронки');
  const [completed, setCompleted] = useState('В работе');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<DemoRecord | 'new' | null>(null);
  const [taskFilter, setTaskFilter] = useState('Сегодня');
  const [message, setMessage] = useState('');
  const closeForm = useCallback(() => setForm(null), []);
  const lead = data.leads.find((row) => row.id === selectedId);
  const stages = [
    ...new Set(
      data.pipelines
        .filter((row) => pipeline === 'Все воронки' || row.name === pipeline)
        .flatMap((row) => row.stages.split('\n'))
        .filter(Boolean),
    ),
  ];
  const fields: Field[] = [
    { key: 'name', label: 'Фамилия и имя', required: true },
    { key: 'phone', label: 'Телефон', type: 'tel', required: true },
    { key: 'club', label: 'Клуб', options: ['Центральный', 'Парк', 'Речной'] },
    {
      key: 'pipeline',
      label: 'Воронка',
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
        <LinkCards ids={['leads', 'segments', 'pipelines', 'retention']} navigate={navigate} />
        <section className="panel ws-panel">
          <div className="ws-panel-heading">
            <div>
              <h2>Мой день</h2>
              <p>Заявки и следующие шаги администратора.</p>
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
                  <Button variant="ghost" onClick={() => navigate('leads')}>
                    К заявкам
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
  if (section === 'pipelines') {
    const config: Resource = {
      title: 'Воронки и этапы',
      singular: 'Воронка',
      description: 'Этапы описывают последовательность работы. Первый этап — стартовый.',
      validate: (record, original) => {
        const values = record.stages
          .split('\n')
          .map((value) => value.trim())
          .filter(Boolean);
        if (values.length < 2) return 'Добавьте хотя бы два этапа.';
        if (new Set(values).size !== values.length) return 'Названия этапов не должны повторяться.';
        if (original && values[0] !== original.stages.split('\n')[0])
          return 'Первый этап существующей воронки сохраняется. Создайте новую воронку для другой структуры.';
        return undefined;
      },
      fields: [
        { key: 'name', label: 'Название', required: true },
        {
          key: 'stages',
          label: 'Этапы по порядку — каждый с новой строки',
          type: 'textarea',
          required: true,
          hint: 'Пример: Новая → Связались → Пробное назначено → Покупка.',
        },
        { key: 'status', label: 'Статус', options: ['Активна', 'В архиве'] },
      ],
      columns: ['name', 'stages', 'status'],
      rows: [],
      links: ['crm', 'leads'],
    };
    return <ResourcePage collection="pipelines" config={config} navigate={navigate} />;
  }
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
          onChange={setCompleted}
          label="Состояние заявок"
        />
        <div className="ws-toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Имя или телефон" />
          <select
            aria-label="Воронка заявок"
            value={pipeline}
            onChange={(e) => {
              setPipeline(e.target.value);
              setStage('Все этапы');
            }}
          >
            <option>Все воронки</option>
            {data.pipelines.map((row) => (
              <option key={row.id}>{row.name}</option>
            ))}
          </select>
          <select aria-label="Этап заявок" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option>Все этапы</option>
            {stages.map((value) => (
              <option key={value}>{value}</option>
            ))}
            <option>Отказ</option>
          </select>
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
                <dl className="ws-facts">
                  <div>
                    <dt>Воронка</dt>
                    <dd>{lead.pipeline}</dd>
                  </div>
                  <div>
                    <dt>Ответственный</dt>
                    <dd>{lead.owner}</dd>
                  </div>
                  <div>
                    <dt>Следующий шаг</dt>
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
                      {next}
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
            const first =
              data.pipelines.find((row) => row.name === record.pipeline)?.stages.split('\n')[0] ||
              'Новая';
            put('leads', {
              ...record,
              stage: record.stage || first,
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
          <select
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
          </select>
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
}: {
  external: boolean;
  navigate: Navigate;
}) {
  const { data, put } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('Все каналы');
  const [text, setText] = useState('');
  const chat = data.chats.find((row) => row.id === selectedId);
  const rows = data.chats.filter(
    (row) =>
      (external ? row.channel !== 'Поддержка' : row.channel === 'Поддержка') &&
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
            <h2>{external ? 'Внешние обращения' : 'Очередь поддержки'}</h2>
            <p>Ответы в этом прототипе остаются только на экране.</p>
          </div>
        </div>
        <div className="ws-toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Имя клиента" />
          {external && (
            <select
              aria-label="Канал обращений"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              {['Все каналы', 'Telegram', 'ВКонтакте', 'WhatsApp'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          )}
        </div>
        <div className="ws-split">
          <div className="ws-master-list">
            {rows.map((row) => (
              <button
                key={row.id}
                className={row.id === selectedId ? 'selected' : ''}
                onClick={() => {
                  setSelectedId(row.id);
                  setText('');
                }}
              >
                <strong>
                  {row.name}
                  <time>{row.time}</time>
                </strong>
                <small>{row.channel}</small>
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
                </div>
                <div className="ws-chat-history" aria-live="polite">
                  {chat.messages.split('\n').map((line, index) => (
                    <p className={line.startsWith('Клуб:') ? 'from-club' : ''} key={index}>
                      {line}
                    </p>
                  ))}
                </div>
                <form
                  className="ws-chat-compose"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!text.trim()) return;
                    put('chats', {
                      ...chat,
                      messages: `${chat.messages}\nКлуб: ${text.trim()}`,
                      preview: text.trim(),
                      status: 'В работе',
                      time: 'Сейчас',
                    });
                    setText('');
                  }}
                >
                  <label className="form-field">
                    <span>Ответ клиенту</span>
                    <textarea
                      rows={3}
                      value={text}
                      maxLength={2000}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Текст демонстрационного ответа"
                    />
                  </label>
                  <Button type="submit" disabled={!text.trim()}>
                    <Send size={15} />
                    Добавить демоответ
                  </Button>
                </form>
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
  const rows = data.notifications.filter((row) => filter === 'Все' || row.status === 'Новое');
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
              put('notifications', { ...row, status: 'Просмотрено' }),
            )
          }
        >
          Отметить все просмотренными
        </Button>
      </div>
      <Tabs
        items={['Все', 'Новые']}
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
