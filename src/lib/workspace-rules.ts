import type { DemoRecord } from '../data/workspace';

const tasks: Record<string, string> = {
  Связались: 'Подобрать пробное занятие',
  'Нет ответа': 'Повторный звонок',
  'Пробное назначено': 'Подтвердить визит',
  'Пробное пройдено': 'Узнать впечатления и предложить абонемент',
};
export function leadTransitions(stage: string, stages: string[]): string[] {
  if (['Покупка', 'Отказ'].includes(stage) || !stages.includes(stage)) return [];
  const mainStages = stages.filter((value) => !['Нет ответа', 'Отказ'].includes(value));
  if (stage === 'Нет ответа') {
    const recovery = mainStages.includes('Связались') ? 'Связались' : mainStages[1];
    return recovery ? [recovery] : [];
  }
  const next = mainStages[mainStages.indexOf(stage) + 1];
  if (stage === mainStages[0])
    return [next, 'Нет ответа'].filter((value) => value && stages.includes(value));
  return next ? [next] : [];
}
export function leadTask(stage: string, previous: string) {
  return ['Покупка', 'Отказ'].includes(stage) ? '' : tasks[stage] || previous;
}

export function inventoryStock(document: DemoRecord, product: DemoRecord): number {
  if (document.status !== 'Черновик') throw new Error('Этот документ уже проведён.');
  const quantity = Number(document.qty);
  const current = Number(product.stock);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(current) || current < 0)
    throw new Error('Проверьте количество и текущий остаток.');
  if (document.type === 'Перемещение') {
    if (!document.from || !document.to || document.from === document.to)
      throw new Error('Выберите разные склады отправления и получения.');
    if (quantity > current) throw new Error('Недостаточно товара для перемещения.');
    return current;
  }
  if (document.type !== 'Поступление' && document.type !== 'Списание')
    throw new Error('Неизвестный тип документа.');
  const next = current + quantity * (document.type === 'Списание' ? -1 : 1);
  if (next < 0) throw new Error('Недостаточно товара для списания.');
  return next;
}

export function validatePlan(
  plan: DemoRecord,
  publish: boolean,
): { step: string; message: string } | null {
  if (!plan.name?.trim()) return { step: 'Основное', message: 'Укажите название карты.' };
  if (
    plan.price !== '' &&
    plan.price !== undefined &&
    (!Number.isFinite(Number(plan.price)) || Number(plan.price) < 0)
  )
    return { step: 'Продажа', message: 'Цена должна быть неотрицательным числом.' };
  if (
    !Number.isFinite(Number(plan.discount || 0)) ||
    Number(plan.discount || 0) < 0 ||
    Number(plan.discount || 0) > 100
  )
    return { step: 'Продажа', message: 'Скидка должна быть от 0 до 100%.' };
  if (!publish) return null;
  if (!Number.isInteger(Number(plan.duration)) || Number(plan.duration) < 1)
    return { step: 'Срок и визиты', message: 'Укажите положительное целое число дней.' };
  if (
    plan.type === 'По посещениям' &&
    (!Number.isInteger(Number(plan.visits)) || Number(plan.visits) < 1)
  )
    return {
      step: 'Срок и визиты',
      message: 'Для пакета укажите положительное целое число посещений.',
    };
  if (plan.price === '' || plan.price === undefined)
    return { step: 'Продажа', message: 'Укажите цену перед публикацией.' };
  return null;
}
