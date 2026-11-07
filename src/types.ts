export type Page = 'overview' | 'members' | 'admin-section' | 'client-profile';
export type Scenario = 'default' | 'empty' | 'loading' | 'error';
export type Device = 'desktop' | 'mobile';
export type MemberStatus = 'active' | 'expiring' | 'paused';
export type VisitKind = 'gym' | 'group' | 'personal' | 'online';
export interface Visit {
  id: string;
  memberId: number;
  passId?: string;
  card: string;
  enteredAt: string;
  kind: VisitKind;
  plan: string;
  clubId: string;
}
export type UserRole =
  | 'administrator'
  | 'trainer'
  | 'bartender'
  | 'club-director'
  | 'network-director'
  | 'marketer'
  | 'fitness-director'
  | 'operations-director'
  | 'sysadmin';

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  networkId: string;
  clubIds: string[];
}

export interface RoleDefinition {
  id: UserRole;
  label: string;
  scope: 'club' | 'network';
  canViewMembers: boolean;
  canAddMembers: boolean;
}

export interface RoleHomeData {
  title: string;
  caption: string;
  summaryTitle: string;
  summaryText: string;
  metrics: { label: string; value: string; detail: string }[];
  itemsTitle: string;
  itemsCaption: string;
  items: { id: string; title: string; subtitle: string; time: string; status: string }[];
  noteTitle: string;
  noteText: string;
  emptyTitle: string;
  emptyDescription: string;
}
export interface Member {
  id: number;
  name: string;
  fullName?: string;
  email: string;
  phone: string;
  plan: string;
  status: MemberStatus;
  joined: string;
  expires: string;
  visits: number;
  initialPassVisits?: number;
  color: string;
  archived?: boolean;
  tags?: string;
}
