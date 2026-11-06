import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpRight, CreditCard, ListFilter, Search, X } from 'lucide-react';
import { Avatar, Button } from '../components/ui';
import { AdminQuickLinks } from '../components/AdminQuickLinks';
import { memberDemographics, visitKinds } from '../data/admin';
import type { AdminSectionId } from '../data/admin';
import { demoClubs } from '../data/roles';
import type { Member, Visit } from '../types';

const initialFilters = (clubId: string) => ({
  clubId,
  kind: 'all',
  gender: 'all',
  age: '',
  fromDate: '2026-11-01',
  fromTime: '00:00',
  toDate: '2026-11-01',
  toTime: '23:59',
});

export function AdminOverview({
  visits,
  members,
  clubId,
  onMember,
  onAction,
}: {
  visits: Visit[];
  members: Member[];
  clubId: string;
  onMember: (member: Member) => void;
  onAction: (id: AdminSectionId) => void;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState(() => initialFilters(clubId));
  const [draft, setDraft] = useState(filters);
  const [unique, setUnique] = useState(false);
  const [sort, setSort] = useState('time');
  const [filterError, setFilterError] = useState('');
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const filtered = useMemo(() => {
    const found = visits
      .filter((v) => {
        const member = memberMap.get(v.memberId);
        const demographic = memberDemographics[v.memberId];
        return (
          member &&
          (filters.clubId === 'all' || v.clubId === filters.clubId) &&
          (filters.kind === 'all' || v.kind === filters.kind) &&
          (filters.gender === 'all' || demographic?.gender === filters.gender) &&
          (!filters.age || demographic?.age === Number(filters.age)) &&
          v.enteredAt >= `${filters.fromDate}T${filters.fromTime || '00:00'}` &&
          v.enteredAt <= `${filters.toDate}T${filters.toTime || '23:59'}` &&
          `${member.name} ${v.card}`.toLowerCase().includes(query.trim().toLowerCase())
        );
      })
      .sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));
    const seen = new Set<number>();
    const rows = unique
      ? found.filter((v) => {
          if (seen.has(v.memberId)) return false;
          seen.add(v.memberId);
          return true;
        })
      : found;
    return sort === 'name'
      ? [...rows].sort((a, b) =>
          memberMap
            .get(a.memberId)!
            .name.split(' ')
            .at(-1)!
            .localeCompare(memberMap.get(b.memberId)!.name.split(' ').at(-1)!, 'ru'),
        )
      : rows;
  }, [visits, memberMap, filters, query, unique, sort]);
  const activeCount =
    Number(filters.kind !== 'all') +
    Number(filters.gender !== 'all') +
    Number(!!filters.age) +
    Number(filters.clubId !== clubId) +
    Number(
      filters.fromDate !== '2026-11-01' ||
        filters.toDate !== '2026-11-01' ||
        filters.fromTime !== '00:00' ||
        filters.toTime !== '23:59',
    );
  const resetFilters = () => {
    const next = initialFilters(clubId);
    setFilters(next);
    setDraft(next);
    setQuery('');
    setUnique(false);
    setFilterError('');
  };
  const field = (name: keyof typeof filters, value: string) =>
    setDraft((prev) => ({ ...prev, [name]: value }));
  return (
    <div className="admin-home-grid">
      <section className="panel visitor-panel">
        <div className="visitor-heading">
          <div>
            <span className="eyebrow">РАБОЧИЙ ЖУРНАЛ</span>
            <h2>
              Недавние посетители <span>{filtered.length}</span>
            </h2>
            <p>Кто приходит в клуб — здесь и сейчас.</p>
          </div>
          <span className="visitor-live">
            <i />
            Обновлено в 14:35
          </span>
        </div>
        <div className="visitor-toolbar">
          <label className="visitor-search">
            <Search size={17} />
            <input
              aria-label="Найти посетителя"
              placeholder="Имя клиента или номер карты"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="icon-button"
                aria-label="Очистить поиск посетителей"
                onClick={() => setQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </label>
          <button
            className={`visitor-filter-button ${expanded || activeCount ? 'active' : ''}`}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <ListFilter size={16} />
            Фильтры{activeCount > 0 && <b>{activeCount}</b>}
          </button>
        </div>
        {expanded && (
          <form
            className="visitor-filters"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const next = {
                fromDate: String(form.get('fromDate')),
                fromTime: String(form.get('fromTime') || '00:00'),
                toDate: String(form.get('toDate')),
                toTime: String(form.get('toTime') || '23:59'),
                clubId: String(form.get('clubId')),
                kind: String(form.get('kind')),
                gender: String(form.get('gender')),
                age: String(form.get('age') || ''),
              };
              if (`${next.fromDate}T${next.fromTime}` > `${next.toDate}T${next.toTime}`) {
                setFilterError('Начало периода должно быть раньше конца.');
                return;
              }
              setDraft(next);
              setFilters(next);
              setFilterError('');
            }}
          >
            <div className="filter-date-group">
              <label>
                С даты
                <input
                  aria-label="Посещения с даты"
                  name="fromDate"
                  type="date"
                  required
                  value={draft.fromDate}
                  onChange={(e) => field('fromDate', e.target.value)}
                />
              </label>
              <label>
                Время
                <input
                  aria-label="Посещения с времени"
                  name="fromTime"
                  type="time"
                  value={draft.fromTime}
                  onChange={(e) => field('fromTime', e.target.value)}
                />
              </label>
              <label>
                По дату
                <input
                  aria-label="Посещения по дату"
                  name="toDate"
                  type="date"
                  required
                  value={draft.toDate}
                  onChange={(e) => field('toDate', e.target.value)}
                />
              </label>
              <label>
                Время
                <input
                  aria-label="Посещения по время"
                  name="toTime"
                  type="time"
                  value={draft.toTime}
                  onChange={(e) => field('toTime', e.target.value)}
                />
              </label>
            </div>
            <div className="filter-details-group">
              <label>
                Клуб
                <select
                  aria-label="Клуб посетителей"
                  name="clubId"
                  value={draft.clubId}
                  onChange={(e) => field('clubId', e.target.value)}
                >
                  <option value="all">Все клубы</option>
                  {demoClubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Посещение
                <select
                  aria-label="Тип посещения"
                  name="kind"
                  value={draft.kind}
                  onChange={(e) => field('kind', e.target.value)}
                >
                  <option value="all">Все посещения</option>
                  {Object.entries(visitKinds).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Пол
                <select
                  aria-label="Пол посетителей"
                  name="gender"
                  value={draft.gender}
                  onChange={(e) => field('gender', e.target.value)}
                >
                  <option value="all">Любой</option>
                  <option value="male">Мужчины</option>
                  <option value="female">Женщины</option>
                </select>
              </label>
              <label>
                Возраст, лет
                <input
                  aria-label="Возраст посетителя"
                  name="age"
                  type="number"
                  min="0"
                  max="120"
                  placeholder="Любой"
                  value={draft.age}
                  onChange={(e) => field('age', e.target.value)}
                />
              </label>
            </div>
            {filterError && (
              <p role="alert" className="filter-error">
                {filterError}
              </p>
            )}
            <div className="filter-form-actions">
              <span>Фильтры применяются к журналу посещений</span>
              <Button type="button" variant="ghost" onClick={resetFilters}>
                Сбросить
              </Button>
              <Button type="submit">Показать</Button>
            </div>
          </form>
        )}
        <div className="visitor-table-controls">
          <label>
            <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
            Только уникальные клиенты
          </label>
          <label className="visitor-sort">
            <ArrowDownWideNarrow size={13} />
            <select
              aria-label="Сортировка посетителей"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="time">Сначала новые</option>
              <option value="name">По фамилии</option>
            </select>
          </label>
        </div>
        {filtered.length ? (
          <>
            <div className="visitor-table-scroll">
              <table className="visitor-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Время входа</th>
                    <th>Карта</th>
                    <th>Клиент</th>
                    <th>Посещение</th>
                    <th>Абонемент</th>
                    <th>Клуб</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, i) => {
                    const member = memberMap.get(v.memberId)!;
                    return (
                      <tr key={v.id}>
                        <td>{String(i + 1).padStart(2, '0')}</td>
                        <td>
                          <time dateTime={v.enteredAt}>{v.enteredAt.slice(11)}</time>
                          {v.enteredAt.slice(0, 10) !== '2026-11-01' && (
                            <small>
                              {v.enteredAt.slice(8, 10)}.{v.enteredAt.slice(5, 7)}
                            </small>
                          )}
                        </td>
                        <td>
                          <button className="visitor-card-link" onClick={() => onMember(member)}>
                            {v.card}
                          </button>
                        </td>
                        <td>
                          <button
                            className="visitor-member-button"
                            onClick={() => onMember(member)}
                          >
                            <Avatar member={member} />
                            <span>
                              <strong>{member.name}</strong>
                            </span>
                          </button>
                        </td>
                        <td>
                          <span className={`visit-kind visit-kind-${v.kind}`}>
                            {visitKinds[v.kind]}
                          </span>
                        </td>
                        <td>{v.plan}</td>
                        <td>{demoClubs.find((c) => c.id === v.clubId)?.shortName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="visitor-mobile-list">
              {filtered.map((v) => {
                const member = memberMap.get(v.memberId)!;
                return (
                  <article key={v.id} className="visitor-mobile-card">
                    <div>
                      <Avatar member={member} />
                      <button onClick={() => onMember(member)}>
                        <strong>{member.name}</strong>
                        <span>
                          Карта {v.card}
                          <ArrowUpRight size={11} />
                        </span>
                      </button>
                      <time>{v.enteredAt.slice(11)}</time>
                    </div>
                    <dl>
                      <div>
                        <dt>Посещение</dt>
                        <dd>{visitKinds[v.kind]}</dd>
                      </div>
                      <div>
                        <dt>Абонемент</dt>
                        <dd>{v.plan}</dd>
                      </div>
                      <div>
                        <dt>Клуб</dt>
                        <dd>{demoClubs.find((c) => c.id === v.clubId)?.shortName}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="visitor-no-results">
            <Search size={28} />
            <h3>Посещений не найдено</h3>
            <p>Попробуйте другой запрос или измените фильтры.</p>
            <Button variant="secondary" onClick={resetFilters}>
              Сбросить фильтры
            </Button>
          </div>
        )}
        <div className="visitor-footer">
          <span>
            Показано посещений: <strong>{filtered.length}</strong>
          </span>
          <span>{new Set(filtered.map((v) => v.memberId)).size} уникальных клиентов</span>
        </div>
        <div className="visitor-hint">
          <CreditCard size={14} />
          <span>Нажмите на карту или имя, чтобы открыть карточку клиента.</span>
        </div>
      </section>
      <AdminQuickLinks onAction={onAction} />
    </div>
  );
}
