import { ScheduleWorkspace } from './ScheduleWorkspace';
import { Button } from '../components/ui';
import { ResourcePage, SectionLinks } from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import { resources } from '../data/workspace';
import { adminSections } from '../data/admin';
import type { AdminSectionId } from '../data/admin';
import type { DemoUser, Member, VisitKind } from '../types';
import { BarCatalog, BarSales, BartenderHome, TrainerClients } from './StaffWorkspace';
import {
  BarWorkspace,
  CashWorkspace,
  InventoryWorkspace,
  MembershipWorkspace,
  RegistrationWorkspace,
  SaleWorkspace,
  StatisticsWorkspace,
} from './WorkspaceOperations';
import { CRMWorkspace, MessagesWorkspace, NotificationsWorkspace } from './WorkspaceCRM';
import {
  CamerasWorkspace,
  DirectoriesWorkspace,
  EventLogsWorkspace,
  PayrollWorkspace,
  PreferencesWorkspace,
  RolesWorkspace,
  SecurityWorkspace,
} from './WorkspaceSystem';

export function AdminSection({
  section,
  member,
  members,
  clubName,
  employeeName,
  user,
  navigate,
  onMember,
  onRegister,
  onBack,
}: {
  section: AdminSectionId;
  member: Member | null;
  members: Member[];
  clubName: string;
  employeeName: string;
  user: DemoUser;
  navigate: Navigate;
  onMember: (member: Member) => void;
  onRegister: (member: Member, kind: VisitKind) => void;
  onBack: () => void;
}) {
  if (section === 'trainer-clients')
    return (
      <TrainerClients user={user} members={members} initialMember={member} navigate={navigate} />
    );
  if (section === 'bar-catalog') return <BarCatalog navigate={navigate} />;
  if (section === 'bar-sales') return <BarSales clubName={clubName} />;
  if (resources[section])
    return (
      <ResourcePage
        key={section}
        collection={section}
        config={resources[section]}
        navigate={navigate}
      />
    );
  if (section === 'schedule')
    return (
      <ScheduleWorkspace members={members} navigate={navigate} clubName={clubName} user={user} />
    );
  if (section === 'memberships') return <MembershipWorkspace navigate={navigate} />;
  if (section === 'registration')
    return (
      <RegistrationWorkspace
        members={members}
        initialMember={member}
        clubName={clubName}
        onRegister={onRegister}
        onMember={onMember}
      />
    );
  if (section === 'services')
    return (
      <SaleWorkspace
        members={members}
        initialMember={member}
        navigate={navigate}
        clubName={clubName}
      />
    );
  if (section === 'statistics') return <StatisticsWorkspace />;
  if (section === 'bar')
    return user.role === 'bartender' ? (
      <BartenderHome navigate={navigate} clubName={clubName} />
    ) : (
      <BarWorkspace navigate={navigate} clubName={clubName} />
    );
  if (section === 'cash') return <CashWorkspace navigate={navigate} />;
  if (section === 'inventory') return <InventoryWorkspace navigate={navigate} />;
  if (['crm', 'leads', 'requests', 'segments', 'pipelines', 'retention'].includes(section))
    return <CRMWorkspace key={section} section={section} navigate={navigate} />;
  if (section === 'messages' || section === 'external-messages')
    return (
      <MessagesWorkspace
        key={section}
        external={section === 'external-messages'}
        navigate={navigate}
      />
    );
  if (section === 'notifications') return <NotificationsWorkspace navigate={navigate} />;
  if (section === 'directories') return <DirectoriesWorkspace navigate={navigate} />;
  if (section === 'payroll') return <PayrollWorkspace navigate={navigate} />;
  if (section === 'rbac') return <RolesWorkspace />;
  if (section === 'security') return <SecurityWorkspace navigate={navigate} />;
  if (section === 'event-logs') return <EventLogsWorkspace />;
  if (section === 'cameras') return <CamerasWorkspace />;
  if (['settings', 'service-settings', 'schedule-calendar'].includes(section))
    return <PreferencesWorkspace key={section} section={section} name={employeeName} />;
  return (
    <section className="panel ws-panel-body ws-stack">
      <h2>{adminSections.find((value) => value.id === section)?.label}</h2>
      <p>
        {section === 'reviews'
          ? 'Ссылка на отзывы в новом источнике возвращает ошибку 404. Состав страницы будет уточнён.'
          : 'В новом источнике этот раздел недоступен. Его экраны будут разработаны после уточнения требований.'}
      </p>
      <SectionLinks ids={['directories', 'crm']} navigate={navigate} />
      <Button variant="secondary" onClick={onBack}>
        На главную
      </Button>
    </section>
  );
}
