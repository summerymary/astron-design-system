import type { AdminSectionId } from './admin';

export const managementNavigationGroups: { label: string; items: AdminSectionId[] }[] = [
  {
    label: 'Работа клуба',
    items: ['schedule', 'memberships', 'registration'],
  },
  {
    label: 'Клиенты и продажи',
    items: ['services', 'crm', 'messages', 'notifications'],
  },
  { label: 'Команда', items: ['employees', 'payroll'] },
  {
    label: 'Ресурсы клуба',
    items: ['inventory', 'directories'],
  },
  {
    label: 'Настройки и контроль',
    items: ['rbac', 'security', 'service-settings'],
  },
];
