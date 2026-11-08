import type { AdminSectionId } from './admin';

export const managementNavigationGroups: { label: string; items: AdminSectionId[] }[] = [
  {
    label: 'Занятия и тренеры',
    items: ['schedule', 'trainer-clients'],
  },
  {
    label: 'Клиенты и продажи',
    items: ['registration', 'services', 'memberships', 'crm', 'messages', 'notifications'],
  },
  { label: 'Команда', items: ['employees', 'payroll'] },
  {
    label: 'Ресурсы клуба',
    items: ['inventory', 'directories'],
  },
  {
    label: 'Настройки и контроль',
    items: ['statistics', 'rbac', 'security', 'service-settings'],
  },
];
