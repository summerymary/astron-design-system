import {
  CalendarDays,
  ChartNoAxesCombined,
  CupSoda,
  LayoutGrid,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Users,
  Wallet,
  BriefcaseBusiness,
  Dumbbell,
  GitBranch,
  Library,
  ShoppingBag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AdminSectionId } from '../data/admin';
import type { ClubBrand } from '../data/branding';
import type { Page, UserRole } from '../types';
import { isManagementRole } from '../lib/staff-rules';
import { ClubLogo } from './ClubLogo';

type Destination = { id: AdminSectionId; label: string; icon: LucideIcon };
const destinations: Record<string, Destination> = {
  schedule: { id: 'schedule', label: 'Расписание', icon: CalendarDays },
  messages: { id: 'messages', label: 'Сообщения', icon: MessageSquare },
  cash: { id: 'cash', label: 'Финансы', icon: Wallet },
  employees: { id: 'employees', label: 'Команда', icon: BriefcaseBusiness },
  directories: { id: 'directories', label: 'Справочники', icon: Library },
  settings: { id: 'settings', label: 'Настройки', icon: Settings2 },
  statistics: { id: 'statistics', label: 'Отчёты', icon: ChartNoAxesCombined },
  crm: { id: 'crm', label: 'CRM', icon: GitBranch },
  'trainer-clients': { id: 'trainer-clients', label: 'Мои клиенты', icon: Dumbbell },
  bar: { id: 'bar', label: 'Бар', icon: CupSoda },
  'bar-catalog': { id: 'bar-catalog', label: 'Каталог бара', icon: CupSoda },
  'bar-sales': { id: 'bar-sales', label: 'Продажи', icon: ShoppingBag },
  payroll: { id: 'payroll', label: 'Расчёт зарплаты', icon: BriefcaseBusiness },
};

export function MinimalNavigation({
  role,
  name,
  roleLabel,
  brand,
  clubName,
  canViewMembers,
  page,
  section,
  collapsed,
  onToggle,
  onPage,
  onSection,
  onAllSections,
  onClub,
}: {
  role: UserRole;
  name: string;
  roleLabel: string;
  brand: ClubBrand;
  clubName: string;
  canViewMembers: boolean;
  page: Page;
  section: AdminSectionId;
  collapsed: boolean;
  onToggle: () => void;
  onPage: (page: Page) => void;
  onSection: (id: AdminSectionId) => void;
  onAllSections: () => void;
  onClub: () => void;
}) {
  const settingsId: AdminSectionId =
    role === 'administrator' || isManagementRole(role) ? 'service-settings' : 'settings';
  const ids = isManagementRole(role)
    ? ['schedule', 'cash', 'statistics', 'employees']
    : role === 'administrator'
      ? ['messages', 'bar', 'employees', 'directories']
      : role === 'trainer'
        ? ['schedule', 'trainer-clients']
        : role === 'bartender'
          ? ['bar-catalog', 'bar-sales']
          : role === 'accountant'
            ? ['cash', 'statistics', 'payroll']
            : ['crm', 'messages', 'statistics'];
  const button = (
    label: string,
    Icon: LucideIcon,
    active: boolean,
    action: () => void,
    shortLabel = label,
  ) => (
    <button
      key={label}
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      onClick={action}
    >
      <Icon size={19} strokeWidth={1.6} />
      <span>{shortLabel}</span>
    </button>
  );
  return (
    <aside
      className={`minimal-navigation ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Навигация Минимал"
    >
      <button
        className="minimal-brand"
        onClick={() => onPage('overview')}
        aria-label="Астрон · главная"
      >
        <ClubLogo
          brand={
            brand.name === 'Астрон'
              ? { ...brand, logoSrc: './brand/astron-black.svg', fallbackColor: '#1D1D1F' }
              : brand
          }
          variant={collapsed ? 'compact' : 'wide'}
        />
      </button>
      {role !== 'administrator' && (
        <button
          className="minimal-club"
          onClick={onClub}
          title={clubName}
          aria-label={`Выбрать клуб: ${clubName}`}
        >
          <span>{clubName}</span>
          <span aria-hidden="true">⌄</span>
        </button>
      )}
      <nav aria-label="Разделы Минимал">
        {button('Главная', LayoutGrid, page === 'overview', () => onPage('overview'))}
        {role === 'marketer' &&
          button('CRM', GitBranch, page === 'admin-section' && section === 'crm', () =>
            onSection('crm'),
          )}
        {canViewMembers &&
          role !== 'administrator' &&
          button('Клиенты', Users, page === 'members' || page === 'client-profile', () =>
            onPage('members'),
          )}
        {ids
          .filter((id) => role !== 'marketer' || id !== 'crm')
          .map((id) => {
            const item = destinations[id];
            return button(
              item.label,
              item.icon,
              page === 'admin-section' && section === item.id,
              () => onSection(item.id),
            );
          })}
        {button('Все разделы', LayoutGrid, page === 'sections', onAllSections)}
      </nav>
      <div className="minimal-navigation-bottom">
        {button('Настройки', Settings2, page === 'admin-section' && section === settingsId, () =>
          onSection(settingsId),
        )}
        <div className="minimal-person" title={`${name} · ${roleLabel}`}>
          <span>
            {name
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')}
          </span>
          <div>
            <strong>{name.split(' ')[0]}</strong>
            <small>{roleLabel}</small>
          </div>
        </div>
        {button(
          collapsed ? 'Развернуть меню' : 'Свернуть меню',
          collapsed ? PanelLeftOpen : PanelLeftClose,
          false,
          onToggle,
          'Меню',
        )}
      </div>
    </aside>
  );
}
