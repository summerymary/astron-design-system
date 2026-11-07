import type { AdminSectionId } from './admin';

export const managementNavigationGroups: { label: string; items: AdminSectionId[] }[] = [
  {
    label: 'Работа клуба',
    items: ['schedule', 'registration', 'services'],
  },
  {
    label: 'Клиенты и CRM',
    items: ['crm', 'trainer-clients', 'messages', 'notifications'],
  },
  { label: 'Команда', items: ['employees', 'payroll'] },
  {
    label: 'Клубы и занятия',
    items: ['directories', 'memberships', 'inventory'],
  },
  {
    label: 'Управление системой',
    items: ['statistics', 'rbac', 'security', 'service-settings'],
  },
];
