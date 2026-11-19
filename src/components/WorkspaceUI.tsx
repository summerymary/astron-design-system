import { Field } from './Field';
import { ShiftEditor } from './ShiftEditor';
import { Select } from './Select';
import '../styles/workspace.css';
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
import { Button, ConfirmDialog, Modal, StatusBadge } from './ui';
import type { StatusTone } from '../lib/ui-semantics';
import { adminSections } from '../data/admin';
import type { Member, StatsGraphic } from '../types';
import type { AdminSectionId } from '../data/admin';
import type { DemoRecord, Field as FieldDefinition, Resource } from '../data/workspace';
import { money, prettyDate } from '../data/workspace';
import { demoId, useWorkspace } from './WorkspaceProvider';
import type { TrainingKind } from '../lib/training-kind';
import { displayNumber } from '../lib/display-format';

export type Navigate = (
  section: AdminSectionId,
  member?: Member,
  recordId?: string,
  context?: { saleTraining?: TrainingKind; saleTrainerId?: string },
) => void;
export function Tabs({
  items,
  value,
  onChange,
  label = 'Разделы',
  className = '',
  variant = 'line',
  idPrefix,
  panelId,
  selection = 'panel',
}: {
  items: (string | { id: string; label: string; count?: number })[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  variant?: 'line' | 'segmented';
  idPrefix?: string;
  panelId?: string;
  selection?: 'panel' | 'filter';
}) {
  const generatedId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const normalized = items.map((item) =>
    typeof item === 'string' ? { id: item, label: item } : item,
  );
  return (
    <div
      className={`ws-tabs ui-tabs ${className}`}
      data-ui="tabs"
      data-variant={variant}
      role={selection === 'filter' ? 'radiogroup' : 'tablist'}
      aria-label={label}
    >
      {normalized.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role={selection === 'filter' ? 'radio' : 'tab'}
          id={`${idPrefix || generatedId}-${item.id}`}
          aria-controls={panelId}
          aria-selected={selection === 'panel' ? value === item.id : undefined}
          aria-checked={selection === 'filter' ? value === item.id : undefined}
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
            refs.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            onChange(normalized[next].id);
          }}
        >
          {item.label}
          {'count' in item && item.count !== undefined && (
            <span className="ui-tab-count">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
export function SegmentedFilter(props: Omit<Parameters<typeof Tabs>[0], 'variant' | 'selection'>) {
  return <Tabs {...props} variant="segmented" selection="filter" />;
}
export function Status({ children, tone }: { children: ReactNode; tone?: StatusTone }) {
  return (
    <StatusBadge className="ws-status" tone={tone}>
      {children}
    </StatusBadge>
  );
}
export function Empty({
  title = 'Ничего не найдено',
  text = 'Измените запрос или сбросьте фильтры.',
  action,
  icon,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="ws-empty">
      {icon ?? <Search size={24} />}
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
          className="icon-button search-clear"
          aria-label="Очистить поиск"
          onClick={() => onChange('')}
        >
          <X size={14} />
        </button>
      )}
    </label>
  );
}
export function NavigationCard({
  title,
  caption,
  onClick,
}: {
  title: ReactNode;
  caption?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ws-link-card panel"
      data-ui="navigation-card"
      onClick={onClick}
    >
      <span>
        <strong>{title}</strong>
        {caption && <small>{caption}</small>}
      </span>
      <ChevronRight size={20} aria-hidden="true" />
    </button>
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
  labels,
}: {
  ids: readonly AdminSectionId[];
  navigate: Navigate;
  labels?: Partial<Record<AdminSectionId, string>>;
}) {
  return (
    <div className="ws-card-grid">
      {ids.map((id) => {
        const meta = adminSections.find((s) => s.id === id)!;
        return (
          <NavigationCard
            key={id}
            title={labels?.[id] || meta.label}
            caption={meta.caption}
            onClick={() => navigate(id)}
          />
        );
      })}
    </div>
  );
}
function StatsBackdrop({ graphic }: { graphic: StatsGraphic }) {
  if (graphic.kind === 'network') {
    return (
      <svg
        className="stats-backdrop stats-network-map"
        viewBox="0 0 320 112"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={graphic.description}
        focusable="false"
      >
        <path
          className="stats-network-street"
          d="M-8 22 L68 52 L153 39 L225 64 L330 20 M-8 93 L83 74 L184 98 L330 76 M58 -8 L76 52 L42 120 M167 -8 L151 39 L183 98 M261 -8 L225 64 L269 120"
        />
        {graphic.links.map(([from, to]) => {
          const a = graphic.nodes.find((node) => node.id === from);
          const b = graphic.nodes.find((node) => node.id === to);
          if (!a || !b) return null;
          return (
            <path
              key={`${from}-${to}`}
              className="stats-network-route"
              d={`M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 9} ${b.x} ${b.y}`}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {graphic.nodes.map((node) => (
          <g
            className="stats-network-node"
            key={node.id}
            transform={`translate(${node.x} ${node.y})`}
          >
            <path d="M0 5 C-3 1 -7 -2 -7 -6 A7 7 0 1 1 7 -6 C7 -2 3 1 0 5 Z" />
            <circle cy="-6" r="2.3" />
          </g>
        ))}
      </svg>
    );
  }
  const values = graphic.points.map((point) => point.value);
  if (values.length < 2 || values.some((value) => !Number.isFinite(value) || value < 0))
    return null;
  const min = graphic.domain === 'zero' ? 0 : Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const coordinates = values.map((value, i) => ({
    x: 4 + (i / (values.length - 1)) * 312,
    y: range ? 100 - ((value - min) / range) * 80 : 60,
  }));
  const points = coordinates.map((point) => `${point.x},${point.y}`).join(' ');
  const last = coordinates[coordinates.length - 1];
  return (
    <svg
      className="stats-backdrop"
      viewBox="0 0 320 112"
      preserveAspectRatio="none"
      role="img"
      aria-label={graphic.description}
      focusable="false"
    >
      <path className="stats-backdrop-area" d={`M4 108 L${points} L316 108 Z`} />
      <polyline className="stats-backdrop-line" points={points} vectorEffect="non-scaling-stroke" />
      <circle className="stats-backdrop-end" cx={last.x} cy={last.y} r="3" />
    </svg>
  );
}
export function Stats({
  items,
}: {
  items: { label: string; value: string | number; note?: string; graphic?: StatsGraphic }[];
}) {
  return (
    <div className="ws-stats" data-ui="stats">
      {items.map((item) => (
        <div key={item.label} data-graphic={item.graphic?.kind}>
          {item.graphic && <StatsBackdrop graphic={item.graphic} />}
          <span>{item.label}</span>
          <strong>{displayNumber(item.value)}</strong>
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
  error,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <Field
      className={`form-field ${field.type === 'textarea' ? 'ws-field-wide' : ''}`}
      htmlFor={id}
      label={field.label}
      required={field.required}
      hint={field.hint}
      error={error}
    >
      {field.options ? (
        <Select
          id={id}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {!value && <option value="">Выберите</option>}
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </Select>
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
          onInput={
            ['date', 'time', 'datetime-local'].includes(field.type || '')
              ? (e) => onChange(e.currentTarget.value)
              : undefined
          }
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
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
  fields: FieldDefinition[];
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
            error={
              error && field.required && !draft[field.key]?.trim() ? 'Заполните поле' : undefined
            }
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
  if (key === 'stages')
    return (
      <ol className="pipeline-stages" aria-label="Этапы обработки заявки">
        {value
          .split(/\r?\n/)
          .map((stage) => stage.trim())
          .filter(Boolean)
          .map((stage, index) => (
            <li key={`${index}-${stage}`}>
              <span className="pipeline-stage-number" aria-hidden="true">
                {index + 1}
              </span>
              <span>{stage}</span>
            </li>
          ))}
      </ol>
    );
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
  return displayNumber(value);
}
export function DataTable({
  columns,
  rows,
  footerRows = [],
  tableLabel,
  onOpen,
  empty,
}: {
  columns: { key: string; label: string; render?: (row: DemoRecord) => ReactNode }[];
  rows: DemoRecord[];
  footerRows?: DemoRecord[];
  tableLabel?: string;
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
  if (!rows.length && !footerRows.length) return empty ?? <Empty />;
  return (
    <>
      <div
        className="ws-table-wrap"
        tabIndex={tableLabel ? 0 : undefined}
        role={tableLabel ? 'region' : undefined}
        aria-label={tableLabel}
      >
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
              <tr
                key={row.id}
                className={onOpen ? 'is-openable' : undefined}
                onClick={
                  onOpen
                    ? (event) => {
                        if (
                          !(event.target as HTMLElement).closest(
                            'button, a, input, select, textarea',
                          )
                        )
                          onOpen(row);
                      }
                    : undefined
                }
              >
                {columns.map((column, index) => (
                  <td key={column.key}>
                    {index === 0 && onOpen ? (
                      <button className="ws-record-link" onClick={() => onOpen(row)}>
                        {column.render
                          ? column.render(row)
                          : recordValue(row[column.key], column.key)}
                      </button>
                    ) : column.render ? (
                      column.render(row)
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
          {!!footerRows.length && (
            <tfoot>
              {footerRows.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.render ? column.render(row) : row[column.key] || '—'}
                    </td>
                  ))}
                  {onOpen && <td />}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>
      <div className="ws-mobile-records">
        {[...ordered, ...footerRows].map((row) => (
          <div
            className={`ws-mobile-record ${onOpen ? 'is-openable' : ''} ${footerRows.includes(row) ? 'ws-table-summary' : ''}`}
            key={row.id}
            onClick={
              onOpen
                ? (event) => {
                    if (
                      !(event.target as HTMLElement).closest('button, a, input, select, textarea')
                    )
                      onOpen(row);
                  }
                : undefined
            }
          >
            <strong>
              {columns[0]?.render ? columns[0].render(row) : row.name || row[columns[0].key]}
            </strong>
            <dl>
              {columns
                .filter((column) => column.key !== 'name')
                .map((column) => (
                  <div key={column.key}>
                    <dt>{column.label}</dt>
                    <dd>
                      {column.render
                        ? column.render(row)
                        : recordValue(row[column.key], column.key)}
                    </dd>
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
  page = false,
}: {
  title: string;
  record: DemoRecord;
  fields: FieldDefinition[];
  onClose: () => void;
  actions?: ReactNode;
  children?: ReactNode;
  page?: boolean;
}) {
  const content = (
    <>
      <div className={page ? 'record-page-grid' : undefined}>
        <section className={page ? 'panel ws-panel-body' : undefined}>
          {page && <h3>Сведения сотрудника</h3>}
          <dl className="ws-facts">
            {fields.map((field) => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>{recordValue(record[field.key], field.key)}</dd>
              </div>
            ))}
          </dl>
        </section>
        {children && <div className={page ? 'panel ws-panel-body' : undefined}>{children}</div>}
      </div>
      {actions && <div className="ws-actions">{actions}</div>}
    </>
  );
  return page ? (
    <article className="record-page ws-stack" aria-label={title}>
      <Back onClick={onClose}>Все сотрудники</Back>
      {content}
    </article>
  ) : (
    <Modal title={title} onClose={onClose}>
      {content}
    </Modal>
  );
}
export function ResourcePage({
  collection,
  config,
  navigate,
  recordId,
  onRecord,
  detailsExtra,
}: {
  collection: string;
  config: Resource;
  navigate: Navigate;
  recordId?: string | null;
  onRecord?: (id: string | null) => void;
  detailsExtra?: (record: DemoRecord) => ReactNode;
}) {
  const { data, put, remove } = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Все статусы');
  const [club, setClub] = useState('Все клубы');
  const [openedRecord, setOpened] = useState<DemoRecord | null>(null);
  const employeePage = collection === 'employees' && !!onRecord;
  const opened = employeePage
    ? (data[collection] || []).find((row) => row.id === recordId) || null
    : openedRecord;
  const [editing, setEditing] = useState<DemoRecord | 'new' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const closeDetails = useCallback(() => {
    setOpened(null);
    if (employeePage) onRecord?.(null);
    setConfirm(false);
  }, [employeePage, onRecord]);
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
      {!opened && config.links && <SectionLinks ids={config.links} navigate={navigate} />}
      {message && <Notice tone="success">{message}</Notice>}
      {!(employeePage && opened) && (
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
                <Select
                  aria-label="Статус записей"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option>Все статусы</option>
                  {statuses.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </Select>
              </label>
            )}
            {!!clubs.length && (
              <Select
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
              </Select>
            )}
          </div>
          <DataTable
            columns={config.columns.map((key) => ({
              key,
              label: config.fields.find((field) => field.key === key)?.label ?? key,
            }))}
            rows={shown}
            onOpen={(row) => (employeePage ? onRecord?.(row.id) : setOpened(row))}
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
      )}
      {opened && (
        <RecordDetails
          page={employeePage}
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
                    if (!employeePage) closeDetails();
                  }}
                >
                  <Edit3 size={14} />
                  Редактировать
                </Button>
                <Button variant="danger-ghost" onClick={() => setConfirm(true)}>
                  Удалить…
                </Button>
                {confirm && (
                  <ConfirmDialog
                    title="Удалить запись?"
                    subject={opened.name}
                    description="Запись будет удалена из демоданных."
                    confirmLabel="Удалить запись"
                    cancelLabel="Оставить запись"
                    onClose={() => setConfirm(false)}
                    onConfirm={() => {
                      if (config.readonly) return;
                      remove(collection, opened.id);
                      closeDetails();
                      setMessage('Запись удалена из прототипа.');
                    }}
                  />
                )}
              </>
            )
          }
        >
          {collection === 'employees' && !config.readonly && <EmployeeExtras employee={opened} />}
          {detailsExtra?.(opened)}
          {collection === 'rooms' && opened.seats !== 'Без выбора места' && (
            <div className="ws-seat-preview" aria-label="Пример схемы мест">
              {Array.from({ length: Math.min(60, Number(opened.capacity) || 0) }, (_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
          )}
        </RecordDetails>
      )}
      {editing && !config.readonly && (
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
            if (config.readonly) return 'Изменение записей недоступно.';
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
  const assignmentFields: FieldDefinition[] = [
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
      {form === 'shifts' && (
        <ShiftEditor
          employee={employee}
          initial={{
            id: '',
            name: employee.name,
            employeeId: employee.id,
            club: employee.club,
            reception: data.receptions.find((row) => row.club === employee.club)?.name || '',
            workplace: 'Место 1',
            start: '',
            end: '',
            status: 'Запланирована',
          }}
          onClose={close}
        />
      )}
      {form === 'assignments' && (
        <RecordForm
          inline
          title="Назначение должности"
          fields={assignmentFields}
          onClose={close}
          onSave={(record) => {
            put('assignments', { ...record, name: employee.name, status: 'Действует' });
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
  hideIcon = false,
  className = '',
}: {
  onClick: () => void;
  children?: ReactNode;
  hideIcon?: boolean;
  className?: string;
}) {
  return (
    <button type="button" className={`ws-back ${className}`} onClick={onClick}>
      {!hideIcon && <ArrowLeft size={18} />}
      {children}
    </button>
  );
}
