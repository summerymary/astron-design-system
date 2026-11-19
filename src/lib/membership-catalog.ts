import type { DemoRecord } from '../data/workspace';
import type { PlanSectionId } from './sale-catalog';
import { matchesSearch } from './directory-search';

type Family = { id: string; name: string; aliases?: string };
type Group = {
  id: string;
  section: PlanSectionId;
  name: string;
  description: string;
  families: Family[];
};

/** Navigation only: a family never grants access or changes a tariff's terms. */
export const membershipCatalogGroups: Group[] = [
  {
    id: 'club',
    section: 'memberships',
    name: 'Клубные абонементы',
    description: 'Безлимит, пакеты занятий и отдельные тарифные линейки',
    families: [
      { id: 'unlimited', name: 'Безлимитные', aliases: 'Безлимитный абонемент' },
      { id: 'visits', name: 'Пакеты занятий', aliases: 'Количественный абонемент' },
      { id: 'light', name: 'Лайт' },
      { id: 'lunch', name: 'Ланч' },
      { id: 'optimum', name: 'Оптимум' },
    ],
  },
  {
    id: 'gym',
    section: 'memberships',
    name: 'Тренажёрный зал',
    description: 'Железные карты: безлимит и пакеты тренировок',
    families: [
      {
        id: 'iron',
        name: 'Железные карты',
        aliases: 'Железный абонемент Железная карта',
      },
    ],
  },
  {
    id: 'age',
    section: 'memberships',
    name: 'Детям и молодёжи',
    description: 'Детские и молодёжные абонементы',
    families: [
      { id: 'children', name: 'Детские', aliases: 'Детский абонемент' },
      {
        id: 'youth',
        name: 'Молодёжные',
        aliases: 'Молодежный абонемент Молодёжная карта',
      },
    ],
  },
  {
    id: 'group',
    section: 'memberships',
    name: 'Групповые занятия',
    description: 'Фитнес-программы и коммерческие аквазанятия',
    families: [
      { id: 'fitness', name: 'Фитнес-программы', aliases: 'Групповые тренировки' },
      {
        id: 'aqua',
        name: 'Аква-тренировки',
        aliases: 'Коммерческие Аква тренировки Аква коммерч класс',
      },
    ],
  },
  {
    id: 'intro',
    section: 'memberships',
    name: 'Знакомство и разовые визиты',
    description: 'Добро пожаловать, разовое занятие и гостевой визит',
    families: [
      { id: 'welcome', name: 'Добро пожаловать' },
      { id: 'single', name: 'Разовые занятия', aliases: 'Разовое занятие Разовое посещение' },
      { id: 'guest', name: 'Гостевые визиты', aliases: 'Гостевой визит' },
    ],
  },
  {
    id: 'trainer',
    section: 'personal',
    name: 'По категории тренера',
    description: 'Персональные тренировки по квалификации специалиста',
    families: [
      { id: 'instructor', name: 'Инструктор' },
      { id: 'trainer', name: 'Персональный тренер', aliases: 'Тренер' },
      { id: 'senior', name: 'Старший тренер' },
      { id: 'master', name: 'Мастер', aliases: 'Мастер-тренер' },
      { id: 'expert', name: 'Эксперт' },
      { id: 'methodist', name: 'Методист' },
      { id: 'highest', name: 'Высшая категория' },
    ],
  },
  {
    id: 'special-training',
    section: 'personal',
    name: 'По направлению',
    description: 'Персональное плавание и кинезио',
    families: [
      { id: 'swimming', name: 'Плавание' },
      { id: 'kinesio', name: 'Кинезио' },
    ],
  },
  {
    id: 'legacy-training',
    section: 'personal',
    name: 'Прежние линейки',
    description: 'Отдельное место для прежних тарифов без автоматического архивирования',
    families: [{ id: 'expert-old', name: 'Эксперт старый' }],
  },
  {
    id: 'company',
    section: 'corporate',
    name: 'Для сотрудников компаний',
    description: 'Корпоративные карты и пакеты',
    families: [{ id: 'company', name: 'Корпоративные абонементы' }],
  },
  {
    id: 'special',
    section: 'exceptions',
    name: 'Специальные предложения',
    description: 'Социальные тарифы и акции',
    families: [
      { id: 'social', name: 'Социальные', aliases: 'Социальный абонемент Социальный тариф' },
      { id: 'promo', name: 'Акционные', aliases: 'Акция' },
    ],
  },
];

export function catalogGroups(section: PlanSectionId): Group[] {
  return [
    ...membershipCatalogGroups.filter((group) => group.section === section),
    {
      id: `${section}-other`,
      section,
      name: 'Другие абонементы',
      description: 'Тарифы без выбранной подгруппы',
      families: [{ id: `${section}-other`, name: 'Без подгруппы' }],
    },
  ];
}

const legacyFamilies: Record<string, string> = {
  'plan-1': 'iron',
  'plan-2': 'fitness',
  'plan-3': 'trainer',
  'personal-senior': 'senior',
  'personal-master': 'master',
  'plan-4': 'single',
  'plan-5': 'guest',
  'plan-corporate': 'company',
  'plan-social': 'social',
  'plan-promo': 'promo',
};

function legacyNameFamily(name: string) {
  const value = name
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[«»"·()]/g, ' ');
  const known: [RegExp, string][] = [
    [/железн/, 'iron'],
    [/молодежн/, 'youth'],
    [/детск/, 'children'],
    [/добро пожаловать/, 'welcome'],
    [/безлимитн/, 'unlimited'],
    [/до (60|90|120) занятий/, 'visits'],
    [/(^|\s)лайт(\s|$)/, 'light'],
    [/ланч/, 'lunch'],
    [/оптимум/, 'optimum'],
    [/аква/, 'aqua'],
    [/разовое (занятие|посещение)/, 'single'],
    [/гостевой визит/, 'guest'],
    [/социальн/, 'social'],
    [/эксперт старый/, 'expert-old'],
    [/высшая категория/, 'highest'],
    [/методист/, 'methodist'],
    [/инструктор/, 'instructor'],
    [/плавание/, 'swimming'],
    [/кинезио/, 'kinesio'],
    [/эксперт/, 'expert'],
    [/мастер/, 'master'],
    [/старший тренер/, 'senior'],
    [/персональный тренер/, 'trainer'],
  ];
  return known.find(([pattern]) => pattern.test(value))?.[1];
}

export function catalogPlacement(record: DemoRecord, section: PlanSectionId) {
  const groups = catalogGroups(section);
  const familyId =
    record.catalogFamily || legacyFamilies[record.id] || legacyNameFamily(record.name);
  const group = groups.find((group) => group.families.some((family) => family.id === familyId));
  if (group) return { group, family: group.families.find((family) => family.id === familyId)! };
  const fallback = groups.at(-1)!;
  return { group: fallback, family: fallback.families[0] };
}

export function matchesCatalogPlan(
  record: DemoRecord,
  section: PlanSectionId,
  query: string,
  includeDetails = false,
) {
  const { group, family } = catalogPlacement(record, section);
  return matchesSearch(
    [
      record.name,
      group.name,
      family.name,
      family.aliases,
      record.type,
      record.type === 'По посещениям' ? 'количественный' : '',
      ...(includeDetails ? [record.short, record.description, record.kind] : []),
    ].join(' '),
    query,
  );
}

export function sortCatalogPlans(records: DemoRecord[]) {
  return [...records].sort((a, b) => {
    const type = (row: DemoRecord) =>
      row.type === 'Безлимитный' ? 0 : row.type === 'Разовое посещение' ? 2 : 1;
    return (
      type(a) - type(b) ||
      Number(a.visits || 0) - Number(b.visits || 0) ||
      Number(a.duration || 0) - Number(b.duration || 0) ||
      a.name.localeCompare(b.name, 'ru')
    );
  });
}
