import type { AdminSectionId } from './admin';

export const managementNavigationGroups: { label: string; items: AdminSectionId[] }[] = [
  {
    label: 'Работа клуба',
    items: ['schedule', 'memberships', 'registration', 'services', 'products', 'cash', 'inventory'],
  },
  {
    label: 'Клиенты и CRM',
    items: [
      'crm',
      'leads',
      'requests',
      'segments',
      'pipelines',
      'retention',
      'trainer-clients',
      'messages',
      'external-messages',
      'calls',
      'reviews',
      'notifications',
    ],
  },
  { label: 'Команда', items: ['employees', 'positions', 'absences', 'payroll'] },
  {
    label: 'Клубы и занятия',
    items: [
      'directories',
      'clubs',
      'rooms',
      'receptions',
      'training-templates',
      'training-groups',
      'schedule-calendar',
    ],
  },
  {
    label: 'Управление системой',
    items: [
      'statistics',
      'cameras',
      'rbac',
      'security',
      'event-logs',
      'service-settings',
      'settings',
    ],
  },
];
