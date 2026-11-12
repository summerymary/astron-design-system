import { useState } from 'react';
import { Edit3, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  CountBadge,
  DisclosureMenu,
  IconButton,
  SectionTitle,
  StatusBadge,
} from './ui';
import { Notice, SearchBox, Stats, Tabs } from './WorkspaceUI';
import { ClientSearch } from './ClientSearch';
import { initialMembers } from '../data/mock';
import { UI_RULES } from '../design-system/registry';
import { ReceptionShift } from './ReceptionShift';

export function DesignRules() {
  const [tab, setTab] = useState('Абонементы');
  const [mode, setMode] = useState('День');
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState('');
  const [exampleQuery, setExampleQuery] = useState('');
  return (
    <section className="ds-section ui-rules" aria-label="Единые правила интерфейса">
      <SectionTitle
        title="Одна задача — один элемент"
        subtitle="Эти правила действуют для всех страниц, ролей и тем. Ниже — рабочие компоненты, а не отдельные рисунки."
      />
      <Notice>
        Перед созданием нового элемента сначала выбирается существующий вариант. Если подходящего
        нет, его правила и пример добавляются сюда до повторного использования.
      </Notice>
      <div className="panel ws-panel-body ws-stack">
        <h3>Действия и состояния</h3>
        <div className="ws-actions">
          <Button>
            <Plus size={18} />
            Добавить
          </Button>
          <Button variant="secondary">Редактировать</Button>
          <Button variant="ghost">Отмена</Button>
          <Button variant="accent">Продать</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            <Trash2 size={18} />
            Удалить пример
          </Button>
          <Button disabled>Недоступно</Button>
          <IconButton label="Редактировать пример">
            <Edit3 size={18} />
          </IconButton>
          <DisclosureMenu
            label="Дополнительные действия примера"
            icon={<MoreHorizontal size={18} />}
          >
            <div>
              <button type="button" onClick={() => setResult('Дополнительное действие выбрано.')}>
                Открыть сведения
              </button>
            </div>
          </DisclosureMenu>
        </div>
        <div className="ws-actions" aria-label="Образцы статусов">
          <CountBadge>6</CountBadge>
          {[
            'Действует',
            'Ожидает оплаты',
            'Отменено',
            'В работе',
            'Заморожен',
            'Не активен',
            'Завершён',
          ].map((value) => (
            <StatusBadge key={value}>{value}</StatusBadge>
          ))}
        </div>
        {result && <Notice tone="success">{result}</Notice>}
        <h3>Разделы и режимы</h3>
        <Tabs
          items={['Абонементы', 'Посещения', 'Финансы']}
          value={tab}
          onChange={setTab}
          label="Пример вкладок"
        />
        <Tabs
          variant="segmented"
          items={['День', 'Неделя', 'Список']}
          value={mode}
          onChange={setMode}
          label="Пример режимов"
        />
      </div>
      <div className="panel ws-panel-body ws-stack">
        <h3>Показатели</h3>
        <Stats
          items={[
            { label: 'Клиенты сегодня', value: 42 },
            { label: 'Записи', value: 18 },
            { label: 'Продажи', value: '26 400 ₽' },
          ]}
        />
      </div>
      <div className="panel ws-panel-body ws-stack">
        <h3>Смена ресепшена</h3>
        <ReceptionShift
          shift={{ start: '2026-11-06T08:00', end: '2026-11-06T20:00' }}
          onOpen={() => setResult('В приложении откроется рабочий день сотрудника.')}
        />
      </div>
      <div className="panel ws-panel-body ws-stack ui-search-examples">
        <h3>Одинаковый поиск</h3>
        <p className="ui-rule-purpose">
          Единое оформление; поиск клиента дополнен подсказками и клавишей Enter. Для примера можно
          ввести 100001.
        </p>
        <div className="ws-fields">
          <SearchBox
            value={exampleQuery}
            onChange={setExampleQuery}
            placeholder="Поиск по записям"
            label="Пример поиска по записям"
          />
          <ClientSearch
            members={initialMembers}
            hidePhones
            onMember={(member) => setResult(`Выбран клиент: ${member.fullName || member.name}`)}
          />
        </div>
      </div>
      <div className="ui-rule-grid">
        {UI_RULES.map((rule) => (
          <article className="panel ws-panel-body" key={rule.id}>
            <h3>{rule.title}</h3>
            <p className="ui-rule-purpose">{rule.purpose}</p>
            <ul>
              {rule.rules.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      {confirm && (
        <ConfirmDialog
          title="Удалить пример?"
          subject="Демонстрационный элемент"
          description="Это пример общего подтверждения. Данные приложения не изменятся."
          confirmLabel="Удалить пример"
          cancelLabel="Оставить пример"
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            setResult('Пример подтверждения завершён. Данные приложения сохранены.');
          }}
        />
      )}
    </section>
  );
}
