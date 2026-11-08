export const membershipKinds = [
  {
    id: 'gym',
    name: 'Железная карта',
    description: 'Тренажёрный зал',
    colorName: 'Стальной',
    background: '#EDF0F3',
    foreground: '#465462',
    line: '#CDD4DC',
    type: 'Безлимитный',
    visits: '0',
    duration: '30',
  },
  {
    id: 'group',
    name: 'Групповые тренировки',
    description: 'Занятия в группе',
    colorName: 'Шалфейный',
    background: '#EDF3EE',
    foreground: '#42634D',
    line: '#CCDCD0',
    type: 'По посещениям',
    visits: '12',
    duration: '60',
  },
  {
    id: 'personal',
    name: 'Персональные тренировки',
    description: 'Занятия с тренером один на один',
    colorName: 'Приглушённый красный',
    background: '#F8EEEE',
    foreground: '#914B50',
    line: '#E8CFD1',
    type: 'По посещениям',
    visits: '4',
    duration: '30',
  },
  {
    id: 'single',
    name: 'Разовое посещение',
    description: 'Один самостоятельный визит',
    colorName: 'Дымчато-синий',
    background: '#E8F0FF',
    foreground: '#204DA8',
    line: '#B8CDF3',
    type: 'Разовое посещение',
    visits: '1',
    duration: '1',
  },
  {
    id: 'guest',
    name: 'Гостевой визит',
    description: 'Знакомство с клубом',
    colorName: 'Светлый контур',
    background: 'transparent',
    foreground: '#606A5C',
    line: '#CCD2C8',
    type: 'Разовое посещение',
    visits: '1',
    duration: '7',
  },
] as const;
export type MembershipKind = (typeof membershipKinds)[number];
export type MembershipKindId = MembershipKind['id'];

export function quantityLabel(value: number | string, unit: 'day' | 'visit' | 'training'): string {
  const count = Number(value);
  const forms =
    unit === 'day'
      ? ['день', 'дня', 'дней']
      : unit === 'training'
        ? ['занятие', 'занятия', 'занятий']
        : ['посещение', 'посещения', 'посещений'];
  const plural = new Intl.PluralRules('ru').select(count);
  return `${count} ${forms[plural === 'one' ? 0 : plural === 'few' ? 1 : 2]}`;
}

export function getMembershipKind(name: string, kindId?: string): MembershipKind | undefined {
  const explicit = membershipKinds.find((kind) => kind.id === kindId);
  if (explicit) return explicit;
  const normalized = name.toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const aliases: Record<MembershipKindId, string[]> = {
    gym: ['железная карта', 'тренажерный зал', 'безлимит', 'дневной'],
    group: ['групповые', '12 занятий'],
    personal: ['персональные'],
    single: ['разовое посещение'],
    guest: ['гостевой визит'],
  };
  return membershipKinds.find((kind) => aliases[kind.id].some((word) => normalized.includes(word)));
}
