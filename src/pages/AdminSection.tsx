import { ScheduleWorkspace } from './ScheduleWorkspace';
import { AdminAccountWorkspace } from './AdminAccountWorkspace';
import { Button } from '../components/ui';
import { ResourcePage, SectionLinks } from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import { resources } from '../data/workspace';
import { adminSections } from '../data/admin';
import type { AdminSectionId } from '../data/admin';
import type { DemoUser, Member, RegisterVisit, Visit } from '../types';
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
import type { TrainingKind } from '../lib/training-kind';
import { roles } from '../data/roles';
import { GiftCardsWorkspace } from './GiftCardsWorkspace';
import { RetailWorkspace } from './RetailWorkspace';
import { CallsWorkspace } from './CallsWorkspace';
import {
  TrainerClientRoster,
  PersonalTrainingsWorkspace,
  ShiftScheduleWorkspace,
  StaffContactsWorkspace,
} from './ReceptionStaff';
import { personalTrainers } from '../lib/personal-training';
import { useWorkspace } from '../components/WorkspaceProvider';
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
  saleTraining,
  saleTrainerId,
  onRecord,
  member,
  members,
  visits,
  clubName,
  onClubChange,
  employeeName,
  user,
  screenLocked,
  navigate,
  onMember,
  onRegister,
  onBack,
}: {
  section: AdminSectionId;
  recordId: string | null;
  saleTraining: TrainingKind | null;
  saleTrainerId: string | null;
  onRecord: (id: string | null) => void;
  member: Member | null;
  members: Member[];
  visits: Visit[];
  clubName: string;
  onClubChange: (name: string) => void;
  employeeName: string;
  user: DemoUser;
  screenLocked?: boolean;
  navigate: Navigate;
  onMember: (member: Member) => void;
  onRegister: RegisterVisit;
  onBack: () => void;
}) {
  const { data } = useWorkspace();
  if (section === 'admin-account')
    return <AdminAccountWorkspace key={user.id} user={user} screenLocked={screenLocked} />;
  if (section === 'gift-cards')
    return (
      <GiftCardsWorkspace
        members={members}
        user={user}
        clubName={clubName}
        initialMember={member}
      />
    );
  if (section === 'personal-trainings')
    return (
      <PersonalTrainingsWorkspace
        initialMember={member}
        user={user}
        members={members}
        clubName={clubName}
        onMember={onMember}
        onRegistration={(member) => navigate('registration', member)}
        recordId={recordId}
        onRecord={onRecord}
      />
    );
  if (section === 'shifts') return <ShiftScheduleWorkspace user={user} clubName={clubName} />;
  if (section === 'calls')
    return (
      <CallsWorkspace
        members={members}
        onMember={onMember}
        hidePhones={user.role === 'administrator'}
      />
    );
  if (section === 'employees' && user.role === 'administrator')
    return <StaffContactsWorkspace clubName={clubName} recordId={recordId} onRecord={onRecord} />;
  if (section === 'trainer-clients')
    return user.role === 'trainer' ? (
      <TrainerClients user={user} members={members} initialMember={member} navigate={navigate} />
    ) : null;
  if (section === 'bar-catalog') return <BarCatalog navigate={navigate} />;
  if (section === 'bar-sales') return <BarSales clubName={clubName} />;
  if (section === 'products')
    return <RetailWorkspace clubName={clubName} employeeName={employeeName} />;
  if (section === 'bar-inventory') return <InventoryWorkspace key="bar" bar navigate={navigate} />;
  if (resources[section])
    return (
      <ResourcePage
        key={section}
        collection={section}
        config={
          user.role === 'administrator' && section === 'training-templates'
            ? { ...resources[section], readonly: true }
            : resources[section]
        }
        navigate={navigate}
        recordId={recordId}
        onRecord={onRecord}
        detailsExtra={
          section === 'employees'
            ? (employee) => {
                const trainer = personalTrainers(data).find((row) => row.name === employee.name);
                return trainer ? (
                  <TrainerClientRoster
                    trainerId={trainer.id}
                    user={user}
                    members={members}
                    onMember={onMember}
                    onBook={(client) => navigate('personal-trainings', client, trainer.id)}
                  />
                ) : null;
              }
            : undefined
        }
      />
    );
  if (section === 'schedule')
    return (
      <ScheduleWorkspace
        onRegister={onRegister}
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
        key={member?.id ?? 'no-client'}
        user={user}
        hasHeaderSearch={user.role === 'administrator'}
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
        key={`${member?.id || ''}:${saleTraining || ''}:${saleTrainerId || ''}`}
        initialTrainerId={saleTrainerId}
        training={saleTraining}
        members={members}
        initialMember={member}
        navigate={navigate}
        clubName={clubName}
        employeeName={employeeName}
        hidePhones={user.role === 'administrator'}
        allowRegistration={canOpenModule(user.role, 'registration')}
      />
    );
  if (section === 'statistics')
    return (
      <StatisticsWorkspace
        members={members}
        visits={visits}
        reportId={recordId}
        onReport={onRecord}
        onMember={onMember}
        hidePhones={user.role === 'administrator'}
      />
    );
  if (section === 'bar')
    return user.role === 'bartender' ? (
      <BartenderHome navigate={navigate} clubName={clubName} />
    ) : (
      <BarWorkspace navigate={navigate} clubName={clubName} />
    );
  if (section === 'cash')
    return (
      <CashWorkspace
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
