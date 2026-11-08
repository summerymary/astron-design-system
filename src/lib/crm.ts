import type { DemoRecord } from '../data/workspace';

export const specialLeadStages = ['Нет ответа', 'Отказ'];
export const parseStages = (value: string) =>
  value
    .split(/\r?\n/)
    .map((stage) => stage.trim())
    .filter(Boolean);
export const mainScenarioStages = (value: string) =>
  parseStages(value).filter((stage) => !specialLeadStages.includes(stage));
export const stageMeaning = (stage: string) =>
  ({
    Новая: 'Человек оставил заявку. Нужно впервые связаться с ним.',
    Связались: 'Обсудили запрос клиента. Договоритесь о следующем действии.',
    'Пробное назначено': 'Выбрали дату первого занятия. Подтвердите визит с клиентом.',
    'Пробное пройдено': 'Первое занятие состоялось. Узнайте впечатления и предложите абонемент.',
    Покупка: 'Обращение успешно завершено. Клиент выбрал покупку.',
    'Нет ответа': 'Не удалось связаться. Назначьте повторный звонок или сообщение.',
    Отказ: 'Клиент отказался. Сохраните причину и завершите обращение.',
  })[stage] || 'Свой статус обработки заявки. Укажите следующее действие и ответственного.';
export const stageAction = (stage: string) =>
  ({
    Связались: 'Удалось связаться',
    'Нет ответа': 'Пока не отвечает',
    'Пробное назначено': 'Назначить пробное',
    'Пробное пройдено': 'Отметить пробное посещение',
    Покупка: 'Отметить покупку',
  })[stage] || `Перевести в «${stage}»`;

export function scenarioIssue(
  draft: DemoRecord,
  original: DemoRecord | null,
  scenarios: DemoRecord[],
  leads: DemoRecord[],
): string | null {
  if (!draft.name.trim()) return 'Укажите название сценария.';
  if (
    scenarios.some(
      (row) =>
        row.id !== draft.id &&
        row.name.trim().toLocaleLowerCase('ru') === draft.name.trim().toLocaleLowerCase('ru'),
    )
  )
    return 'Сценарий с таким названием уже есть.';
  const stages = parseStages(draft.stages);
  if (mainScenarioStages(draft.stages).length < 2) return 'Добавьте хотя бы два основных статуса.';
  if (new Set(stages.map((stage) => stage.toLocaleLowerCase('ru'))).size !== stages.length)
    return 'Названия статусов не должны повторяться.';
  if (original && stages[0] !== parseStages(original.stages)[0])
    return 'Первый статус существующего сценария сохраняется.';
  if (original) {
    const inUse = leads.filter((lead) => lead.pipeline === original.name);
    const missing = inUse.find((lead) => lead.stage !== 'Отказ' && !stages.includes(lead.stage));
    if (missing)
      return `Статус «${missing.stage}» используется в заявках. Сначала завершите работу с ними или перенесите их в другой статус.`;
  }
  return null;
}
