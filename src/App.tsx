import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
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
  ContactRound,
  CreditCard,
  MessageSquare,
  Phone,
  Settings2,
  BarChart3,
  CupSoda,
  Library,
  BriefcaseBusiness,
} from 'lucide-react';
import { Button, Modal, StateContent, Toast } from './components/ui';
import { AdminHeader } from './components/AdminHeader';
import { ClubLogo } from './components/ClubLogo';
import { adminSections, initialVisits, memberCards, visitKinds, workstations } from './data/admin';
import type { AdminSectionId } from './data/admin';
import { classes, initialMembers, pages, scenarios } from './data/mock';
import { demoClubs, demoNetworks, demoUsers, roleHomes, roles } from './data/roles';
import { initialProfileBookings } from './data/profileBookings';
import { useTheme } from './components/ThemeProvider';
import { useWorkspace } from './components/WorkspaceProvider';
import { LinkCards } from './components/WorkspaceUI';
import { Members } from './pages/Members';
import { AdminOverview } from './pages/AdminOverview';
import { AdminSection } from './pages/AdminSection';
import { ClientProfile } from './pages/ClientProfile';
import { RoleOverview } from './pages/RoleOverview';
import type { Device, Member, Page, Scenario, UserRole, Visit, VisitKind } from './types';

const navigation = [
  { id: 'overview' as const, label: 'Ресепшен', icon: LayoutDashboard },
  { id: 'members' as const, label: 'Клиенты', icon: Users },
];
const workNavigation = [
  { id: 'schedule', label: 'Расписание', icon: CalendarDays },
  { id: 'memberships', label: 'Абонементы', icon: CreditCard },
  { id: 'crm', label: 'CRM', icon: ContactRound },
  { id: 'registration', label: 'Посещения', icon: Check },
  { id: 'calls', label: 'Звонки', icon: Phone },
  { id: 'messages', label: 'Сообщения', icon: MessageSquare },
  { id: 'bar', label: 'Бар', icon: CupSoda },
] as const;
const managementNavigation = [
  { id: 'statistics', label: 'Статистика', icon: BarChart3 },
  { id: 'employees', label: 'Персонал', icon: BriefcaseBusiness },
  { id: 'directories', label: 'Справочники', icon: Library },
  { id: 'service-settings', label: 'Настройки', icon: Settings2 },
] as const;

function initialOptions() {
  const [path, query] = window.location.hash.replace('#/', '').split('?');
  const params = new URLSearchParams(query);
  const role = roles.find((r) => r.id === params.get('role')) ?? roles[0];
  return {
    page:
      path === 'admin-section' && role.id === 'administrator'
        ? ('admin-section' as Page)
        : path === 'client-profile' && role.canViewMembers
          ? ('client-profile' as Page)
          : pages.some((p) => p.id === path) && (path !== 'members' || role.canViewMembers)
            ? (path as Page)
            : ('overview' as Page),
    role: role.id,
    clientId: Number(params.get('clientId')) || null,
    section: adminSections.find((s) => s.id === params.get('section'))?.id ?? 'schedule',
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
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [resetVersion, setResetVersion] = useState(0);
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [workstationId, setWorkstationId] = useState('central-01');
  const [adminSection, setAdminSection] = useState<AdminSectionId>(options.section);
  const [sectionMember, setSectionMember] = useState<Member | null>(null);
  const [registrationMemberId, setRegistrationMemberId] = useState('');
  const [registrationKind, setRegistrationKind] = useState<VisitKind>('gym');
  const [modal, setModal] = useState<'add' | 'reset' | 'registration' | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(options.clientId);
  const [memberReturnPage, setMemberReturnPage] = useState<Page>('overview');
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileStateOpen, setMobileStateOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const currentRole = roles.find((r) => r.id === role)!;
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
  const club = demoClubs.find(
    (c) => c.id === (role === 'administrator' ? workstation.clubId : currentUser.clubIds[0]),
  )!;
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
    window.history.replaceState(
      null,
      '',
      `#/${page}?device=${device}&state=${scenario}&role=${role}${page === 'admin-section' ? `&section=${adminSection}` : ''}${page === 'client-profile' && selectedMemberId ? `&clientId=${selectedMemberId}` : ''}`,
    );
    document.title = `${currentPage.title} · Астрон`;
  }, [page, device, scenario, role, adminSection, selectedMemberId, currentPage.title]);
  useEffect(() => {
    const onHashChange = () => {
      const next = initialOptions();
      setRole(next.role);
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
    setRole(next);
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
  const openRegistration = (member?: Member) => {
    setRegistrationMemberId(member ? String(member.id) : '');
    setRegistrationKind('gym');
    setModal('registration');
  };
  const openModule = (section: AdminSectionId) => {
    if (section === 'members') {
      goTo('members');
      return;
    }
    setAdminSection(section);
    setSectionMember(null);
    setSectionsOpen(false);
    setScenario('default');
    goTo('admin-section');
  };
  const openAdminAction = (section: AdminSectionId, member?: Member) => {
    if (role !== 'administrator') return;
    if (section === 'registration') {
      openRegistration(member);
      return;
    }
    setSelectedMemberId(null);
    if (section === 'members') {
      goTo('members');
      return;
    }
    setAdminSection(section);
    setSectionMember(member ?? null);
    setScenario('default');
    goTo('admin-section');
  };
  const createVisit = (member: Member, kind: VisitKind) => {
    if (role !== 'administrator') return;
    const time = new Date(Date.UTC(2026, 10, 6, 14, 35 + visits.length - initialVisits.length))
      .toISOString()
      .slice(0, 16);
    const visit: Visit = {
      id: `demo-${Date.now()}`,
      memberId: member.id,
      card: memberCards[member.id] ?? String(member.id + 99000),
      enteredAt: time,
      kind,
      plan: member.plan,
      clubId: workstation.clubId,
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
      prev.map((m) => (m.id === member.id ? { ...m, visits: m.visits + 1 } : m)),
    );
    notify(`Посещение зарегистрировано · ${member.name}`);
  };
  const registerVisit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const member = members.find((m) => String(m.id) === registrationMemberId);
    if (!member) return;
    createVisit(member, registrationKind);
    setModal(null);
    setScenario('default');
    goTo('overview');
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
    workspace.reset();
    setResetVersion((value) => value + 1);
    setMembers(initialMembers);
    setVisits(initialVisits);
    setScenario('default');
    setModal(null);
    notify('Демоданные восстановлены');
  };

  return (
    <>
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
            <select
              aria-label="Роль в прототипе"
              value={role}
              onChange={(e) => changeRole(e.target.value as UserRole)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="scenario-select">
            <span className="scenario-label">Состояние</span>
            <span className={`scenario-dot scenario-${scenario}`} />
            <select
              aria-label="Состояние экрана"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as Scenario)}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
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
          <select
            aria-label="Роль в прототипе на телефоне"
            value={role}
            onChange={(e) => changeRole(e.target.value as UserRole)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <span>Демопользователь</span>
      </div>
      {mobileStateOpen && (
        <div className="mobile-state-menu">
          <label>
            Состояние экрана
            <select
              aria-label="Состояние на телефоне"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as Scenario)}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
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
        <div className={`app-shell is-${device}`}>
          <aside className="sidebar">
            <a
              className="brand"
              href="#/overview"
              onClick={(e) => {
                e.preventDefault();
                goTo('overview');
              }}
            >
              <ClubLogo brand={club.brand} />
            </a>
            <div className="club-switch">
              <ClubLogo brand={club.brand} variant="compact" decorative />
              <span>
                <strong>{currentRole.scope === 'network' ? network.name : club.name}</strong>
                <small>
                  {currentRole.scope === 'network'
                    ? `${currentUser.clubIds.length} клуба · ${club.city}`
                    : `${club.city} · Ваш клуб`}
                </small>
              </span>
              <ChevronDown size={14} />
            </div>
            <span className="nav-label">
              {currentRole.scope === 'network' ? 'УПРАВЛЕНИЕ СЕТЬЮ' : 'ВАШ КЛУБ'}
            </span>
            <nav className="side-nav" aria-label="Основная навигация">
              {visibleNavigation.map((n) => (
                <button
                  key={n.id}
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
                  {n.label}
                  {n.id === 'members' && <span>{members.length}</span>}
                </button>
              ))}
            </nav>
            {role === 'administrator' && (
              <nav className="side-nav ws-module-nav" aria-label="Рабочие разделы">
                {workNavigation.map((n) => (
                  <button
                    key={n.id}
                    aria-current={
                      page === 'admin-section' && adminSection === n.id ? 'page' : undefined
                    }
                    className={page === 'admin-section' && adminSection === n.id ? 'active' : ''}
                    onClick={() => openModule(n.id)}
                  >
                    <n.icon size={18} strokeWidth={1.75} />
                    {n.label}
                  </button>
                ))}
                <span className="nav-label ws-nav-separator">УПРАВЛЕНИЕ</span>
                {managementNavigation.map((n) => (
                  <button
                    key={n.id}
                    aria-current={
                      page === 'admin-section' && adminSection === n.id ? 'page' : undefined
                    }
                    className={page === 'admin-section' && adminSection === n.id ? 'active' : ''}
                    onClick={() => openModule(n.id)}
                  >
                    <n.icon size={18} strokeWidth={1.75} />
                    {n.label}
                  </button>
                ))}
                <button onClick={() => setSectionsOpen(true)}>
                  <Menu size={18} />
                  Все разделы
                </button>
              </nav>
            )}
            <div className="sidebar-bottom">
              <div className="sandbox-card">
                <span>
                  <i />
                  Режим прототипа
                </span>
                <p>Демонстрационные данные хранятся в памяти приложения.</p>
              </div>
              <div className="user-block">
                <span className="user-avatar">{userInitials}</span>
                <span>
                  <strong>{currentUser.name.split(' ')[0]}</strong>
                  <small>{currentRole.label}</small>
                </span>
                <span className="user-online" />
              </div>
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
                  onAction={openAdminAction}
                  name={currentUser.name}
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
            <main className="app-content" ref={contentRef} id="main-content" key={resetVersion}>
              {page !== 'client-profile' && (
                <div className="page-heading">
                  <div>
                    <div className="page-eyebrow">
                      {`${currentRole.label.toUpperCase()} / 6 НОЯБРЯ 2026`}
                    </div>
                    <h1>
                      {currentPage.title}
                      <span className="heading-dot">.</span>
                    </h1>
                    {currentPage.caption && <p>{currentPage.caption}</p>}
                  </div>
                  <div className="page-actions">
                    {page === 'overview' && role === 'administrator' && (
                      <span className="date-chip">
                        <CalendarDays size={15} />
                        Сегодня, 6 ноября
                      </span>
                    )}
                    {(page === 'overview' || page === 'members') && currentRole.canAddMembers && (
                      <Button onClick={() => setModal('add')}>
                        <Plus size={16} />
                        <span>Добавить клиента</span>
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {page === 'client-profile' ? (
                selectedMember ? (
                  <ClientProfile
                    key={selectedMember.id}
                    member={selectedMember}
                    visits={visits.filter((v) => v.memberId === selectedMember.id)}
                    bookings={selectedMember.id === 1001 ? initialProfileBookings : []}
                    canOperate={role === 'administrator'}
                    scenario={scenario}
                    onReset={() => setScenario('default')}
                    onBack={() => goTo(memberReturnPage)}
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
                    page === 'admin-section'
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
                        : page === 'admin-section'
                          ? {
                              title: 'В этом разделе пока нет записей',
                              description: 'Записи появятся после начала работы с разделом.',
                              actionLabel: 'Показать демоданные',
                            }
                          : undefined
                  }
                />
              ) : page === 'admin-section' ? (
                <AdminSection
                  key={adminSection}
                  section={adminSection}
                  member={sectionMember}
                  members={members}
                  clubName={club.name}
                  employeeName={currentUser.name}
                  navigate={openModule}
                  onMember={openMember}
                  onRegister={createVisit}
                  onBack={() => goTo('overview')}
                />
              ) : page === 'overview' ? (
                role !== 'administrator' ? (
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
              {role === 'administrator' && (
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
                  <button aria-expanded={sectionsOpen} onClick={() => setSectionsOpen(true)}>
                    <Menu size={20} />
                    <span>Все разделы</span>
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
      {modal === 'add' && (
        <Modal title="Новый клиент" subtitle="Первый шаг к новым достижениям." onClose={closeModal}>
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
              <select name="plan">
                <option>Безлимит</option>
                <option>Дневной</option>
                <option>12 занятий</option>
              </select>
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
      {modal === 'registration' && (
        <Modal
          title="Регистрация посещения"
          subtitle={`${club.name} · ${workstation.name}`}
          onClose={closeModal}
        >
          <form className="member-form" onSubmit={registerVisit}>
            <label className="form-field">
              <span>Клиент</span>
              <select
                aria-label="Клиент для посещения"
                required
                value={registrationMemberId}
                onChange={(e) => setRegistrationMemberId(e.target.value)}
              >
                <option value="" disabled>
                  Выберите клиента
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {memberCards[m.id] ?? String(m.id + 99000)}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Тип посещения</span>
              <select
                aria-label="Тип нового посещения"
                value={registrationKind}
                onChange={(e) => setRegistrationKind(e.target.value as VisitKind)}
              >
                {Object.entries(visitKinds).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {registrationMemberId && (
              <div className="registration-summary">
                <span>Абонемент</span>
                <strong>{members.find((m) => String(m.id) === registrationMemberId)?.plan}</strong>
              </div>
            )}
            <p className="form-note">Демонстрационное посещение сохранится в памяти прототипа.</p>
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={closeModal}>
                Отмена
              </Button>
              <Button type="submit" disabled={!registrationMemberId}>
                <Check size={15} />
                Зарегистрировать
              </Button>
            </div>
          </form>
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
      {sectionsOpen && (
        <Modal title="Все разделы" onClose={() => setSectionsOpen(false)}>
          <div className="ws-stack">
            <LinkCards
              ids={[
                'schedule',
                'memberships',
                'registration',
                'crm',
                'calls',
                'messages',
                'notifications',
                'bar',
                'cash',
                'statistics',
                'employees',
                'clubs',
                'directories',
                'cameras',
                'rbac',
                'security',
                'event-logs',
                'settings',
                'service-settings',
              ]}
              navigate={openModule}
            />
          </div>
        </Modal>
      )}
    </>
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
