import { ScheduleWorkspace } from './ScheduleWorkspace';
import { Button } from '../components/ui';
import { ResourcePage, SectionLinks } from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import { resources } from '../data/workspace';
import { adminSections } from '../data/admin';
import type { AdminSectionId } from '../data/admin';
import type { DemoUser, Member, VisitKind } from '../types';
import { BarCatalog, BarSales, BartenderHome, TrainerClients } from './StaffWorkspace';
import { canOpenModule } from '../lib/staff-rules';
import {
  BarWorkspace,
  CashWorkspace,
  InventoryWorkspace,
  MembershipWorkspace,
  RegistrationWorkspace,
  SaleWorkspace,
  StatisticsWorkspace,
} from './WorkspaceOperations';
import { CRMWorkspace, NotificationsWorkspace } from './WorkspaceCRM';
import { MessagesWorkspace } from './MessengerWorkspace';
import { roles } from '../data/roles';
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
  recordId,
  onRecord,
  member,
  members,
  clubName,
  onClubChange,
  employeeName,
  user,
  navigate,
  onMember,
  onRegister,
  onBack,
}: {
  section: AdminSectionId;
  recordId: string | null;
  onRecord: (id: string | null) => void;
  member: Member | null;
  members: Member[];
  clubName: string;
  onClubChange: (name: string) => void;
  employeeName: string;
  user: DemoUser;
  navigate: Navigate;
  onMember: (member: Member) => void;
  onRegister: (member: Member, kind: VisitKind, passName?: string, passId?: string) => void;
  onBack: () => void;
}) {
  if (section === 'trainer-clients')
    return user.role === 'trainer' ? (
      <TrainerClients user={user} members={members} initialMember={member} navigate={navigate} />
    ) : null;
  if (section === 'bar-catalog') return <BarCatalog navigate={navigate} />;
  if (section === 'bar-sales') return <BarSales clubName={clubName} />;
  if (section === 'products')
    return (
      <SaleWorkspace
        key="retail-sale"
        initialSection="goods-services"
        members={members}
        initialMember={member}
        navigate={navigate}
        clubName={clubName}
        employeeName={employeeName}
        hidePhones={user.role === 'administrator'}
        allowRegistration={canOpenModule(user.role, 'registration')}
      />
    );
  if (section === 'bar-inventory') return <InventoryWorkspace key="bar" bar navigate={navigate} />;
  if (resources[section])
    return (
      <ResourcePage
        key={section}
        collection={section}
        config={resources[section]}
        navigate={navigate}
        recordId={recordId}
        onRecord={onRecord}
      />
    );
  if (section === 'schedule')
    return (
      <ScheduleWorkspace
        recordId={recordId}
        onRecord={onRecord}
        members={members}
        navigate={navigate}
        clubName={clubName}
        onClubChange={onClubChange}
        onMember={onMember}
        user={user}
      />
    );
  if (section === 'memberships') return <MembershipWorkspace navigate={navigate} />;
  if (section === 'registration')
    return (
      <RegistrationWorkspace
        members={members}
        initialMember={member}
        clubName={clubName}
        onRegister={onRegister}
        hidePhones={user.role === 'administrator'}
        navigate={navigate}
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
        employeeName={employeeName}
        hidePhones={user.role === 'administrator'}
        allowRegistration={canOpenModule(user.role, 'registration')}
      />
    );
  if (section === 'statistics') return <StatisticsWorkspace />;
  if (section === 'bar')
    return user.role === 'bartender' ? (
      <BartenderHome navigate={navigate} clubName={clubName} />
    ) : (
      <BarWorkspace navigate={navigate} clubName={clubName} />
    );
  if (section === 'cash')
    return (
      <CashWorkspace
        navigate={navigate}
        clubName={clubName}
        employeeName={employeeName}
        members={members}
        onMember={onMember}
      />
    );
  if (section === 'inventory') return <InventoryWorkspace key="retail" navigate={navigate} />;
  if (['crm', 'leads', 'requests', 'segments', 'pipelines', 'retention'].includes(section))
    return <CRMWorkspace key={section} section={section} navigate={navigate} />;
  if (section === 'messages' || section === 'external-messages')
    return (
      <MessagesWorkspace
        key={`${section}-${member?.id || 'queue'}`}
        external={section === 'external-messages'}
        navigate={navigate}
        initialMember={member}
        members={members}
        onMember={
          roles.find((role) => role.id === user.role)?.canViewMembers ? onMember : undefined
        }
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
