import type { DemoRecord } from '../data/workspace';
import type { DemoUser, Member, UserRole } from '../types';

export const managementRoles: UserRole[] = [
  'club-director',
  'network-director',
  'fitness-director',
  'operations-director',
  'sysadmin',
];
export function isManagementRole(role: UserRole): boolean {
  return managementRoles.includes(role);
}

export function canOpenModule(role: UserRole, section: string): boolean {
  if (isManagementRole(role)) return !['collagen', 'trainer-clients'].includes(section);
  if (role === 'administrator') return !['trainer-clients', 'collagen'].includes(section);
  if (role === 'trainer') return ['schedule', 'trainer-clients', 'settings'].includes(section);
  if (role === 'bartender')
    return ['bar', 'bar-catalog', 'bar-sales', 'settings'].includes(section);
  if (role === 'marketer')
    return [
      'crm',
      'leads',
      'segments',
      'pipelines',
      'retention',
      'statistics',
      'requests',
      'messages',
      'external-messages',
      'reviews',
      'notifications',
      'calls',
      'settings',
    ].includes(section);
  if (role === 'accountant')
    return [
      'cash',
      'statistics',
      'services',
      'products',
      'memberships',
      'inventory',
      'payroll',
      'settings',
    ].includes(section);
  return false;
}
export function personalClients(
  data: Record<string, DemoRecord[]>,
  members: Member[],
  trainerId: string,
): Member[] {
  const ids = new Set(
    (data['personal-clients'] || [])
      .filter((r) => r.trainerId === trainerId)
      .map((r) => r.memberId),
  );
  return members.filter((member) => ids.has(String(member.id)) && !member.archived);
}
export function canManageEvent(event: DemoRecord, user: DemoUser): boolean {
  if (['Завершено', 'Отменено'].includes(event.status)) return false;
  return (
    isManagementRole(user.role) ||
    (user.role === 'trainer' &&
      event.kind === 'personal' &&
      event.trainerId === user.id &&
      event.trainer === user.name)
  );
}
export function canCreateEvent(user: DemoUser): boolean {
  return isManagementRole(user.role) || user.role === 'trainer';
}
export function canCancelEvent(event: DemoRecord, user: DemoUser): boolean {
  if (['Завершено', 'Отменено'].includes(event.status)) return false;
  return user.role === 'administrator' || canManageEvent(event, user);
}
export function personalScopeError(
  event: DemoRecord,
  user: DemoUser,
  assignments: DemoRecord[],
): string | null {
  if (!canCreateEvent(user)) return 'Эта роль не добавляет тренировки.';
  if (user.role === 'trainer' && (event.trainerId !== user.id || event.trainer !== user.name))
    return 'Можно записывать тренировки только от своего имени.';
  if (
    event.kind !== 'personal' ||
    event.format !== 'Персональное' ||
    event.capacity !== '1' ||
    event.booked !== '1' ||
    event.attendees !== event.memberId
  )
    return 'Для персональной тренировки выберите одного клиента.';
  if (!assignments.some((r) => r.trainerId === event.trainerId && r.memberId === event.memberId))
    return 'Выберите клиента, закреплённого за этим тренером.';
  return null;
}
export function noteError(
  text: string,
  trainerId: string,
  memberId: string,
  assignments: DemoRecord[],
): string | null {
  if (!assignments.some((r) => r.trainerId === trainerId && r.memberId === memberId))
    return 'Клиент не закреплён за этим тренером.';
  if (!text.trim()) return 'Напишите текст заметки.';
  if (text.trim().length > 2000) return 'Заметка должна быть не длиннее 2000 символов.';
  return null;
}
