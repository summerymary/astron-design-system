import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { adminSections } from '../data/admin';
import type { AdminSectionId } from '../data/admin';
import type { UserRole } from '../types';
import { canOpenModule, isManagementRole } from '../lib/staff-rules';
import { LinkCards } from '../components/WorkspaceUI';
import '../styles/sections.css';

const groups: { title: string; ids: AdminSectionId[] }[] = [
  {
    title: 'Работа с клиентами',
    ids: ['members', 'registration', 'schedule', 'trainer-clients', 'memberships'],
  },
  { title: 'Продажи и финансы', ids: ['services', 'products', 'cash', 'statistics', 'inventory'] },
  {
    title: 'Общение и CRM',
    ids: [
      'messages',
      'calls',
      'notifications',
      'crm',
      'leads',
      'requests',
      'segments',
      'pipelines',
      'retention',
      'external-messages',
      'reviews',
    ],
  },
  { title: 'Команда', ids: ['employees', 'positions', 'absences', 'payroll'] },
  {
    title: 'Клубы и занятия',
    ids: [
      'clubs',
      'rooms',
      'receptions',
      'training-templates',
      'training-groups',
      'schedule-calendar',
      'directories',
    ],
  },
  {
    title: 'Бар',
    ids: ['bar', 'bar-catalog', 'bar-sales', 'bar-inventory', 'bar-categories', 'bar-collections'],
  },
  {
    title: 'Настройки и контроль',
    ids: ['settings', 'service-settings', 'rbac', 'security', 'event-logs', 'cameras'],
  },
];

const normalize = (value: string) => value.toLocaleLowerCase('ru').replaceAll('ё', 'е');

export function SectionsPage({
  role,
  navigate,
}: {
  role: UserRole;
  navigate: (id: AdminSectionId) => void;
}) {
  const [query, setQuery] = useState('');
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const visible = groups
    .map((group) => ({
      ...group,
      ids: group.ids.filter((id) => {
        if (!canOpenModule(role, id)) return false;
        if (isManagementRole(role) && group.title === 'Бар') return false;
        if (role === 'administrator' && id === 'statistics') return false;
        const section = adminSections.find((section) => section.id === id)!;
        const text = normalize(`${section.label} ${section.caption} ${group.title}`);
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((group) => group.ids.length);
  const count = visible.reduce((total, group) => total + group.ids.length, 0);

  return (
    <div className="sections-page">
      <div className="sections-search-bar">
        <div className="sections-search" role="search">
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            aria-label="Поиск раздела"
            placeholder="Название раздела или задача"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Очистить поиск разделов"
              onClick={() => setQuery('')}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <span className="sections-count" role="status">
          {query.trim() ? 'Найдено' : 'Доступно'}: {count}
        </span>
      </div>
      {visible.length ? (
        visible.map((group) => (
          <section className="sections-group" key={group.title} aria-label={group.title}>
            <h2>{group.title}</h2>
            <LinkCards ids={group.ids} navigate={navigate} />
          </section>
        ))
      ) : (
        <div className="empty-state">
          <Search size={28} aria-hidden="true" />
          <h2>Ничего не найдено</h2>
          <p>Попробуйте другое название или задачу, например «смена» или «клиенты».</p>
          <button className="button button-secondary" onClick={() => setQuery('')}>
            Сбросить поиск
          </button>
        </div>
      )}
    </div>
  );
}
