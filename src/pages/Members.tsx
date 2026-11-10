import { Select } from '../components/Select';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Member, MemberStatus } from '../types';
import { Avatar, Badge, Button } from '../components/ui';
import { Status, Tabs } from '../components/WorkspaceUI';
import { memberCards } from '../data/admin';
import { searchMembers } from '../lib/member-search';
import { MembershipTag } from '../components/MembershipTag';
import { MinimalMembersTable } from '../components/MinimalMembersTable';
import { useTheme } from '../components/ThemeProvider';

export function Members({
  members,
  onMember,
  onAdd,
}: {
  members: Member[];
  onMember: (m: Member) => void;
  onAdd: () => void;
}) {
  const { visualStyle } = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MemberStatus | 'all'>('all');
  const [plan, setPlan] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ascending, setAscending] = useState(true);
  const [view, setView] = useState('Контакты');
  const [clientState, setClientState] = useState('Активные клиенты');
  const filtered = useMemo(
    () =>
      members
        .filter(
          (m) =>
            (filter === 'all' || m.status === filter) &&
            (plan === 'all' || m.plan === plan) &&
            (clientState === 'Все клиенты' ||
              (clientState === 'В архиве' ? m.archived : !m.archived)) &&
            (!query.trim() ||
              searchMembers([m], memberCards, query).length > 0 ||
              m.email.toLowerCase().includes(query.toLowerCase())),
        )
        .sort((a, b) =>
          ascending ? a.name.localeCompare(b.name, 'ru') : b.name.localeCompare(a.name, 'ru'),
        ),
    [members, query, filter, plan, ascending, clientState],
  );
  const tabs = [
    { id: 'all', title: 'Все клиенты' },
    { id: 'active', title: 'Активные' },
    { id: 'expiring', title: 'Истекают' },
    { id: 'paused', title: 'Заморожены' },
  ] as const;
  return (
    <>
      <section className="panel clients-panel">
        <Tabs
          items={['Контакты', 'Абонементы']}
          value={view}
          onChange={setView}
          label="Вид клиентской базы"
        />
        {view === 'Абонементы' && (
          <div className="clients-tabs" aria-label="Статус абонемента">
            {tabs.map((t) => (
              <button
                key={t.id}
                aria-pressed={filter === t.id}
                className={filter === t.id ? 'selected' : ''}
                onClick={() => setFilter(t.id)}
              >
                {t.title}
                <span>
                  {t.id === 'all'
                    ? members.length
                    : members.filter((m) => m.status === t.id).length}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Поиск клиентов"
              placeholder="ФИО, телефон, email или карта"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="icon-button"
                onClick={() => setQuery('')}
                aria-label="Очистить поиск"
              >
                <X size={14} />
              </button>
            )}
          </label>
          <Button
            variant="secondary"
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={15} />
            Фильтры{plan !== 'all' && <span className="filter-dot" />}
          </Button>
          <Select
            aria-label="Статус клиента"
            value={clientState}
            onChange={(event) => setClientState(event.target.value)}
          >
            <option>Активные клиенты</option>
            <option>Все клиенты</option>
            <option>В архиве</option>
          </Select>
        </div>
        {filtersOpen && (
          <div className="extra-filters">
            <label htmlFor="plan-filter">Абонемент</label>
            <Select id="plan-filter" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="all">Все абонементы</option>
              {[...new Set(members.map((member) => member.plan))].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Select>
            <Button
              variant="ghost"
              onClick={() => {
                setPlan('all');
                setFilter('all');
                setQuery('');
              }}
            >
              Сбросить
            </Button>
          </div>
        )}
        {filtered.length ? (
          <>
            <div className="table-scroll">
              {visualStyle === 'spectrum' ? (
                <MinimalMembersTable
                  members={filtered}
                  contacts={view === 'Контакты'}
                  ascending={ascending}
                  onSort={() => setAscending(!ascending)}
                  onMember={onMember}
                />
              ) : (
                <table className="members-table">
                  <thead>
                    <tr>
                      <th>
                        <button className="sort-button" onClick={() => setAscending(!ascending)}>
                          Клиент
                          <ArrowDown
                            size={13}
                            style={{ transform: ascending ? undefined : 'rotate(180deg)' }}
                          />
                        </button>
                      </th>
                      {view === 'Контакты' ? (
                        <>
                          <th>Телефон</th>
                          <th>Email</th>
                          <th>Карта</th>
                          <th>Статус клиента</th>
                          <th>Теги</th>
                        </>
                      ) : (
                        <>
                          <th>Абонемент</th>
                          <th>Статус абонемента</th>
                          <th>Действует до</th>
                          <th>Посещения</th>
                        </>
                      )}
                      <th>
                        <span className="sr-only">Открыть</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m) => (
                      <tr
                        key={m.id}
                        className="is-openable"
                        onClick={(event) => {
                          if (!(event.target as HTMLElement).closest('button, a')) onMember(m);
                        }}
                      >
                        <td>
                          <button className="member-name-button" onClick={() => onMember(m)}>
                            <Avatar member={m} />
                            <span>
                              <strong>{m.name}</strong>
                              {view === 'Абонементы' && <small>{m.email}</small>}
                            </span>
                          </button>
                        </td>
                        {view === 'Контакты' ? (
                          <>
                            <td>{m.phone}</td>
                            <td>{m.email || '—'}</td>
                            <td>
                              <code>{memberCards[m.id] || String(m.id + 99000)}</code>
                            </td>
                            <td>
                              <Status>{m.archived ? 'В архиве' : 'Активен'}</Status>
                            </td>
                            <td>{m.tags || '—'}</td>
                          </>
                        ) : (
                          <>
                            <td>
                              <MembershipTag name={m.plan} />
                            </td>
                            <td>
                              <Badge status={m.status} />
                            </td>
                            <td>{m.expires}</td>
                            <td>{m.visits}</td>
                          </>
                        )}
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Открыть: ${m.name}`}
                            onClick={() => onMember(m)}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="mobile-member-list">
              {filtered.map((m) => (
                <button className="mobile-member" key={m.id} onClick={() => onMember(m)}>
                  <Avatar member={m} />
                  <span>
                    <strong>{m.name}</strong>
                    <small>{view === 'Контакты' ? m.phone : `${m.plan} · до ${m.expires}`}</small>
                  </span>
                  {view === 'Контакты' ? (
                    <Status>{m.archived ? 'В архиве' : 'Активен'}</Status>
                  ) : (
                    <Badge status={m.status} />
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="no-results">
            <Search size={28} />
            <h3>Никого не нашли</h3>
            <p>Попробуйте другой запрос или сбросьте фильтры.</p>
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setPlan('all');
                setFilter('all');
                setClientState('Все клиенты');
              }}
            >
              Сбросить фильтры
            </Button>
          </div>
        )}
        <div className="table-footer">
          <span>
            Показано {filtered.length} из {members.length} клиентов
          </span>
          <span>Все данные в памяти</span>
        </div>
      </section>
      <div className="clients-bottom-note">
        <button onClick={onAdd}>
          Добавить ещё одного клиента <ArrowUpRight size={14} />
        </button>
      </div>
    </>
  );
}
