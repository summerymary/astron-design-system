import type { AdminSectionId } from './admin';

export const managementNavigationGroups: { label: string; items: AdminSectionId[] }[] = [
  {
    label: 'Работа клуба',
    items: ['schedule', 'personal-trainings', 'memberships', 'registration'],
  },
  {
    label: 'Клиенты и продажи',
    items: ['services', 'gift-cards', 'crm', 'messages', 'notifications'],
  },
  { label: 'Команда', items: ['employees', 'shifts', 'payroll'] },
  {
    label: 'Ресурсы клуба',
    items: ['inventory', 'directories'],
  },
  {
    label: 'Настройки и контроль',
    items: ['rbac', 'security', 'service-settings'],
  },
];
