import { useCallback, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Edit3,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Button, Modal } from './ui';
import { adminSections } from '../data/admin';
import type { AdminSectionId } from '../data/admin';
import type { DemoRecord, Field, Resource } from '../data/workspace';
import { money, prettyDate } from '../data/workspace';
import { demoId, useWorkspace } from './WorkspaceProvider';

export type Navigate = (section: AdminSectionId) => void;
export function Tabs({
  items,
  value,
  onChange,
  label = 'Разделы',
}: {
  items: (string | { id: string; label: string })[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const normalized = items.map((item) =>
    typeof item === 'string' ? { id: item, label: item } : item,
  );
  return (
    <div className="ws-tabs" role="tablist" aria-label={label}>
      {normalized.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          tabIndex={value === item.id ? 0 : -1}
          className={value === item.id ? 'selected' : ''}
          ref={(el) => {
            refs.current[index] = el;
          }}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            let next = index;
            if (event.key === 'ArrowRight') next = (index + 1) % items.length;
            else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = items.length - 1;
            else return;
            event.preventDefault();
            refs.current[next]?.focus();
            onChange(normalized[next].id);
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
export function Status({ children }: { children: ReactNode }) {
  const text = String(children);
  const tone = /архив|ошибка|отмен|пропущ|высокий/i.test(text)
    ? 'danger'
    : /нов|ожида|чернов|средний|провер/i.test(text)
      ? 'warning'
      : /актив|действ|выполн|оплачен|опублик|подтверж|решено|заверш/i.test(text)
        ? 'success'
        : 'neutral';
  return (
    <span className={`ws-status ws-status-${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Empty({
  title = 'Ничего не найдено',
  text = 'Измените запрос или сбросьте фильтры.',
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ws-empty">
      <Search size={24} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'success' | 'warning';
}) {
  return (
    <div className={`ws-notice ws-notice-${tone}`} role="status">
      {tone === 'success' && <Check size={16} />}
      <span>{children}</span>
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = 'Поиск по названию',
  label = 'Поиск',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="search-field ws-search">
      <Search size={16} />
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className="icon-button"
          aria-label="Очистить поиск"
          onClick={() => onChange('')}
        >
          <X size={14} />
        </button>
      )}
    </label>
  );
}
export function SectionLinks({
  ids,
  navigate,
}: {
  ids: readonly AdminSectionId[];
  navigate: Navigate;
}) {
  return (
    <nav className="ws-links" aria-label="Связанные разделы">
      {ids.map((id) => (
        <Button key={id} variant="secondary" onClick={() => navigate(id)}>
          {adminSections.find((s) => s.id === id)?.label}
          <ArrowUpRight size={14} />
        </Button>
      ))}
    </nav>
  );
}
export function LinkCards({
  ids,
  navigate,
}: {
  ids: readonly AdminSectionId[];
  navigate: Navigate;
}) {
  return (
    <div className="ws-card-grid">
      {ids.map((id) => {
        const meta = adminSections.find((s) => s.id === id)!;
        return (
          <button className="ws-link-card panel" key={id} onClick={() => navigate(id)}>
            <span>
              <strong>{meta.label}</strong>
              <small>{meta.caption}</small>
            </span>
            <ArrowUpRight size={19} />
          </button>
        );
      })}
    </div>
  );
}
export function Stats({
  items,
}: {
  items: { label: string; value: string | number; note?: string }[];
}) {
  return (
    <div className="ws-stats">
      {items.map((item) => (
        <div className="panel" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </div>
  );
}
export function FieldControl({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <label
      className={`form-field ${field.type === 'textarea' ? 'ws-field-wide' : ''}`}
      htmlFor={id}
    >
      <span>
        {field.label}
        {field.required && <em> *</em>}
      </span>
      {field.options ? (
        <select
          id={id}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {!value && <option value="">Выберите</option>}
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          id={id}
          required={field.required}
          maxLength={4000}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          type={field.type ?? 'text'}
          readOnly={field.readOnly}
          required={field.required}
          min={field.min}
          maxLength={field.type === 'number' ? undefined : 240}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.hint && <small>{field.hint}</small>}
    </label>
  );
}
export function RecordForm({
  title,
  fields,
  initial,
  onClose,
  onSave,
  submit = 'Сохранить',
  children,
  inline = false,
}: {
  title: string;
  fields: Field[];
  initial?: DemoRecord;
  onClose: () => void;
  onSave: (record: DemoRecord) => void | string;
  submit?: string;
  children?: ReactNode;
  inline?: boolean;
}) {
  const [draft, setDraft] = useState<DemoRecord>(() =>
    initial
      ? { ...initial }
      : {
          id: demoId('record'),
          ...Object.fromEntries(
            fields.map((field) => [
              field.key,
              field.options?.[0] ?? (field.type === 'color' ? '#8A332C' : ''),
            ]),
          ),
        },
  );
  const [error, setError] = useState('');
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (fields.some((field) => field.required && !draft[field.key]?.trim())) {
      setError('Заполните обязательные поля.');
      return;
    }
    if (draft.start && draft.end && draft.end < draft.start) {
      setError('Окончание должно быть позже начала.');
      return;
    }
    const result = onSave(draft);
    if (typeof result === 'string') setError(result);
  };
  const contents = (
    <form className="ws-form" onSubmit={handleSubmit}>
      <div className="ws-fields">
        {fields.map((field) => (
          <FieldControl
            key={field.key}
            field={field}
            value={draft[field.key] ?? ''}
            onChange={(value) => {
              setDraft((previous) => ({ ...previous, [field.key]: value }));
              setError('');
            }}
          />
        ))}
      </div>
      {children}
      {error && (
        <p className="ws-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit">
          <Check size={15} />
          {submit}
        </Button>
      </div>
    </form>
  );
  return inline ? (
    <section className="ws-stack">
      <h3>{title}</h3>
      {contents}
    </section>
  ) : (
    <Modal title={title} onClose={onClose}>
      {contents}
    </Modal>
  );
}
export function recordValue(value: string, key = ''): ReactNode {
  if (!value) return '—';
  if (key === 'status' || key === 'risk') return <Status>{value}</Status>;
  if (key === 'color')
    return (
      <span className="ws-swatch">
        <i style={{ background: value }} />
        {value}
      </span>
    );
  if (['price', 'amount', 'cost', 'total'].includes(key)) return money(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return prettyDate(value);
  return value;
}
export function DataTable({
  columns,
  rows,
  onOpen,
  empty,
}: {
  columns: { key: string; label: string }[];
  rows: DemoRecord[];
  onOpen?: (record: DemoRecord) => void;
  empty?: ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; asc: boolean } | null>(null);
  const ordered = sort
    ? [...rows].sort(
        (a, b) =>
          (a[sort.key] ?? '').localeCompare(b[sort.key] ?? '', 'ru', { numeric: true }) *
          (sort.asc ? 1 : -1),
      )
    : rows;
  if (!rows.length) return empty ?? <Empty />;
  return (
    <>
      <div className="ws-table-wrap">
        <table className="ws-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  aria-sort={
                    sort?.key === column.key ? (sort.asc ? 'ascending' : 'descending') : undefined
                  }
                >
                  <button
                    onClick={() =>
                      setSort({ key: column.key, asc: sort?.key === column.key ? !sort.asc : true })
                    }
                  >
                    {column.label}
                    {sort?.key === column.key && (
                      <ArrowDown
                        size={12}
                        style={{ transform: sort.asc ? undefined : 'rotate(180deg)' }}
                      />
                    )}
                  </button>
                </th>
              ))}
              {onOpen && (
                <th>
                  <span className="sr-only">Открыть запись</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <tr key={row.id}>
                {columns.map((column, index) => (
                  <td key={column.key}>
                    {index === 0 && onOpen ? (
                      <button className="ws-record-link" onClick={() => onOpen(row)}>
                        {recordValue(row[column.key], column.key)}
                      </button>
                    ) : (
                      recordValue(row[column.key], column.key)
                    )}
                  </td>
                ))}
                {onOpen && (
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Открыть: ${row.name || row[columns[0].key]}`}
                      onClick={() => onOpen(row)}
                    >
                      <ChevronRight size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ws-mobile-records">
        {ordered.map((row) => (
          <div className="ws-mobile-record" key={row.id}>
            <strong>{row.name || row[columns[0].key]}</strong>
            <dl>
              {columns
                .filter((column) => column.key !== 'name')
                .map((column) => (
                  <div key={column.key}>
                    <dt>{column.label}</dt>
                    <dd>{recordValue(row[column.key], column.key)}</dd>
                  </div>
                ))}
            </dl>
            {onOpen && (
              <Button variant="secondary" onClick={() => onOpen(row)}>
                Открыть
                <ChevronRight size={15} />
              </Button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
export function RecordDetails({
  title,
  record,
  fields,
  onClose,
  actions,
  children,
}: {
  title: string;
  record: DemoRecord;
  fields: Field[];
  onClose: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <dl className="ws-facts">
        {fields.map((field) => (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>{recordValue(record[field.key], field.key)}</dd>
          </div>
        ))}
      </dl>
      {children}
      {actions && <div className="ws-actions">{actions}</div>}
    </Modal>
  );
}
export function ResourcePage({
  collection,
  config,
  navigate,
}: {
  collection: string;
  config: Resource;
  navigate: Navigate;
}) {
  const { data, put, remove } = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Все статусы');
  const [club, setClub] = useState('Все клубы');
  const [opened, setOpened] = useState<DemoRecord | null>(null);
  const [editing, setEditing] = useState<DemoRecord | 'new' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const closeDetails = useCallback(() => {
    setOpened(null);
    setConfirm(false);
  }, []);
  const closeForm = useCallback(() => setEditing(null), []);
  const rows = data[collection] ?? [];
  const statuses = [...new Set(rows.map((row) => row.status).filter(Boolean))];
  const clubs = [...new Set(rows.map((row) => row.club).filter(Boolean))];
  const shown = rows.filter(
    (row) =>
      Object.values(row)
        .join(' ')
        .toLocaleLowerCase('ru')
        .includes(query.toLocaleLowerCase('ru')) &&
      (status === 'Все статусы' || row.status === status) &&
      (club === 'Все клубы' || row.club === club),
  );
  return (
    <div className="ws-stack">
      {config.links && <SectionLinks ids={config.links} navigate={navigate} />}
      {message && <Notice tone="success">{message}</Notice>}
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>{config.title}</h2>
            <p>{config.description}</p>
          </div>
          {!config.readonly && (
            <Button onClick={() => setEditing('new')}>
              <Plus size={15} />
              Добавить
            </Button>
          )}
        </div>
        <div className="ws-toolbar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={
              collection === 'employees'
                ? 'ФИО, телефон или email'
                : collection === 'products'
                  ? 'Название, артикул или штрихкод'
                  : 'Поиск по записям'
            }
          />
          {!!statuses.length && (
            <label className="ws-inline-field">
              <span className="sr-only">Статус записей</span>
              <select
                aria-label="Статус записей"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>Все статусы</option>
                {statuses.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          {!!clubs.length && (
            <select
              aria-label="Клуб записей"
              value={club}
              onChange={(e) => setClub(e.target.value)}
            >
              <option>Все клубы</option>
              {clubs
                .filter((value) => value !== 'Все клубы')
                .map((value) => (
                  <option key={value}>{value}</option>
                ))}
            </select>
          )}
        </div>
        <DataTable
          columns={config.columns.map((key) => ({
            key,
            label: config.fields.find((field) => field.key === key)?.label ?? key,
          }))}
          rows={shown}
          onOpen={setOpened}
          empty={
            <Empty
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setStatus('Все статусы');
                    setClub('Все клубы');
                  }}
                >
                  Сбросить фильтры
                </Button>
              }
            />
          }
        />
        <div className="ws-table-footer">
          Показано {shown.length} из {rows.length}
        </div>
      </section>
      {opened && (
        <RecordDetails
          title={opened.name || config.singular}
          record={opened}
          fields={config.fields}
          onClose={closeDetails}
          actions={
            !config.readonly && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(opened);
                    closeDetails();
                  }}
                >
                  <Edit3 size={14} />
                  Редактировать
                </Button>
                {!confirm ? (
                  <Button variant="ghost" onClick={() => setConfirm(true)}>
                    Удалить…
                  </Button>
                ) : (
                  <div className="ws-confirm">
                    <p>Удалить «{opened.name}» из демоданных?</p>
                    <Button variant="secondary" onClick={() => setConfirm(false)}>
                      Оставить
                    </Button>
                    <Button
                      onClick={() => {
                        remove(collection, opened.id);
                        closeDetails();
                        setMessage('Запись удалена из прототипа.');
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                )}
              </>
            )
          }
        >
          {collection === 'employees' && <EmployeeExtras employee={opened} />}
          {collection === 'rooms' && opened.seats !== 'Без выбора места' && (
            <div className="ws-seat-preview" aria-label="Пример схемы мест">
              {Array.from({ length: Math.min(60, Number(opened.capacity) || 0) }, (_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
          )}
        </RecordDetails>
      )}
      {editing && (
        <RecordForm
          title={
            editing === 'new'
              ? `Добавить: ${config.singular.toLocaleLowerCase('ru')}`
              : `Редактировать: ${config.singular.toLocaleLowerCase('ru')}`
          }
          fields={config.fields}
          initial={editing === 'new' ? undefined : editing}
          onClose={closeForm}
          onSave={(record) => {
            const error = config.validate?.(
              record,
              rows.find((row) => row.id === record.id),
            );
            if (error) return error;
            put(collection, record);
            closeForm();
            setMessage('Изменения сохранены в прототипе.');
          }}
        />
      )}
    </div>
  );
}
function EmployeeExtras({ employee }: { employee: DemoRecord }) {
  const { data, put } = useWorkspace();
  const [form, setForm] = useState<'shifts' | 'assignments' | null>(null);
  const close = useCallback(() => setForm(null), []);
  const shiftFields: Field[] = [
    { key: 'club', label: 'Клуб', options: ['Центральный', 'Парк', 'Речной'] },
    { key: 'start', label: 'Начало смены', type: 'datetime-local', required: true },
    { key: 'end', label: 'Конец смены', type: 'datetime-local', required: true },
    { key: 'status', label: 'Статус', options: ['Черновик', 'На проверке', 'Подтверждено'] },
  ];
  const assignmentFields: Field[] = [
    { key: 'position', label: 'Должность', options: data.positions.map((row) => row.name) },
    { key: 'start', label: 'С даты', type: 'date', required: true },
    { key: 'end', label: 'По дату', type: 'date' },
  ];
  return (
    <div className="ws-stack">
      <section>
        <div className="ws-subheading">
          <h3>Должности</h3>
          <Button variant="secondary" onClick={() => setForm('assignments')}>
            Назначить
          </Button>
        </div>
        {data.assignments
          .filter((row) => row.name === employee.name)
          .map((row) => (
            <p key={row.id}>
              {row.position} · с {prettyDate(row.start)}
            </p>
          ))}
      </section>
      <section>
        <div className="ws-subheading">
          <h3>Рабочие смены</h3>
          <Button variant="secondary" onClick={() => setForm('shifts')}>
            Добавить смену
          </Button>
        </div>
        {data.shifts
          .filter((row) => row.name === employee.name)
          .map((row) => (
            <div className="ws-list-line" key={row.id}>
              <span>
                {prettyDate(row.start)} — {row.end.split('T')[1]}
                <small>{row.club}</small>
              </span>
              <Status>{row.status}</Status>
            </div>
          ))}
      </section>
      {form && (
        <RecordForm
          inline
          title={form === 'shifts' ? 'Новая смена' : 'Назначение должности'}
          fields={form === 'shifts' ? shiftFields : assignmentFields}
          onClose={close}
          onSave={(record) => {
            const hours =
              record.start && record.end
                ? String((Date.parse(record.end) - Date.parse(record.start)) / 3600000)
                : '0';
            put(form, {
              ...record,
              name: employee.name,
              hours,
              rate: '250',
              status: record.status ?? 'Действует',
            });
            close();
          }}
        />
      )}
    </div>
  );
}
export function Back({
  onClick,
  children = 'Назад',
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button className="ws-back" onClick={onClick}>
      <ArrowLeft size={15} />
      {children}
    </button>
  );
}
