import { Select } from './components/Select';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  LayoutDashboard,
  Monitor,
  Plus,
  RotateCcw,
  Smartphone,
  Users,
  X,
  Menu,
  CreditCard,
  MessageSquare,
  Phone,
  Settings2,
  CupSoda,
  Library,
  BriefcaseBusiness,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  DoorOpen,
  Package,
  ShieldCheck,
  Camera as CameraIcon,
  ClipboardList,
  ChartNoAxesCombined,
  Tags,
  GitBranch,
  CalendarX2,
  BadgeDollarSign,
  Globe,
} from 'lucide-react';
import { Button, Modal, StateContent, Toast } from './components/ui';
import { AdminHeader } from './components/AdminHeader';
import { ClubLogo } from './components/ClubLogo';
import { adminSections, initialVisits, memberCards, workstations } from './data/admin';
import type { AdminSectionId } from './data/admin';
import { classes, initialMembers, pages, scenarios } from './data/mock';
import { demoClubs, demoNetworks, demoUsers, roleHomes, roles } from './data/roles';
import { initialProfileBookings } from './data/profileBookings';
import { useTheme } from './components/ThemeProvider';
import { useWorkspace } from './components/WorkspaceProvider';
import { SectionsPage } from './pages/SectionsPage';
import { Members } from './pages/Members';
import { AdminOverview } from './pages/AdminOverview';
import { AdminSection } from './pages/AdminSection';
import { ClientProfile } from './pages/ClientProfile';
import { RoleOverview } from './pages/RoleOverview';
import { AccountingHome } from './pages/AccountingHome';
import { BartenderHome, TrainerHome } from './pages/StaffWorkspace';
import { canOpenModule, isManagementRole } from './lib/staff-rules';
import { managementNavigationGroups } from './data/management-navigation';
import { membershipKinds } from './data/membership-kinds';
import { AdminPageLayout } from './components/AdminPageLayout';
import { ScreenLock, screenIsLocked, rememberScreenLock } from './components/ScreenLock';
import type { Device, Member, Page, Scenario, UserRole, Visit, VisitKind } from './types';

const navigation = [
  { id: 'overview' as const, label: 'Ресепшен', icon: LayoutDashboard },
  { id: 'members' as const, label: 'Клиенты', icon: Users },
];
const workNavigation = [
  { id: 'memberships', label: 'Абонементы', icon: CreditCard },
  { id: 'calls', label: 'Звонки', icon: Phone },
  { id: 'messages', label: 'Сообщения', icon: MessageSquare },
  { id: 'bar', label: 'Бар', icon: CupSoda },
] as const;
const managementNavigation = [
  { id: 'employees', label: 'Персонал', icon: BriefcaseBusiness },
  { id: 'directories', label: 'Справочники', icon: Library },
  { id: 'service-settings', label: 'Настройки', icon: Settings2 },
] as const;
const managementIcons = {
  schedule: CalendarDays,
  memberships: CreditCard,
  registration: Check,
  services: CreditCard,
  products: Package,
  cash: CreditCard,
  inventory: Package,
  crm: Users,
  leads: Users,
  requests: Globe,
  segments: Tags,
  pipelines: GitBranch,
  retention: Users,
  'trainer-clients': Dumbbell,
  messages: MessageSquare,
  'external-messages': Globe,
  calls: Phone,
  reviews: MessageSquare,
  notifications: Bell,
  employees: BriefcaseBusiness,
  positions: BriefcaseBusiness,
  absences: CalendarX2,
  payroll: BadgeDollarSign,
  directories: Library,
  clubs: Building2,
  rooms: DoorOpen,
  receptions: Monitor,
  'training-templates': ClipboardList,
  'training-groups': Dumbbell,
  'schedule-calendar': CalendarDays,
  statistics: ChartNoAxesCombined,
  cameras: CameraIcon,
  rbac: Users,
  security: ShieldCheck,
  'event-logs': ClipboardList,
  'service-settings': Settings2,
  settings: Settings2,
};

function initialOptions() {
  const [path, query] = window.location.hash.replace('#/', '').split('?');
  const params = new URLSearchParams(query);
  const role = roles.find((r) => r.id === params.get('role')) ?? roles[0];
  const section = adminSections.find((s) => s.id === params.get('section'))?.id || 'schedule';
  return {
    page:
      path === 'admin-section' &&
      canOpenModule(role.id, section) &&
      (!params.get('section') || adminSections.some((s) => s.id === params.get('section')))
        ? ('admin-section' as Page)
        : path === 'client-profile' && role.canViewMembers
          ? ('client-profile' as Page)
          : pages.some((p) => p.id === path) && (path !== 'members' || role.canViewMembers)
            ? (path as Page)
            : ('overview' as Page),
    role: role.id,
    clientId: Number(params.get('clientId')) || null,
    section,
    device: params.get('device') === 'mobile' ? ('mobile' as Device) : ('desktop' as Device),
    scenario: scenarios.some((s) => s.id === params.get('state'))
      ? (params.get('state') as Scenario)
      : ('default' as Scenario),
  };
}

export function App() {
  const { palette } = useTheme();
  const workspace = useWorkspace();
  const guideHref = `./design-system.html?theme=${palette.primary.slice(1)}`;
  const [options] = useState(initialOptions);
  const [page, setPage] = useState<Page>(options.page);
  const [device, setDevice] = useState<Device>(options.device);
  const [scenario, setScenario] = useState<Scenario>(options.scenario);
  const [role, setRole] = useState<UserRole>(options.role);
  const [screenLocked, setScreenLocked] = useState(screenIsLocked);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [resetVersion, setResetVersion] = useState(0);
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [workstationId, setWorkstationId] = useState('central-01');
  const [adminSection, setAdminSection] = useState<AdminSectionId>(options.section);
  const [sectionMember, setSectionMember] = useState<Member | null>(null);
  const [modal, setModal] = useState<'add' | 'reset' | 'club' | null>(null);
  const [workingClubs, setWorkingClubs] = useState<Partial<Record<UserRole, string>>>({});
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(options.clientId);
  const [memberReturnPage, setMemberReturnPage] = useState<Page>('overview');
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileStateOpen, setMobileStateOpen] = useState(false);
  const [mobileQuickOpen, setMobileQuickOpen] = useState(false);
  useEffect(() => setMobileQuickOpen(false), [page, role, adminSection, device]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(options.role === 'administrator');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const pageBodyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    pageBodyRef.current?.scrollTo(0, 0);
  }, [page, adminSection, selectedMemberId]);
  const sidebarNavigationRef = useRef<HTMLDivElement>(null);
  const expandedManagementGroupsRef = useRef<Set<string> | null>(null);
  const sectionHistory = useRef<
    { page: Page; section: AdminSectionId; clientId: number | null; member: Member | null }[]
  >([]);
  const currentRole = roles.find((r) => r.id === role)!;
  const managingRole = isManagementRole(role);
  const currentUser = demoUsers.find((u) => u.role === role)!;
  const roleHome = roleHomes[role];
  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const currentPage =
    page === 'client-profile'
      ? { title: selectedMember?.name ?? 'Карточка клиента', caption: 'Сведения о клиенте' }
      : page === 'admin-section'
        ? {
            title: adminSections.find((s) => s.id === adminSection)!.label,
            caption: adminSections.find((s) => s.id === adminSection)!.caption,
          }
        : page === 'overview'
          ? { title: roleHome.title, caption: roleHome.caption }
          : pages.find((p) => p.id === page)!;
  const userInitials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
  const workstation = workstations.find((w) => w.id === workstationId)!;
  const availableClubs = demoClubs.filter(
    (club) => club.networkId === currentUser.networkId && currentUser.clubIds.includes(club.id),
  );
  const workingClub =
    availableClubs.find((club) => club.id === workingClubs[role]) || availableClubs[0];
  const club =
    role === 'administrator'
      ? demoClubs.find((club) => club.id === workstation.clubId)!
      : workingClub;
  const network = demoNetworks.find((n) => n.id === currentUser.networkId)!;
  const visibleNavigation = navigation
    .filter((n) => n.id !== 'members' || currentRole.canViewMembers)
    .map((n) =>
      n.id === 'overview'
        ? {
            ...n,
            label: role === 'administrator' ? n.label : 'Моя главная',
          }
        : n,
    );
  const notify = useCallback((message: string) => {
    setToast(message);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setToast(''), 3400);
  }, []);
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );
  useEffect(() => {
    if (!managingRole) {
      expandedManagementGroupsRef.current = null;
      return;
    }
    const menu = sidebarNavigationRef.current;
    if (!menu) return;
    const groups = Array.from(menu.querySelectorAll<HTMLDetailsElement>('.management-nav-group'));
    if (sidebarCollapsed) {
      if (expandedManagementGroupsRef.current === null)
        expandedManagementGroupsRef.current = new Set(
          groups.filter((group) => group.open).map((group) => group.dataset.navGroup || ''),
        );
      groups.forEach((group) => {
        group.open = true;
      });
    } else if (expandedManagementGroupsRef.current !== null) {
      groups.forEach((group) => {
        group.open = expandedManagementGroupsRef.current!.has(group.dataset.navGroup || '');
      });
      expandedManagementGroupsRef.current = null;
    }
    const active = menu?.querySelector<HTMLElement>('button[aria-current="page"]');
    if (!menu || !active) return;
    const activeGroup = active.closest('details');
    if (activeGroup) activeGroup.open = true;
    const bounds = menu.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.top < bounds.top + 8) menu.scrollTop += item.top - bounds.top - 8;
    else if (item.bottom > bounds.bottom - 8) menu.scrollTop += item.bottom - bounds.bottom + 8;
  }, [managingRole, role, page, adminSection, sidebarCollapsed]);
  useEffect(() => {
    window.history.replaceState(
      null,
      '',
      `#/${page}?device=${device}&state=${scenario}&role=${role}${page === 'admin-section' ? `&section=${adminSection}` : ''}${page === 'client-profile' && selectedMemberId ? `&clientId=${selectedMemberId}` : ''}`,
    );
    document.title = `${currentPage.title} · Астрон`;
  }, [page, device, scenario, role, adminSection, selectedMemberId, currentPage.title]);
  useEffect(() => {
    const onHashChange = () => {
      sectionHistory.current = [];
      const next = initialOptions();
      setRole(next.role);
      setSidebarCollapsed(next.role === 'administrator');
      setPage(next.page);
      setDevice(next.device);
      setScenario(next.scenario);
      setAdminSection(next.section);
      setSectionMember(null);
      setNotificationOpen(false);
      setSelectedMemberId(next.clientId);
      setMemberReturnPage('overview');
      setSelectedClass(null);
      setModal(null);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const goTo = (next: Page) => {
    setPage(
      (next === 'members' || next === 'client-profile') && !currentRole.canViewMembers
        ? 'overview'
        : next,
    );
    setNotificationOpen(false);
    contentRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  };
  const changeRole = (next: UserRole) => {
    sectionHistory.current = [];
    setRole(next);
    setSidebarCollapsed(next === 'administrator');
    setPage('overview');
    setScenario('default');
    setNotificationOpen(false);
    setSelectedMemberId(null);
    setSelectedClass(null);
    setModal(null);
    setToast('');
    setSectionMember(null);
    contentRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  };
  const closeModal = useCallback(() => setModal(null), []);
  const closeClass = useCallback(() => setSelectedClass(null), []);
  const openMember = (member: Member) => {
    if (!currentRole.canViewMembers) return;
    if (page !== 'client-profile') setMemberReturnPage(page);
    setSelectedMemberId(member.id);
    setScenario('default');
    goTo('client-profile');
  };
  const openSections = () => {
    setMobileQuickOpen(false);
    setScenario('default');
    goTo('sections');
  };
  const openRegistration = (member?: Member) => openModule('registration', member);
  const openModule = (section: AdminSectionId, member?: Member) => {
    if (!canOpenModule(role, section)) return;
    if (section === 'members') {
      goTo('members');
      return;
    }
    if (page !== 'admin-section' || adminSection !== section)
      sectionHistory.current.push({
        page,
        section: adminSection,
        clientId: selectedMemberId,
        member: sectionMember,
      });
    setAdminSection(section);
    setSectionMember(member || null);
    setScenario('default');
    goTo('admin-section');
  };
  const openAdminAction = (section: AdminSectionId, member?: Member) => {
    if (!canOpenModule(role, section)) return;
    if (section === 'registration') {
      openRegistration(member);
      return;
    }
    setSelectedMemberId(null);
    if (section === 'members') {
      goTo('members');
      return;
    }
    if (page !== 'admin-section' || adminSection !== section)
      sectionHistory.current.push({
        page,
        section: adminSection,
        clientId: selectedMemberId,
        member: sectionMember,
      });
    setAdminSection(section);
    setSectionMember(member ?? null);
    setScenario('default');
    goTo('admin-section');
  };
  const backFromSection = () => {
    const previous = sectionHistory.current.pop();
    if (previous) {
      setAdminSection(previous.section);
      setSelectedMemberId(previous.clientId);
      setSectionMember(previous.member);
      goTo(previous.page);
    } else goTo('overview');
  };
  const createVisit = (member: Member, kind: VisitKind, passName?: string, passId?: string) => {
    if (!canOpenModule(role, 'registration')) return;
    const time = new Date(Date.UTC(2026, 10, 6, 14, 35 + visits.length - initialVisits.length))
      .toISOString()
      .slice(0, 16);
    const visit: Visit = {
      id: `demo-${Date.now()}`,
      memberId: member.id,
      card: memberCards[member.id] ?? String(member.id + 99000),
      enteredAt: time,
      kind,
      plan: passName || member.plan,
      passId,
      clubId: club.id,
    };
    setVisits((prev) => [visit, ...prev]);
    workspace.put('logs', {
      id: `log-${visit.id}`,
      name: 'Регистрация посещения',
      memberId: String(member.id),
      date: time,
      user: currentUser.name,
      service: 'Посещения',
      type: 'Действия',
      request: 'DEMO',
      status: 'Выполнено',
      description: 'Посещение зарегистрировано после явного подтверждения.',
    });
    setMembers((prev) =>
      prev.map((m) =>
        m.id === member.id
          ? { ...m, visits: m.visits + 1, initialPassVisits: m.initialPassVisits ?? m.visits }
          : m,
      ),
    );
    notify(`Посещение зарегистрировано · ${member.name}`);
  };
  const addMember = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentRole.canAddMembers) return;
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name')).trim();
    if (!name) return;
    const newMember: Member = {
      id: Math.max(1000, ...members.map((m) => m.id)) + 1,
      name,
      email: String(data.get('email')).trim(),
      phone: String(data.get('phone')).trim() || 'Не указан',
      plan: String(data.get('plan')),
      status: 'active',
      joined: '01.11.2026',
      expires: '01.12.2026',
      visits: 0,
      color: 'sage',
    };
    setMembers((prev) => [newMember, ...prev]);
    setModal(null);
    setScenario('default');
    setPage('members');
    notify(`${name} — клиент добавлен`);
  };
  const reset = () => {
    sectionHistory.current = [];
    workspace.reset();
    setResetVersion((value) => value + 1);
    setMembers(initialMembers);
    setVisits(initialVisits);
    setScenario('default');
    setModal(null);
    notify('Демоданные восстановлены');
  };

  return (
    <div
      className={`prototype-content${device === 'desktop' ? ' fits-workspace' : ''}${page === 'overview' && device === 'desktop' ? ' fits-home' : ''}`}
      inert={screenLocked}
      aria-hidden={screenLocked || undefined}
    >
      <header className="workspace-toolbar">
        <a
          href="#/overview"
          className="workspace-brand"
          onClick={(e) => {
            e.preventDefault();
            goTo('overview');
          }}
        >
          <span className="workspace-icon">
            <LayoutDashboard size={16} />
          </span>
          <span>
            Макет системы<small>Астрон · прототип приложения</small>
          </span>
          <span className="workspace-version">v0.1</span>
        </a>
        <div className="device-switch" aria-label="Версия приложения">
          <button
            aria-label="Десктоп"
            aria-pressed={device === 'desktop'}
            className={device === 'desktop' ? 'selected' : ''}
            onClick={() => setDevice('desktop')}
          >
            <Monitor size={16} />
            <span>Десктоп</span>
          </button>
          <button
            aria-label="Телефон"
            aria-pressed={device === 'mobile'}
            className={device === 'mobile' ? 'selected' : ''}
            onClick={() => setDevice('mobile')}
          >
            <Smartphone size={16} />
            <span>Телефон</span>
          </button>
        </div>
        <div className="workspace-actions">
          <a
            className="workspace-guide-link"
            href={guideHref}
            target="_blank"
            rel="noopener"
            aria-label="Открыть дизайн-систему в отдельной вкладке"
          >
            <BookOpen size={16} />
            <span>Дизайн-система</span>
            <ArrowUpRight size={13} />
          </a>
          <label className="role-select role-select-desktop">
            <span>Роль</span>
            <Select
              aria-label="Роль в прототипе"
              value={role}
              onChange={(e) => changeRole(e.target.value as UserRole)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="scenario-select">
            <span className="scenario-label">Состояние</span>
            <span className={`scenario-dot scenario-${scenario}`} />
            <Select
              aria-label="Состояние экрана"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as Scenario)}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>
          <button
            className="icon-button reset-button"
            title="Сбросить демоданные"
            aria-label="Сбросить демоданные"
            onClick={() => setModal('reset')}
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="icon-button mobile-state-button"
            aria-label="Выбрать состояние"
            aria-expanded={mobileStateOpen}
            onClick={() => setMobileStateOpen(!mobileStateOpen)}
          >
            <SlidersIcon />
          </button>
        </div>
      </header>
      <div className="workspace-role-mobile">
        <label className="role-select">
          <span>Смотреть как</span>
          <Select
            aria-label="Роль в прототипе на телефоне"
            value={role}
            onChange={(e) => changeRole(e.target.value as UserRole)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </label>
        <span>Демопользователь</span>
      </div>
      {mobileStateOpen && (
        <div className="mobile-state-menu">
          <label>
            Состояние экрана
            <Select
              aria-label="Состояние на телефоне"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as Scenario)}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="ghost"
            onClick={() => {
              setModal('reset');
              setMobileStateOpen(false);
            }}
          >
            <RotateCcw size={14} />
            Сбросить данные
          </Button>
          <button
            className="icon-button"
            aria-label="Закрыть выбор состояния"
            onClick={() => setMobileStateOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className={`preview-stage stage-${device}`}>
        {device === 'mobile' && (
          <div className="device-caption">
            <Smartphone size={13} />
            Мобильная версия<span>390 × 844</span>
          </div>
        )}
        <div className={`app-shell is-${device}${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
          <aside
            className={`sidebar ${managingRole ? 'has-management-menu' : ''}`}
            aria-label="Боковое меню"
          >
            <div className="sidebar-head">
              <a
                className="brand"
                title={sidebarCollapsed ? club.name : undefined}
                href="#/overview"
                onClick={(e) => {
                  e.preventDefault();
                  goTo('overview');
                }}
              >
                <ClubLogo brand={club.brand} variant={sidebarCollapsed ? 'compact' : 'wide'} />
              </a>
            </div>
            {role !== 'administrator' && (
              <button
                type="button"
                className="club-switch club-context-button"
                onClick={() => setModal('club')}
                aria-label={`Выбрать клуб: ${club.name}`}
                aria-haspopup="dialog"
                title={`Рабочий клуб: ${club.name}`}
              >
                <ClubLogo brand={club.brand} variant="compact" decorative />
                <span>
                  <strong>{club.name}</strong>
                  <small>{club.city}</small>
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            )}
            <div
              id="workspace-navigation"
              className="sidebar-navigation"
              ref={sidebarNavigationRef}
            >
              {role !== 'administrator' && (
                <span className="nav-label">
                  {currentRole.scope === 'network' ? 'УПРАВЛЕНИЕ СЕТЬЮ' : 'ВАШ КЛУБ'}
                </span>
              )}
              <nav className="side-nav" aria-label="Основная навигация">
                {visibleNavigation
                  .filter((n) => role !== 'administrator' || n.id !== 'members')
                  .map((n) => (
                    <button
                      key={n.id}
                      title={sidebarCollapsed ? n.label : undefined}
                      aria-label={sidebarCollapsed ? n.label : undefined}
                      aria-current={
                        page === n.id || (n.id === 'members' && page === 'client-profile')
                          ? 'page'
                          : undefined
                      }
                      className={
                        page === n.id || (n.id === 'members' && page === 'client-profile')
                          ? 'active'
                          : ''
                      }
                      onClick={() => goTo(n.id)}
                    >
                      <n.icon size={18} strokeWidth={1.75} />
                      <span className="nav-item-label">{n.label}</span>
                      {n.id === 'members' && <span className="nav-count">{members.length}</span>}
                    </button>
                  ))}
                {role === 'marketer' && (
                  <button
                    onClick={() => openModule('crm')}
                    className={page === 'admin-section' && adminSection === 'crm' ? 'active' : ''}
                    aria-current={
                      page === 'admin-section' && adminSection === 'crm' ? 'page' : undefined
                    }
                    title={sidebarCollapsed ? 'CRM' : undefined}
                    aria-label={sidebarCollapsed ? 'CRM' : undefined}
                  >
                    <Users size={18} />
                    <span className="nav-item-label">CRM</span>
                  </button>
                )}
              </nav>
              {managingRole && (
                <nav className="side-nav management-module-nav" aria-label="Разделы управления">
                  <button
                    className={`management-statistics-link ${page === 'admin-section' && adminSection === 'statistics' ? 'active' : ''}`}
                    title={sidebarCollapsed ? 'Статистика' : undefined}
                    aria-label={sidebarCollapsed ? 'Статистика' : undefined}
                    aria-current={
                      page === 'admin-section' && adminSection === 'statistics' ? 'page' : undefined
                    }
                    onClick={() => openModule('statistics')}
                  >
                    <ChartNoAxesCombined size={18} strokeWidth={1.75} />
                    <span className="nav-item-label">Статистика</span>
                  </button>
                  {managementNavigationGroups.map((group) => (
                    <details
                      className="management-nav-group nav-accordion"
                      data-nav-group={group.label}
                      key={group.label}
                    >
                      <summary className="nav-label ws-nav-separator">{group.label}</summary>
                      {group.items.map((id) => {
                        const section = adminSections.find((section) => section.id === id)!;
                        const label = section.label;
                        const Icon =
                          managementIcons[id as keyof typeof managementIcons] || BookOpen;
                        return (
                          <button
                            key={id}
                            title={sidebarCollapsed ? label : undefined}
                            aria-label={sidebarCollapsed ? label : undefined}
                            aria-current={
                              page === 'admin-section' && adminSection === id ? 'page' : undefined
                            }
                            className={
                              page === 'admin-section' && adminSection === id ? 'active' : ''
                            }
                            onClick={() => openModule(id)}
                          >
                            <Icon size={18} strokeWidth={1.75} />
                            <span className="nav-item-label">{label}</span>
                          </button>
                        );
                      })}
                    </details>
                  ))}
                  <button
                    onClick={openSections}
                    aria-current={page === 'sections' ? 'page' : undefined}
                    className={page === 'sections' ? 'active' : ''}
                    title={sidebarCollapsed ? 'Каталог разделов' : undefined}
                    aria-label={sidebarCollapsed ? 'Каталог разделов' : undefined}
                  >
                    <Menu size={18} />
                    <span className="nav-item-label">Каталог разделов</span>
                  </button>
                </nav>
              )}
              {role === 'administrator' && (
                <nav className="side-nav ws-module-nav" aria-label="Рабочие разделы">
                  {workNavigation.map((n) => (
                    <button
                      key={n.id}
                      title={sidebarCollapsed ? n.label : undefined}
                      aria-label={sidebarCollapsed ? n.label : undefined}
                      aria-current={
                        page === 'admin-section' && adminSection === n.id ? 'page' : undefined
                      }
                      className={page === 'admin-section' && adminSection === n.id ? 'active' : ''}
                      onClick={() => openModule(n.id)}
                    >
                      <n.icon size={18} strokeWidth={1.75} />
                      <span className="nav-item-label">{n.label}</span>
                    </button>
                  ))}
                  <span className="nav-label ws-nav-separator">УПРАВЛЕНИЕ</span>
                  {managementNavigation.map((n) => (
                    <button
                      key={n.id}
                      title={sidebarCollapsed ? n.label : undefined}
                      aria-label={sidebarCollapsed ? n.label : undefined}
                      aria-current={
                        page === 'admin-section' && adminSection === n.id ? 'page' : undefined
                      }
                      className={page === 'admin-section' && adminSection === n.id ? 'active' : ''}
                      onClick={() => openModule(n.id)}
                    >
                      <n.icon size={18} strokeWidth={1.75} />
                      <span className="nav-item-label">{n.label}</span>
                    </button>
                  ))}
                  <button
                    onClick={openSections}
                    aria-current={page === 'sections' ? 'page' : undefined}
                    className={page === 'sections' ? 'active' : ''}
                    title={sidebarCollapsed ? 'Все разделы' : undefined}
                    aria-label={sidebarCollapsed ? 'Все разделы' : undefined}
                  >
                    <Menu size={18} />
                    <span className="nav-item-label">Все разделы</span>
                  </button>
                </nav>
              )}
              {(role === 'trainer' ||
                role === 'bartender' ||
                role === 'accountant' ||
                role === 'marketer') && (
                <nav className="side-nav ws-module-nav" aria-label="Рабочие разделы">
                  {(role === 'accountant'
                    ? [
                        { id: 'cash' as const, label: 'Касса', icon: CreditCard },
                        { id: 'statistics' as const, label: 'Отчёты', icon: ChartNoAxesCombined },
                        { id: 'services' as const, label: 'Продажи', icon: CreditCard },
                        { id: 'payroll' as const, label: 'Расчёт зарплаты', icon: BadgeDollarSign },
                        { id: 'inventory' as const, label: 'Склад ресепшена', icon: Package },
                      ]
                    : role === 'marketer'
                      ? [
                          { id: 'leads' as const, label: 'Заявки', icon: Users },
                          { id: 'pipelines' as const, label: 'Сценарии заявок', icon: GitBranch },
                          { id: 'segments' as const, label: 'Группы клиентов', icon: Tags },
                          { id: 'statistics' as const, label: 'Отчёты', icon: ChartNoAxesCombined },
                        ]
                      : role === 'trainer'
                        ? [
                            {
                              id: 'schedule' as const,
                              label: 'Моё расписание',
                              icon: CalendarDays,
                            },
                            { id: 'trainer-clients' as const, label: 'Мои клиенты', icon: Users },
                          ]
                        : [
                            { id: 'bar-catalog' as const, label: 'Каталог бара', icon: CupSoda },
                            { id: 'bar-sales' as const, label: 'Продажи бара', icon: CreditCard },
                          ]
                  ).map((n) => (
                    <button
                      key={n.id}
                      title={sidebarCollapsed ? n.label : undefined}
                      aria-label={sidebarCollapsed ? n.label : undefined}
                      className={page === 'admin-section' && adminSection === n.id ? 'active' : ''}
                      onClick={() => openModule(n.id)}
                    >
                      <n.icon size={18} />
                      <span className="nav-item-label">{n.label}</span>
                    </button>
                  ))}
                </nav>
              )}
            </div>
            <div className="sidebar-bottom">
              <div className="sandbox-card">
                <span>
                  <i />
                  Режим прототипа
                </span>
                <p>Демонстрационные данные хранятся в памяти приложения.</p>
              </div>
              <div
                className="user-block"
                title={sidebarCollapsed ? `${currentUser.name} · ${currentRole.label}` : undefined}
              >
                <span className="user-avatar">{userInitials}</span>
                <span>
                  <strong>{currentUser.name.split(' ')[0]}</strong>
                  <small>{currentRole.label}</small>
                </span>
                <span className="user-online" />
              </div>
              <button
                type="button"
                className="icon-button sidebar-toggle"
                aria-label={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
                title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
                aria-expanded={!sidebarCollapsed}
                aria-controls="workspace-navigation"
                onClick={() => setSidebarCollapsed((value) => !value)}
              >
                {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
                <span className="sidebar-toggle-label">Свернуть меню</span>
              </button>
            </div>
          </aside>
          <div className="app-workspace">
            <header className={`app-topbar ${role === 'administrator' ? 'admin-topbar' : ''}`}>
              {role === 'administrator' ? (
                <AdminHeader
                  workstationId={workstationId}
                  onWorkstation={(id) => {
                    setWorkstationId(id);
                  }}
                  members={members}
                  onMember={openMember}
                  onAction={(id) =>
                    openAdminAction(id, page === 'client-profile' ? selectedMember : undefined)
                  }
                  name={currentUser.name}
                  onLock={() => {
                    rememberScreenLock(true);
                    setScreenLocked(true);
                  }}
                />
              ) : (
                <>
                  <div className="breadcrumbs">
                    <span className="desktop-breadcrumb">
                      Рабочее пространство
                      <ChevronRight size={12} />
                    </span>
                    <span>{currentPage.title}</span>
                  </div>
                  <a
                    href="#/overview"
                    className="mobile-brand"
                    onClick={(e) => {
                      e.preventDefault();
                      goTo('overview');
                    }}
                  >
                    <ClubLogo brand={club.brand} />
                  </a>
                  <div className="topbar-right">
                    <span className="prototype-label">
                      <i />
                      Прототип
                    </span>
                    <div className="notification-anchor">
                      <button
                        className={`icon-button notification-button ${notificationOpen ? 'selected' : ''}`}
                        aria-label="Уведомления"
                        aria-expanded={notificationOpen}
                        onClick={() => setNotificationOpen(!notificationOpen)}
                      >
                        <Bell size={18} />
                        <i />
                      </button>
                      {notificationOpen && (
                        <>
                          <div
                            className="notification-dismiss"
                            onClick={() => setNotificationOpen(false)}
                          />
                          <div className="notification-popover">
                            <strong>Вы в курсе всего</strong>
                            <p>{roleHome.noteText}</p>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                goTo(currentRole.canViewMembers ? 'members' : 'overview')
                              }
                            >
                              {currentRole.canViewMembers ? 'Открыть клиентов' : 'На мою главную'}
                              <ArrowUpRight size={14} />
                            </Button>
                            <small>Демонстрационное уведомление</small>
                          </div>
                        </>
                      )}
                    </div>
                    <span
                      className="topbar-avatar"
                      title={`${currentUser.name} · ${currentRole.label}`}
                    >
                      {userInitials}
                    </span>
                  </div>
                </>
              )}
            </header>
            <main
              className={`app-content ${page === 'overview' ? 'home-content' : ''} ${page === 'admin-section' && adminSection === 'schedule' ? 'has-calendar' : ''}`}
              ref={contentRef}
              id="main-content"
              key={resetVersion}
            >
              <AdminPageLayout
                enabled={role === 'administrator'}
                mobileMode={device === 'mobile'}
                mobileOpen={mobileQuickOpen}
                onMobileOpenChange={setMobileQuickOpen}
                onAllSections={openSections}
                pageKey={`${page}-${adminSection}-${selectedMemberId}`}
                activeId={
                  page === 'client-profile' || page === 'members'
                    ? 'members'
                    : page === 'admin-section'
                      ? adminSection
                      : undefined
                }
                onAction={(id) =>
                  openAdminAction(id, page === 'client-profile' ? selectedMember : undefined)
                }
              >
                {page !== 'client-profile' && (
                  <div className="page-heading work-page-toolbar">
                    <div className="page-title-group">
                      {page === 'admin-section' && (
                        <button
                          className="page-back icon-button"
                          aria-label="Назад"
                          title="Назад"
                          onClick={backFromSection}
                        >
                          <ArrowLeft size={18} />
                        </button>
                      )}
                      <h1>{currentPage.title}</h1>
                      {page === 'members' && <span className="count-badge">{members.length}</span>}
                    </div>
                    <div className="page-actions">
                      {(page === 'overview' || page === 'members') && currentRole.canAddMembers && (
                        <Button
                          aria-label="Добавить клиента"
                          title="Добавить клиента"
                          onClick={() => setModal('add')}
                        >
                          <Plus size={16} />
                          <span>Добавить клиента</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                <div
                  className="workspace-page-body"
                  ref={pageBodyRef}
                  role="region"
                  aria-label="Рабочая область страницы"
                  tabIndex={0}
                >
                  {page === 'client-profile' ? (
                    selectedMember ? (
                      <ClientProfile
                        key={selectedMember.id}
                        member={selectedMember}
                        visits={visits.filter((v) => v.memberId === selectedMember.id)}
                        bookings={selectedMember.id === 1001 ? initialProfileBookings : []}
                        canOperate={role === 'administrator' || managingRole}
                        canSell={role === 'accountant'}
                        showQuickLinks={managingRole}
                        scenario={scenario}
                        onReset={() => setScenario('default')}
                        onBack={() => goTo(memberReturnPage)}
                        backLabel={
                          memberReturnPage === 'admin-section' &&
                          ['messages', 'external-messages'].includes(adminSection)
                            ? 'Вернуться в чат'
                            : 'Назад'
                        }
                        onRegistration={() => openRegistration(selectedMember)}
                        onAction={(id) => openAdminAction(id, selectedMember)}
                        onUpdate={(updated) =>
                          setMembers((previous) =>
                            previous.map((member) => (member.id === updated.id ? updated : member)),
                          )
                        }
                      />
                    ) : (
                      <div className="empty-state">
                        <h1>Клиент не найден</h1>
                        <p>Этой карты нет в демонстрационных данных.</p>
                        <Button onClick={() => goTo('members')}>К списку клиентов</Button>
                      </div>
                    )
                  ) : scenario !== 'default' ? (
                    <StateContent
                      scenario={scenario}
                      onAdd={() =>
                        page === 'admin-section' || page === 'sections'
                          ? setScenario('default')
                          : role === 'administrator' && page === 'overview'
                            ? openRegistration()
                            : currentRole.canAddMembers
                              ? setModal('add')
                              : setScenario('default')
                      }
                      onReset={() => setScenario('default')}
                      emptyState={
                        page === 'overview' && role === 'administrator'
                          ? {
                              title: 'Посещений пока нет',
                              description:
                                'Новые посещения появятся в журнале после регистрации клиента.',
                              actionLabel: 'Зарегистрировать посещение',
                            }
                          : page === 'overview' && role !== 'administrator'
                            ? {
                                title: roleHome.emptyTitle,
                                description: roleHome.emptyDescription,
                                actionLabel: currentRole.canAddMembers
                                  ? 'Добавить клиента'
                                  : 'Показать демоданные',
                              }
                            : page === 'sections'
                              ? {
                                  title: 'Разделы пока недоступны',
                                  description: 'Здесь будут разделы выбранной роли.',
                                  actionLabel: 'Показать разделы',
                                }
                              : page === 'admin-section'
                                ? {
                                    title: 'В этом разделе пока нет записей',
                                    description: 'Записи появятся после начала работы с разделом.',
                                    actionLabel: 'Показать демоданные',
                                  }
                                : undefined
                      }
                    />
                  ) : page === 'sections' ? (
                    <SectionsPage role={role} navigate={openModule} />
                  ) : page === 'admin-section' ? (
                    <AdminSection
                      key={`${adminSection}-${currentUser.id}-${club.id}`}
                      section={adminSection}
                      member={sectionMember}
                      members={members}
                      clubName={club.name}
                      employeeName={currentUser.name}
                      user={currentUser}
                      navigate={openModule}
                      onMember={openMember}
                      onRegister={createVisit}
                      onBack={backFromSection}
                    />
                  ) : page === 'overview' ? (
                    role === 'trainer' ? (
                      <TrainerHome
                        user={currentUser}
                        members={members}
                        clubName={club.name}
                        navigate={openModule}
                      />
                    ) : role === 'bartender' ? (
                      <BartenderHome clubName={club.name} navigate={openModule} />
                    ) : role === 'accountant' ? (
                      <AccountingHome navigate={openModule} clubName={club.name} />
                    ) : role !== 'administrator' ? (
                      <RoleOverview user={currentUser} />
                    ) : (
                      <AdminOverview
                        key={workstationId}
                        visits={visits}
                        members={members}
                        clubId={workstation.clubId}
                        onMember={openMember}
                        onAction={openAdminAction}
                      />
                    )
                  ) : (
                    <Members
                      key={members.length}
                      members={members}
                      onMember={openMember}
                      onAdd={() => setModal('add')}
                    />
                  )}
                </div>
              </AdminPageLayout>
            </main>
            <nav className="mobile-nav" aria-label="Мобильная навигация">
              {visibleNavigation.map((n) => (
                <button
                  key={n.id}
                  className={
                    page === n.id || (n.id === 'members' && page === 'client-profile')
                      ? 'active'
                      : ''
                  }
                  aria-current={
                    page === n.id || (n.id === 'members' && page === 'client-profile')
                      ? 'page'
                      : undefined
                  }
                  onClick={() => goTo(n.id)}
                >
                  <n.icon size={20} strokeWidth={1.75} />
                  <span>{n.id === 'overview' ? 'Главная' : n.label}</span>
                </button>
              ))}
              {(role === 'marketer' || role === 'accountant') && (
                <>
                  <button
                    className={
                      page === 'admin-section' &&
                      adminSection === (role === 'marketer' ? 'crm' : 'cash')
                        ? 'active'
                        : ''
                    }
                    onClick={() => openModule(role === 'marketer' ? 'crm' : 'cash')}
                  >
                    <Users size={20} />
                    <span>{role === 'marketer' ? 'CRM' : 'Касса'}</span>
                  </button>
                  <button
                    className={
                      page === 'admin-section' && adminSection === 'statistics' ? 'active' : ''
                    }
                    onClick={() => openModule('statistics')}
                  >
                    <ChartNoAxesCombined size={20} />
                    <span>Отчёты</span>
                  </button>
                </>
              )}
              {(role === 'trainer' || role === 'bartender') && (
                <>
                  <button
                    className={
                      page === 'admin-section' &&
                      adminSection === (role === 'trainer' ? 'schedule' : 'bar-catalog')
                        ? 'active'
                        : ''
                    }
                    onClick={() => openModule(role === 'trainer' ? 'schedule' : 'bar-catalog')}
                  >
                    {role === 'trainer' ? <CalendarDays size={20} /> : <CupSoda size={20} />}
                    <span>{role === 'trainer' ? 'Расписание' : 'Каталог'}</span>
                  </button>
                  <button
                    className={
                      page === 'admin-section' &&
                      adminSection === (role === 'trainer' ? 'trainer-clients' : 'bar-sales')
                        ? 'active'
                        : ''
                    }
                    onClick={() => openModule(role === 'trainer' ? 'trainer-clients' : 'bar-sales')}
                  >
                    {role === 'trainer' ? <Users size={20} /> : <CreditCard size={20} />}
                    <span>{role === 'trainer' ? 'Мои клиенты' : 'Продажи'}</span>
                  </button>
                </>
              )}
              {(role === 'administrator' || managingRole) && (
                <>
                  <button
                    className={
                      page === 'admin-section' && adminSection === 'schedule' ? 'active' : ''
                    }
                    onClick={() => openModule('schedule')}
                  >
                    <CalendarDays size={20} />
                    <span>Расписание</span>
                  </button>
                  <button
                    aria-expanded={role === 'administrator' ? mobileQuickOpen : undefined}
                    aria-current={
                      role !== 'administrator' && page === 'sections' ? 'page' : undefined
                    }
                    className={role !== 'administrator' && page === 'sections' ? 'active' : ''}
                    aria-haspopup={role === 'administrator' ? 'dialog' : undefined}
                    onClick={() =>
                      role === 'administrator' ? setMobileQuickOpen(true) : openSections()
                    }
                  >
                    <Menu size={20} />
                    <span>{role === 'administrator' ? 'Действия' : 'Все разделы'}</span>
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
        {device === 'mobile' && (
          <p className="mobile-preview-hint">Мобильный вид тех же экранов.</p>
        )}
      </div>
      {modal === 'club' && (
        <Modal title="Рабочий клуб" subtitle={network.name} onClose={closeModal}>
          <p className="club-context-note">
            {availableClubs.length === 1
              ? 'Для этой роли доступен один клуб.'
              : 'Выберите клуб для расписания и операций. Сводка сети остаётся общей.'}
          </p>
          <div className="club-context-options" role="group" aria-label="Доступные клубы">
            {availableClubs.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={item.id === club.id}
                onClick={() => {
                  setWorkingClubs((previous) => ({ ...previous, [role]: item.id }));
                  setScenario('default');
                  setModal(null);
                }}
              >
                <ClubLogo brand={item.brand} variant="compact" decorative />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.city}</small>
                </span>
                {item.id === club.id && <Check size={18} aria-label="Текущий клуб" />}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {modal === 'add' && (
        <Modal title="Новый клиент" onClose={closeModal}>
          <form onSubmit={addMember} className="member-form">
            <label className="form-field">
              <span>
                Имя и фамилия <em>*</em>
              </span>
              <input
                name="name"
                placeholder="Анна Смирнова"
                required
                maxLength={80}
                autoComplete="name"
                pattern=".*\S.*"
              />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input
                name="email"
                type="email"
                placeholder="anna@example.com"
                maxLength={120}
                autoComplete="email"
              />
            </label>
            <label className="form-field">
              <span>Телефон</span>
              <input
                name="phone"
                type="tel"
                placeholder="+7 999 123-45-67"
                maxLength={30}
                autoComplete="tel"
              />
            </label>
            <label className="form-field">
              <span>Абонемент</span>
              <Select name="plan">
                {membershipKinds.map((kind) => (
                  <option key={kind.id}>{kind.name}</option>
                ))}
              </Select>
            </label>
            <p className="form-note">Данные сохранятся в памяти до обновления страницы.</p>
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={closeModal}>
                Отмена
              </Button>
              <Button type="submit">
                <Plus size={16} />
                Добавить клиента
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'reset' && (
        <Modal
          title="Начать с чистого листа?"
          subtitle="Восстановим исходные демоданные, записи на занятия, задачи и состояние экрана. Изменения в памяти будут сброшены."
          onClose={closeModal}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeModal}>
              Отмена
            </Button>
            <Button onClick={reset}>
              <RotateCcw size={15} />
              Сбросить данные
            </Button>
          </div>
        </Modal>
      )}
      {selectedClass !== null && (
        <Modal
          title={classes[selectedClass].name}
          subtitle="Групповое занятие · 1 ноября 2026"
          onClose={closeClass}
        >
          <div className="class-detail">
            <div className={`class-detail-icon avatar-${classes[selectedClass].color}`}>
              <Dumbbell size={32} />
            </div>
            <dl>
              <div>
                <dt>Начало</dt>
                <dd>{classes[selectedClass].time}</dd>
              </div>
              <div>
                <dt>Длительность</dt>
                <dd>{classes[selectedClass].duration}</dd>
              </div>
              <div>
                <dt>Тренер</dt>
                <dd>{classes[selectedClass].trainer}</dd>
              </div>
              <div>
                <dt>Зал</dt>
                <dd>{classes[selectedClass].room}</dd>
              </div>
              <div>
                <dt>Записано</dt>
                <dd>
                  {classes[selectedClass].booked} из {classes[selectedClass].capacity}
                </dd>
              </div>
            </dl>
            <div className="inline-success">
              <Check size={16} />
              Занятие в расписании
            </div>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast} />}
      {screenLocked && (
        <ScreenLock
          name={currentUser.name}
          onUnlock={() => {
            rememberScreenLock(false);
            setScreenLocked(false);
          }}
        />
      )}
    </div>
  );
}

function SlidersIcon() {
  return (
    <>
      <span className="state-menu-icon">
        <span />
        <span />
        <span />
      </span>
    </>
  );
}
