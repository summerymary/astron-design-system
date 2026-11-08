import { useCallback, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Plus, Settings2, X } from 'lucide-react';
import { Button, Modal } from '../components/ui';
import { Select } from '../components/Select';
import { Empty, Notice, SearchBox, Status } from '../components/WorkspaceUI';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import type { DemoRecord } from '../data/workspace';
import {
  mainScenarioStages,
  parseStages,
  scenarioIssue,
  specialLeadStages,
  stageMeaning,
} from '../lib/crm';
import '../styles/crm.css';

export function CrmScenarios({ onLeads }: { onLeads: (pipeline: string, stage: string) => void }) {
  const { data, put } = useWorkspace();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<DemoRecord | null>(null);
  const [stageRows, setStageRows] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const close = useCallback(() => {
    setDraft(null);
    setError('');
  }, []);
  const original = data.pipelines.find((row) => row.id === draft?.id) || null;
  const open = (scenario?: DemoRecord) => {
    const record = scenario || {
      id: demoId('scenario'),
      name: '',
      description: '',
      stages: 'Новая\nСвязались\nПокупка',
      status: 'Активна',
    };
    setDraft({ ...record });
    setStageRows(parseStages(record.stages));
    setError('');
  };
  const move = (index: number, direction: number) => {
    const target = index + direction;
    if (target < (original ? 1 : 0) || target >= stageRows.length) return;
    const next = [...stageRows];
    [next[index], next[target]] = [next[target], next[index]];
    setStageRows(next);
  };
  const save = () => {
    if (!draft) return;
    if (stageRows.some((stage) => !stage.trim())) {
      setError('Укажите название каждого статуса или удалите пустую строку.');
      return;
    }
    const next = {
      ...draft,
      name: draft.name.trim(),
      stages: stageRows.map((stage) => stage.trim()).join('\n'),
    };
    const problem = scenarioIssue(next, original, data.pipelines, data.leads);
    if (problem) {
      setError(problem);
      return;
    }
    if (original && original.name !== next.name)
      data.leads
        .filter((lead) => lead.pipeline === original.name)
        .forEach((lead) => put('leads', { ...lead, pipeline: next.name }));
    put('pipelines', next);
    close();
    setMessage('Сценарий сохранён. Заявки и их текущие статусы сохранены.');
  };
  const scenarios = data.pipelines.filter((row) =>
    `${row.name} ${row.description || ''}`
      .toLocaleLowerCase('ru')
      .includes(query.toLocaleLowerCase('ru')),
  );
  return (
    <div className="ws-stack crm-scenarios">
      <div className="crm-section-intro">
        <p>
          <strong>Здесь задаётся порядок работы с заявками.</strong> Например: получили обращение →
          связались → пригласили на пробное занятие → оформили покупку.
        </p>
        <Button onClick={() => open()}>
          <Plus size={16} />
          Новый сценарий
        </Button>
      </div>
      <SearchBox
        value={query}
        onChange={setQuery}
        label="Поиск сценария"
        placeholder="Название сценария"
      />
      {message && <Notice tone="success">{message}</Notice>}
      {scenarios.map((scenario) => {
        const leads = data.leads.filter((lead) => lead.pipeline === scenario.name);
        const stages = mainScenarioStages(scenario.stages);
        return (
          <section className="panel ws-panel crm-scenario" key={scenario.id}>
            <div className="ws-panel-heading">
              <div>
                <h2>{scenario.name}</h2>
                <p>
                  {scenario.description ||
                    'Порядок работы с обращениями. Откройте статус, чтобы увидеть заявки.'}
                </p>
              </div>
              <Button variant="secondary" onClick={() => open(scenario)}>
                <Settings2 size={16} />
                Настроить
              </Button>
            </div>
            <div className="crm-scenario-meta">
              <Status>{scenario.status === 'Активна' ? 'Активен' : scenario.status}</Status>
              <span>Заявок: {leads.length}</span>
              <span>
                Завершились покупкой: {leads.filter((lead) => lead.stage === 'Покупка').length}
              </span>
            </div>
            <div className="ws-panel-body ws-stack">
              <div>
                <h3>Основной путь заявки</h3>
                <p className="crm-caption">
                  Каждый блок — текущий статус, а не отдельная задача. Откройте заявки, чтобы
                  увидеть людей и следующее действие.
                </p>
              </div>
              <ol className="crm-step-flow">
                {stages.map((stage, index) => (
                  <li key={stage}>
                    <span className="crm-step-number">{index + 1}</span>
                    <h4>{stage}</h4>
                    <p>{stageMeaning(stage)}</p>
                    <Button variant="ghost" onClick={() => onLeads(scenario.name, stage)}>
                      Заявки: {leads.filter((lead) => lead.stage === stage).length}
                      <ChevronRight size={16} />
                    </Button>
                  </li>
                ))}
              </ol>
              <section className="crm-exception-states">
                <h3>Если работа пошла иначе</h3>
                <p className="crm-caption">Эти статусы не нужно проходить по порядку.</p>
                <div>
                  {specialLeadStages
                    .filter(
                      (stage) =>
                        stage === 'Отказ' ||
                        parseStages(scenario.stages).includes(stage) ||
                        leads.some((lead) => lead.stage === stage),
                    )
                    .map((stage) => (
                      <article key={stage}>
                        <div>
                          <strong>{stage}</strong>
                          <p>{stageMeaning(stage)}</p>
                        </div>
                        <Button variant="secondary" onClick={() => onLeads(scenario.name, stage)}>
                          Заявки: {leads.filter((lead) => lead.stage === stage).length}
                          <ChevronRight size={16} />
                        </Button>
                      </article>
                    ))}
                </div>
              </section>
            </div>
          </section>
        );
      })}
      {!scenarios.length && (
        <Empty title="Сценарии не найдены" text="Измените поиск или добавьте новый сценарий." />
      )}
      {draft && (
        <Modal title={original ? 'Настроить сценарий' : 'Новый сценарий работы'} onClose={close}>
          <form
            className="ws-form crm-scenario-form"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <label className="form-field">
              <span>Название сценария</span>
              <input
                required
                value={draft.name}
                maxLength={120}
                placeholder="Например, Запись на пробное занятие"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="form-field">
              <span>Для чего нужен этот сценарий</span>
              <textarea
                value={draft.description || ''}
                maxLength={500}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <div>
              <h3>Статусы заявки по порядку</h3>
              <p className="crm-caption">
                Название объясняет, что уже произошло. Задачу «позвонить» или «написать» указывают
                отдельно в самой заявке.
              </p>
            </div>
            <ol className="crm-stage-editor">
              {stageRows.map((stage, index) => (
                <li key={index}>
                  <span className="crm-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <label className="form-field">
                    <span className="sr-only">Статус {index + 1}</span>
                    <input
                      required
                      maxLength={80}
                      value={stage}
                      readOnly={Boolean(original && index === 0)}
                      onChange={(e) =>
                        setStageRows(
                          stageRows.map((value, row) => (row === index ? e.target.value : value)),
                        )
                      }
                    />
                    {specialLeadStages.includes(stage) && (
                      <small>Особый статус, вне основного пути</small>
                    )}
                    {original && index === 0 && <small>Стартовый статус — сохраняется</small>}
                  </label>
                  <div className="crm-stage-controls">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Поднять статус ${index + 1}`}
                      disabled={index <= (original ? 1 : 0)}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Опустить статус ${index + 1}`}
                      disabled={index === stageRows.length - 1 || Boolean(original && index === 0)}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Убрать статус ${index + 1}`}
                      disabled={Boolean(original && index === 0)}
                      onClick={() => setStageRows(stageRows.filter((_, row) => row !== index))}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStageRows([...stageRows, ''])}
            >
              <Plus size={16} />
              Добавить статус
            </Button>
            {original && (
              <p className="crm-caption">
                Первый статус сохранён. Статус с действующими заявками нельзя удалить или
                переименовать.
              </p>
            )}
            <label className="form-field">
              <span>Доступность сценария</span>
              <Select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              >
                <option value="Активна">Активен</option>
                <option>В архиве</option>
              </Select>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={close}>
                Отмена
              </Button>
              <Button type="submit">Сохранить сценарий</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
