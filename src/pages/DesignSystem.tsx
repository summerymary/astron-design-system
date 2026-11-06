import { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Circle,
  Copy,
  Dumbbell,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { Avatar, Badge, Button, SectionTitle } from '../components/ui';
import { initialMembers } from '../data/mock';
import { LogoGuidelines } from '../components/LogoGuidelines';
import { ThemePlayground } from '../components/ThemePlayground';
import { useTheme } from '../components/ThemeProvider';
import { contrastRatio } from '../lib/theme';
import type { ThemeToken } from '../lib/theme';

const palette = [
  {
    name: 'Главное действие',
    description: 'Главные кнопки и их состояния',
    token: '--color-action',
    dark: true,
  },
  {
    name: 'Мягкий акцент',
    description: 'Светлое выделение выбранного элемента',
    token: '--color-accent-soft',
    dark: false,
  },
  {
    name: 'Основной текст',
    description: 'Заголовки, имена и важные данные',
    token: '--color-ink',
    dark: true,
  },
  {
    name: 'Вторичный текст',
    description: 'Подсказки и пояснения',
    token: '--color-muted',
    dark: true,
  },
  {
    name: 'Фон приложения',
    description: 'Фон между карточками и разделами',
    token: '--color-canvas',
    dark: false,
  },
  {
    name: 'Фон карточки',
    description: 'Таблицы, формы и отдельные блоки',
    token: '--color-surface',
    dark: false,
  },
  {
    name: 'Разделители',
    description: 'Границы строк и карточек',
    token: '--color-line',
    dark: false,
  },
  {
    name: 'Граница поля',
    description: 'Контур поля для ввода данных',
    token: '--color-control-border',
    dark: true,
  },
] as const;
const semanticPalette = [
  { name: 'Успех', token: '--color-success', className: 'semantic-success' },
  { name: 'Внимание', token: '--color-warning', className: 'semantic-warning' },
  { name: 'Ошибка', token: '--color-danger', className: 'semantic-danger' },
  { name: 'Информация', token: '--color-info', className: 'semantic-info' },
] as const;

export function DesignSystem({ onNotify }: { onNotify: (text: string) => void }) {
  const { palette: theme } = useTheme();
  const themeColor = (token: ThemeToken) => theme.tokens[token];
  const [category, setCategory] = useState('foundations');
  const [toggle, setToggle] = useState(true);
  const [checked, setChecked] = useState(true);
  const [tab, setTab] = useState('Все');
  const [input, setInput] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('Безлимит');
  const colors = palette.map((color) => ({ ...color, value: themeColor(color.token) }));
  const copyColor = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      onNotify(`${value} скопирован`);
    } catch {
      onNotify(`Цвет: ${value}`);
    }
  };
  return (
    <div className="design-system">
      <p className="ds-intro">
        Здесь собраны правила оформления системы. Выберите раздел, чтобы посмотреть образцы и
        узнать, где их использовать.
      </p>
      <div className="ds-categories" aria-label="Категории дизайн-системы">
        {[
          { id: 'foundations', label: 'Основы', number: '01' },
          { id: 'branding', label: 'Логотипы', number: '02' },
          { id: 'components', label: 'Кнопки и поля', number: '03' },
          { id: 'patterns', label: 'Готовые блоки', number: '04' },
        ].map((c) => (
          <button
            key={c.id}
            className={category === c.id ? 'selected' : ''}
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
          >
            <span>{c.number}</span>
            {c.label}
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
      {category === 'branding' && <LogoGuidelines />}
      {category === 'foundations' && (
        <>
          <ThemePlayground onNotify={onNotify} />
          <section className="ds-section">
            <SectionTitle
              title="Цвета"
              subtitle="Нажмите на образец, чтобы скопировать код цвета. Под каждым цветом указано, для чего он нужен."
              action={<span className="ds-section-number">01 / ЦВЕТА</span>}
            />
            <div className="color-grid">
              {colors.map((c) => (
                <button
                  key={c.name}
                  className="color-card"
                  onClick={() => void copyColor(c.value)}
                  aria-label={`Скопировать цвет ${c.name} ${c.value}`}
                >
                  <span
                    className={`color-swatch ${contrastRatio('#FFFFFF', c.value) >= 4.5 ? 'swatch-dark' : ''}`}
                    style={{ background: c.value }}
                  >
                    <Copy size={15} />
                  </span>
                  <strong>{c.name}</strong>
                  <span className="color-code">{c.value}</span>
                  <small className="color-purpose">{c.description}</small>
                </button>
              ))}
            </div>
            <div className="semantic-colors">
              {semanticPalette.map((color) => (
                <span key={color.token}>
                  <i className={color.className} />
                  {color.name}
                  <code>{themeColor(color.token)}</code>
                </span>
              ))}
            </div>
            <div className="palette-guidance">
              <div>
                <span className="palette-action-demo">
                  Основное действие <ArrowRight size={15} />
                </span>
                <h3>Главная кнопка</h3>
                <p>
                  Главные кнопки используют фирменный цвет или его читаемый оттенок. Для яркого
                  лайма предусмотрен тёмный текст и графитовый дополнительный цвет.
                </p>
              </div>
              <div>
                <span className="palette-status-demo">
                  <Check size={14} />
                  Успешно
                </span>
                <h3>Цвета статусов</h3>
                <p>
                  Цвет и подпись вместе объясняют состояние: всё в порядке, требуется внимание или
                  произошла ошибка.
                </p>
              </div>
              <div>
                <span className="palette-contrast-demo">
                  {contrastRatio(
                    themeColor('--color-on-action'),
                    themeColor('--color-action'),
                  ).toFixed(1)}
                  :1
                </span>
                <h3>Читаемый текст</h3>
                <p>
                  Контраст текста на главной кнопке. Вторичный текст на белом —{' '}
                  {contrastRatio(
                    themeColor('--color-muted'),
                    themeColor('--color-surface'),
                  ).toFixed(1)}
                  :1. Чем выше это число, тем лучше различимы текст и фон. При переходе клавишей Tab
                  вокруг кнопки или поля появляется рамка.
                </p>
                <a
                  href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Подробнее о читаемости текста <ArrowRight size={12} />
                </a>
              </div>
            </div>
          </section>
          <section className="ds-section">
            <SectionTitle
              title="Шрифты"
              subtitle="Размер и толщина текста зависят от его назначения. Ниже — текст-рыба для сравнения образцов."
              action={<span className="ds-section-number">02 / ШРИФТЫ</span>}
            />
            <div className="type-panel">
              <div className="type-intro">
                <span>Аа</span>
                <strong>Системный шрифт</strong>
                <p>
                  Привычный шрифт устройства
                  <br />
                  Поддержка русского текста
                </p>
                <div>
                  Обычный <span>Средний</span> <b>Полужирный</b>
                </div>
              </div>
              <div className="type-specimens">
                {[
                  {
                    name: 'Крупный заголовок',
                    size: '40 px · полужирный',
                    text: 'Равным образом',
                    className: 'type-display',
                  },
                  {
                    name: 'Заголовок страницы',
                    size: '28 px · полужирный',
                    text: 'Повседневная практика',
                    className: 'type-h1',
                  },
                  {
                    name: 'Заголовок раздела',
                    size: '18 px · полужирный',
                    text: 'Разнообразный и богатый опыт',
                    className: 'type-h2',
                  },
                  {
                    name: 'Обычный текст',
                    size: '14 px · обычный',
                    text: 'Равным образом, дальнейшее развитие различных форм деятельности играет важную роль в формировании новых предложений.',
                    className: 'type-body',
                  },
                  {
                    name: 'Подпись',
                    size: '12 px · обычный',
                    text: 'С другой стороны, постоянное развитие позволяет оценить значение новых идей.',
                    className: 'type-caption',
                  },
                ].map((t) => (
                  <div className="type-row" key={t.name}>
                    <div>
                      <strong>{t.name}</strong>
                      <code>{t.size}</code>
                    </div>
                    <span className={t.className}>{t.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <div className="ds-two-columns">
            <section className="ds-section">
              <SectionTitle
                title="Отступы"
                subtitle="Расстояние между элементами. Близкие по смыслу элементы располагаются рядом, отдельные разделы — дальше друг от друга."
              />
              <div className="spacing-examples">
                {[4, 8, 12, 16, 24, 32, 48].map((n) => (
                  <div key={n}>
                    <code>{n.toString().padStart(2, '0')}</code>
                    <span style={{ width: n * 3 }} />
                    <small>{n} px</small>
                  </div>
                ))}
              </div>
            </section>
            <section className="ds-section">
              <SectionTitle
                title="Скругления"
                subtitle="Углы кнопок и карточек закругляются одинаково на всех экранах."
              />
              <div className="radius-examples">
                {[
                  { n: 6, label: 'Небольшое' },
                  { n: 10, label: 'Кнопки' },
                  { n: 16, label: 'Карточки' },
                  { n: 999, label: 'Круглое' },
                ].map((r) => (
                  <div key={r.n}>
                    <span style={{ borderRadius: r.n }} />
                    <strong>{r.label}</strong>
                    <code>{r.n === 999 ? 'Полностью' : `${r.n} px`}</code>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
      {category === 'components' && (
        <>
          <section className="ds-section">
            <SectionTitle
              title="Кнопки"
              subtitle="Главное действие выделяется цветом. Остальные кнопки выглядят спокойнее, чтобы не отвлекать."
              action={<span className="ds-section-number">01 / КНОПКИ</span>}
            />
            <div className="component-panel buttons-showcase">
              <div>
                <span className="example-label">Главная кнопка</span>
                <Button onClick={() => onNotify('Основное действие выполнено')}>
                  <Plus size={16} />
                  Добавить клиента
                </Button>
              </div>
              <div>
                <span className="example-label">Обычная кнопка</span>
                <Button variant="secondary" onClick={() => onNotify('Изменения сохранены')}>
                  <Check size={16} />
                  Сохранить
                </Button>
              </div>
              <div>
                <span className="example-label">Кнопка без фона</span>
                <Button variant="ghost" onClick={() => onNotify('Дополнительное действие')}>
                  Подробнее
                  <ArrowRight size={16} />
                </Button>
              </div>
              <div>
                <span className="example-label">Недоступная кнопка</span>
                <Button disabled>Недоступно</Button>
              </div>
            </div>
          </section>
          <section className="ds-section">
            <SectionTitle
              title="Поля ввода и переключатели"
              subtitle="Название поля объясняет, что ввести. Подсказка помогает заполнить его, а ошибка показывается рядом."
              action={<span className="ds-section-number">02 / ВВОД ДАННЫХ</span>}
            />
            <div className="component-panel inputs-showcase">
              <label className="form-field">
                <span>Имя клиента</span>
                <input
                  placeholder="Например, Анна Смирнова"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <small>Имя и фамилия, как удобно клиенту.</small>
              </label>
              <label className="form-field">
                <span>Абонемент</span>
                <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}>
                  <option>Безлимит</option>
                  <option>Дневной</option>
                  <option>12 занятий</option>
                </select>
              </label>
              <label className="form-field field-error">
                <span>Email</span>
                <input defaultValue="anna@" aria-invalid="true" aria-describedby="ds-email-error" />
                <small id="ds-email-error">Пример ошибки: проверьте адрес почты.</small>
              </label>
              <div className="selection-examples">
                <button
                  className="toggle-field"
                  role="switch"
                  aria-checked={toggle}
                  onClick={() => setToggle(!toggle)}
                >
                  <span className={`toggle ${toggle ? 'on' : ''}`} />
                  Уведомления
                </button>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                  />
                  Показывать в списке
                </label>
              </div>
            </div>
          </section>
          <div className="ds-two-columns">
            <section className="ds-section">
              <SectionTitle
                title="Статусы и инициалы"
                subtitle="Подпись показывает состояние абонемента. Буквы имени и фамилии используются, когда нет фотографии клиента."
              />
              <div className="component-panel">
                <div className="badge-examples">
                  <Badge status="active" />
                  <Badge status="expiring" />
                  <Badge status="paused" />
                </div>
                <div className="avatar-examples">
                  {initialMembers.slice(0, 5).map((m) => (
                    <Avatar key={m.id} member={m} />
                  ))}
                </div>
              </div>
            </section>
            <section className="ds-section">
              <SectionTitle
                title="Иконки"
                subtitle="Значки дополняют подписи и помогают быстрее узнавать действия. На одном экране используются значки одного размера."
              />
              <div className="component-panel icon-examples">
                {[
                  LayoutGrid,
                  Users,
                  Dumbbell,
                  Search,
                  Plus,
                  CheckCheck,
                  Sparkles,
                  ChevronDown,
                  Circle,
                ].map((Icon, i) => (
                  <span key={i}>
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
      {category === 'patterns' && (
        <>
          <section className="ds-section">
            <SectionTitle
              title="Готовые блоки"
              subtitle="Примеры из нескольких элементов, которые повторяются на разных страницах."
              action={<span className="ds-section-number">01 / ПРИМЕРЫ</span>}
            />
            <div className="pattern-grid">
              <div className="pattern-example">
                <span className="example-label">Строка клиента</span>
                <button
                  className="pattern-member"
                  onClick={() => onNotify('Пример строки клиента')}
                >
                  <Avatar member={initialMembers[0]} />
                  <span>
                    <strong>Анна Смирнова</strong>
                    <small>Безлимит · #1001</small>
                  </span>
                  <Badge status="active" />
                </button>
              </div>
              <div className="pattern-example">
                <span className="example-label">Карточка показателя</span>
                <div className="pattern-stat">
                  <span>
                    Активные клиенты
                    <Users size={16} />
                  </span>
                  <strong>1 248</strong>
                  <small>↗ 12,8% за этот месяц</small>
                </div>
              </div>
              <div className="pattern-example">
                <span className="example-label">Переключатель списка</span>
                <div className="small-segment">
                  {['Все', 'Активные', 'Истекают'].map((t) => (
                    <button
                      key={t}
                      className={tab === t ? 'selected' : ''}
                      aria-pressed={tab === t}
                      onClick={() => setTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <p className="pattern-hint">Выбрано: {tab.toLowerCase()}</p>
              </div>
              <div className="pattern-example">
                <span className="example-label">Уведомление об успехе</span>
                <div className="inline-success">
                  <Check size={18} />
                  <div>
                    <strong>Клиент добавлен</strong>
                    <p>Теперь можно оформить абонемент.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <div className="ds-note">
            <Sparkles size={22} />
            <div>
              <strong>Одинаковые элементы работают одинаково</strong>
              <p>
                Кнопки, поля ввода и сообщения используют одни правила на всех экранах. Это помогает
                быстрее ориентироваться в системе.
              </p>
            </div>
          </div>
        </>
      )}
      <div className="ds-footer">
        <span>Астрон · правила оформления</span>
        <span>
          Образцы для проверки дизайна <span>↗</span>
        </span>
      </div>
    </div>
  );
}
