import type { ReportDefinition } from './statistics';

export const reportCategories = [
  { id: 'clients', label: 'Клиенты и привлечение', shortLabel: 'Клиенты' },
  { id: 'visits', label: 'Посещения и удержание', shortLabel: 'Посещения' },
  { id: 'trainers', label: 'Тренеры и загрузка', shortLabel: 'Тренеры' },
  { id: 'sales', label: 'Продажи и конверсия', shortLabel: 'Продажи' },
  { id: 'finance', label: 'Финансы и обязательства', shortLabel: 'Финансы' },
  { id: 'communications', label: 'Коммуникации', shortLabel: 'Общение' },
] as const;
type Family = {
  id: string;
  title: string;
  description: string;
  category: (typeof reportCategories)[number]['id'];
  reports: { id: string; label: string; hidden?: boolean }[];
  target?: 'schedule' | 'calls' | 'reviews' | 'members' | 'cash';
};
const views = (...items: [string, string][]) => items.map(([id, label]) => ({ id, label }));
export const reportFamilies: Family[] = [
  {
    id: 'new-clients',
    title: 'Новые клиенты',
    description: 'Критерий появления клиента, регистрации и источники',
    category: 'clients',
    reports: [
      { id: 'clients_new', label: 'Клиенты' },
      { id: 'newclients', label: 'Клиенты', hidden: true },
      { id: 'newclients_source', label: 'Источники' },
    ],
  },
  {
    id: 'client-base',
    title: 'Клиентская база',
    description: 'Действующие карты, состав базы и сегменты на дату',
    category: 'clients',
    reports: views(
      ['clients_active', 'Действующие карты'],
      ['clients_segmetation', 'Сегменты базы'],
    ),
  },
  {
    id: 'client-ratings',
    title: 'Рейтинг клиентов',
    description: 'Посещения, пропуски и покупки с разными единицами',
    category: 'clients',
    reports: views(
      ['clients_rating_visit', 'По посещениям'],
      ['notcame', 'По пропускам'],
      ['clients_rating', 'По покупкам'],
    ),
  },
  {
    id: 'contacts',
    title: 'Контакты клиентов',
    description: 'Телефоны и согласия; переход к клиентской базе',
    category: 'clients',
    reports: views(['report_all_clients_phones', 'Контакты']),
    target: 'members',
  },
  {
    id: 'birthdays',
    title: 'Дни рождения',
    description: 'Рабочий список на ближайшие 30 дней',
    category: 'clients',
    reports: views(['birdthday', 'Ближайшие даты']),
  },
  {
    id: 'visits',
    title: 'Посещения',
    description: 'Уникальные клиенты, динамика, параметры, аудитория и частота',
    category: 'visits',
    reports: views(
      ['unique_visits', 'Обзор'],
      ['visit_by_period', 'Динамика'],
      ['timetoabstat', 'Параметры'],
      ['clients_gender_age', 'Аудитория'],
      ['unlim_avg_visit', 'Безлимиты'],
    ),
  },
  {
    id: 'retention',
    title: 'Удержание клиентов',
    description: 'Не начали посещать, давно не приходят и срок наблюдения',
    category: 'visits',
    reports: views(
      ['client_never', 'Не начали посещать'],
      ['client_lastvisit', 'Давно не посещали'],
      ['client_lastvisit_personal', 'Не посещали ПТ'],
      ['client_lifetime', 'Срок наблюдения'],
    ),
  },
  {
    id: 'trainer-performance',
    title: 'Показатели тренеров',
    description: 'Персональные занятия, рабочие часы и заполняемость групп',
    category: 'trainers',
    reports: views(
      ['ptrener_rating', 'Персональные'],
      ['ptrener_rating_all', 'Рабочие часы'],
      ['gtrener_rating', 'Групповые'],
    ),
  },
  {
    id: 'trainer-clients',
    title: 'Клиенты тренера',
    description: 'Состав, потери, удержание и контакты без повторных журналов',
    category: 'trainers',
    reports: views(
      ['report_pclients', 'Состав'],
      ['report_pclients_lost', 'Потери'],
      ['report_pclients_stat', 'Удержание'],
      ['report_pclients_phones', 'Контакты'],
    ),
  },
  {
    id: 'trainer-planning',
    title: 'Планирование тренеров',
    description: 'Занятость за неделю и поиск рабочего окна',
    category: 'trainers',
    reports: views(['gtrener_busy', 'Занятость'], ['free_trener_find', 'Свободное время']),
    target: 'schedule',
  },
  {
    id: 'sales',
    title: 'Продажи',
    description: 'Динамика, позиции, покупатели, скидки и первые продажи',
    category: 'sales',
    reports: views(
      ['selling_stat', 'Обзор'],
      ['finbyyear', 'Динамика'],
      ['finbyyear_by_abonements', 'Абонементы'],
      ['clients_sell_gender_age', 'Покупатели'],
      ['clients_sell_discount', 'Скидки'],
      ['selling_clients_new', 'Первые продажи'],
      ['selltovosit', 'Стоимость визита'],
    ),
  },
  {
    id: 'conversion',
    title: 'Конверсия',
    description: 'Продления, летние карты и покупка после гостевого визита',
    category: 'sales',
    reports: views(
      ['selling_clients_secondary', 'Продления'],
      ['selling_clients_secondary_summer', 'Летние карты'],
      ['selling_clients_afterguest', 'После гостевого'],
    ),
  },
  {
    id: 'cash-control',
    title: 'Контроль денежных операций',
    description: 'Кассовый поток и подтверждённые ошибки операций',
    category: 'finance',
    reports: views(['kassacontrol', 'Движение денег'], ['fail_finance_report', 'Ошибки операций']),
    target: 'cash',
  },
  {
    id: 'financial-result',
    title: 'Финансовый результат',
    description: 'Клубы и направления, накопительно ПТ и экономика групп',
    category: 'finance',
    reports: views(
      ['financeresult', 'Клубы и направления'],
      ['trener_financial_result', 'Накопительно ПТ'],
      ['gt_finance', 'Групповые занятия'],
    ),
  },
  {
    id: 'ltv',
    title: 'Средние расходы клиента',
    description: 'Списания с лицевых счетов за всю историю или период',
    category: 'finance',
    reports: views(['clients_ltv', 'Вся известная история'], ['clients_ltv_bydate', 'За период']),
  },
  {
    id: 'obligations',
    title: 'Обязательства клуба',
    description: 'Счета, подарочные карты и неиспользованная стоимость абонементов',
    category: 'finance',
    reports: views(['fincredits', 'На дату среза']),
  },
  {
    id: 'calls',
    title: 'Звонки',
    description: 'Общая сводка и единый журнал входящих и исходящих звонков',
    category: 'communications',
    reports: views(['calls', 'Аналитика']),
    target: 'calls',
  },
  {
    id: 'feedback',
    title: 'Отзывы',
    description: 'Оценки за период и переход к общему журналу отзывов',
    category: 'communications',
    reports: views(['feedbacks', 'Аналитика']),
    target: 'reviews',
  },
];
export const reportFamily = (id: string) =>
  reportFamilies.find((f) => f.reports.some((r) => r.id === id))!;
export function familyCatalogue(reports: ReportDefinition[]) {
  return reportFamilies.flatMap((family) => {
    const available = family.reports
      .map((v) => reports.find((r) => r.id === v.id))
      .filter((r): r is ReportDefinition => !!r);
    return available.length ? [{ ...family, primaryId: available[0].id, available }] : [];
  });
}
