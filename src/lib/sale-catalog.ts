import type { DemoRecord } from '../data/workspace';
import { matchesSearch } from './directory-search';

export const saleSections = [
  {
    id: 'memberships',
    name: 'Абонементы',
    description: 'Тренажёрный зал, групповые занятия и визиты',
  },
  {
    id: 'personal',
    name: 'Персональный тренинг',
    description: 'Индивидуальные занятия с тренером',
  },
  {
    id: 'corporate',
    name: 'Корпоративные абонементы',
    description: 'Карты для сотрудников организаций',
  },
  {
    id: 'exceptions',
    name: 'Исключения',
    description: 'Специальные, акционные и социальные тарифы',
  },
  {
    id: 'goods-services',
    name: 'Товары и услуги',
    description: 'Товары ресепшена, прокат и дополнительные услуги',
  },
] as const;
export type SaleSectionId = (typeof saleSections)[number]['id'];
export type SaleCatalogItem = {
  record: DemoRecord;
  sectionId: SaleSectionId;
  type: 'plan' | 'product' | 'service';
};
export function saleCatalog(data: Record<string, DemoRecord[]>): SaleCatalogItem[] {
  return [
    ...(data.plans || [])
      .filter((row) => row.status === 'Опубликован')
      .map((record): SaleCatalogItem => ({
        record,
        sectionId:
          record.saleSection === 'exceptions'
            ? 'exceptions'
            : record.corporate === 'Да'
              ? 'corporate'
              : record.kindId === 'personal'
                ? 'personal'
                : 'memberships',
        type: 'plan',
      })),
    ...(data['retail-products'] || [])
      .filter((row) => row.status === 'Активен')
      .map((record): SaleCatalogItem => ({ record, sectionId: 'goods-services', type: 'product' })),
    ...(data['reception-services'] || [])
      .filter((row) => row.status === 'Активен')
      .map((record): SaleCatalogItem => ({ record, sectionId: 'goods-services', type: 'service' })),
  ];
}
export function searchSaleCatalog(
  items: SaleCatalogItem[],
  query: string,
  sectionId: SaleSectionId | null,
) {
  return items.filter(
    (item) =>
      (!sectionId || item.sectionId === sectionId) && matchesSearch(item.record.name, query),
  );
}
