import type { Member, MemberStatus, Page, Scenario } from '../types';

export const pages: { id: Page; title: string; caption: string }[] = [
  { id: 'overview', title: 'Обзор клуба', caption: 'Всё, что происходит в клубе сегодня.' },
  { id: 'members', title: 'Клиенты', caption: '' },
  {
    id: 'design-system',
    title: 'Дизайн-система',
    caption: 'Цвета, текст, логотипы и элементы интерфейса с примерами.',
  },
];

export const scenarios: { id: Scenario; label: string }[] = [
  { id: 'default', label: 'С данными' },
  { id: 'empty', label: 'Пусто' },
  { id: 'loading', label: 'Загрузка' },
  { id: 'error', label: 'Ошибка' },
];

export const statusLabels: Record<MemberStatus, string> = {
  active: 'Активен',
  expiring: 'Истекает',
  paused: 'Заморожен',
};

export const initialMembers: Member[] = [
  {
    id: 1001,
    name: 'Анна Смирнова',
    email: 'anna.smirnova@example.com',
    phone: '+7 999 123-45-67',
    plan: 'Безлимит',
    status: 'active',
    joined: '12.09.2026',
    expires: '12.12.2026',
    visits: 24,
    color: 'peach',
  },
  {
    id: 1002,
    name: 'Михаил Волков',
    email: 'm.volkov@example.com',
    phone: '+7 999 234-56-78',
    plan: 'Дневной',
    status: 'expiring',
    joined: '05.08.2026',
    expires: '05.11.2026',
    visits: 38,
    color: 'violet',
  },
  {
    id: 1003,
    name: 'Елена Козлова',
    email: 'elena.k@example.com',
    phone: '+7 999 345-67-89',
    plan: 'Безлимит',
    status: 'active',
    joined: '18.10.2026',
    expires: '18.01.2027',
    visits: 12,
    color: 'sage',
  },
  {
    id: 1004,
    name: 'Дмитрий Соколов',
    email: 'd.sokolov@example.com',
    phone: '+7 999 456-78-90',
    plan: '12 занятий',
    status: 'paused',
    joined: '22.09.2026',
    expires: '22.12.2026',
    visits: 8,
    color: 'blue',
  },
  {
    id: 1005,
    name: 'Мария Лебедева',
    email: 'maria.l@example.com',
    phone: '+7 999 567-89-01',
    plan: 'Безлимит',
    status: 'active',
    joined: '01.10.2026',
    expires: '01.01.2027',
    visits: 18,
    color: 'rose',
  },
  {
    id: 1006,
    name: 'Алексей Морозов',
    email: 'alex.m@example.com',
    phone: '+7 999 678-90-12',
    plan: 'Дневной',
    status: 'expiring',
    joined: '03.08.2026',
    expires: '03.11.2026',
    visits: 42,
    color: 'sand',
  },
];

export const classes = [
  {
    time: '10:00',
    duration: '55 мин',
    name: 'Мягкая йога',
    trainer: 'Алина Белова',
    room: 'Студия 01',
    booked: 8,
    capacity: 12,
    color: 'sage',
  },
  {
    time: '12:30',
    duration: '45 мин',
    name: 'Функциональный тренинг',
    trainer: 'Максим Орлов',
    room: 'Основной зал',
    booked: 12,
    capacity: 12,
    color: 'peach',
  },
  {
    time: '18:00',
    duration: '55 мин',
    name: 'Пилатес',
    trainer: 'Алина Белова',
    room: 'Студия 01',
    booked: 6,
    capacity: 10,
    color: 'violet',
  },
];

export const weeklyVisits = [
  { day: 'Пн', value: 98 },
  { day: 'Вт', value: 124 },
  { day: 'Ср', value: 110 },
  { day: 'Чт', value: 147 },
  { day: 'Пт', value: 132 },
  { day: 'Сб', value: 168 },
  { day: 'Вс', value: 142 },
];
