import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import type { Member, MemberStatus } from '../types';
import { Avatar, Badge, Button } from '../components/ui';

export function Members({
  members,
  onMember,
  onAdd,
}: {
  members: Member[];
  onMember: (m: Member) => void;
  onAdd: () => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MemberStatus | 'all'>('all');
  const [plan, setPlan] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ascending, setAscending] = useState(true);
  const filtered = useMemo(
    () =>
      members
        .filter(
          (m) =>
            (filter === 'all' || m.status === filter) &&
            (plan === 'all' || m.plan === plan) &&
            `${m.name} ${m.email} ${m.phone} ${m.id}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          ascending ? a.name.localeCompare(b.name, 'ru') : b.name.localeCompare(a.name, 'ru'),
        ),
    [members, query, filter, plan, ascending],
  );
  const tabs = [
    { id: 'all', title: 'Все клиенты' },
    { id: 'active', title: 'Активные' },
    { id: 'expiring', title: 'Истекают' },
    { id: 'paused', title: 'Заморожены' },
  ] as const;
  return (
    <>
      <div className="members-summary">
        <div>
          <span className="eyebrow">КЛИЕНТСКАЯ БАЗА</span>
          <strong>
            {members.length.toString().padStart(2, '0')}
            <span>клиентов в прототипе</span>
          </strong>
        </div>
        <div className="summary-caption">
          <Users size={20} />
          <span>
            Каждое большое сообщество
            <br />
            начинается с одного человека.
          </span>
        </div>
      </div>
      <section className="panel clients-panel">
        <div className="clients-tabs" aria-label="Статус клиента">
          {tabs.map((t) => (
            <button
              key={t.id}
              aria-pressed={filter === t.id}
              className={filter === t.id ? 'selected' : ''}
              onClick={() => setFilter(t.id)}
            >
              {t.title}
              <span>
                {t.id === 'all' ? members.length : members.filter((m) => m.status === t.id).length}
              </span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Поиск клиентов"
              placeholder="Поиск по имени, телефону или email"
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
        </div>
        {filtersOpen && (
          <div className="extra-filters">
            <label htmlFor="plan-filter">Абонемент</label>
            <select id="plan-filter" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="all">Все абонементы</option>
              <option>Безлимит</option>
              <option>Дневной</option>
              <option>12 занятий</option>
            </select>
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
                    <th>Абонемент</th>
                    <th>Статус</th>
                    <th>Действует до</th>
                    <th>Посещения</th>
                    <th>
                      <span className="sr-only">Открыть</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <button className="member-name-button" onClick={() => onMember(m)}>
                          <Avatar member={m} />
                          <span>
                            <strong>{m.name}</strong>
                            <small>{m.email}</small>
                          </span>
                        </button>
                      </td>
                      <td>{m.plan}</td>
                      <td>
                        <Badge status={m.status} />
                      </td>
                      <td>{m.expires}</td>
                      <td>{m.visits}</td>
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
            </div>
            <div className="mobile-member-list">
              {filtered.map((m) => (
                <button className="mobile-member" key={m.id} onClick={() => onMember(m)}>
                  <Avatar member={m} />
                  <span>
                    <strong>{m.name}</strong>
                    <small>
                      {m.plan} · до {m.expires}
                    </small>
                  </span>
                  <Badge status={m.status} />
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
        <span>Это начало вашей клиентской базы.</span>
        <button onClick={onAdd}>
          Добавить ещё одного клиента <ArrowUpRight size={14} />
        </button>
      </div>
    </>
  );
}
