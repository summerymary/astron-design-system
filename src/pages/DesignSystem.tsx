import { Select } from '../components/Select';
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
import { Avatar, Badge, Button, SectionTitle, Switch } from '../components/ui';
import { initialMembers } from '../data/mock';
import { LogoGuidelines } from '../components/LogoGuidelines';
import { ThemePlayground } from '../components/ThemePlayground';
import { DesignRules } from '../components/DesignRules';
import { useTheme } from '../components/ThemeProvider';
import { contrastRatio } from '../lib/theme';
import { OCCUPANCY_SCALE, TRAINING_INTENSITIES } from '../lib/schedule';
import type { ThemeToken } from '../lib/theme';
import { membershipKinds, quantityLabel } from '../data/membership-kinds';
import { MembershipTag } from '../components/MembershipTag';
import { MembershipCard } from '../components/MembershipCard';
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
  const { tokens, visualStyle } = useTheme();
  const themeColor = (token: ThemeToken) => tokens[token];
  const [category, setCategory] = useState('foundations');
  const [toggle, setToggle] = useState(true);
  const [checked, setChecked] = useState(true);
  const [tab, setTab] = useState('Все');
  const [input, setInput] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('Железная карта');
  const colors = palette.map((color) => ({ ...color, value: themeColor(color.token) }));
  const contrastRules: Record<string, string> = {
    'Фон и границы':
      'Серый фон отделяет белые рабочие блоки. У блоков заметная бордово-серая рамка, у полей — более тёмный контур. Шапки таблиц и групп сведений залиты серым, а линии между строками не растворяются в белом. Цвета статусов и абонементов сохраняют свой смысл.',
    'Действия в шапке':
      'Новый клиент, расписание и товары находятся рядом с крупным поиском. У кнопок заметный контур, добавление клиента выделено акцентом. Порядок одинаков в обоих оформлениях; правая панель не занимает рабочую область.',
    'Списки и таблицы':
      'Те же колонки и строки от 44 px, что в Астроне. Тёмный текст на белом, серая шапка, чередование светлых строк и мягкая подсветка всей строки при наведении. Любая свободная часть строки открывает карточку; кнопки доступны с клавиатуры.',
    'Рабочая строка страницы':
      'Название, возврат и действия сохраняют привычные позиции. Заголовки чуть выразительнее по начертанию. Дополнительные декоративные подписи не добавляются.',
  };
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
      <div className="ds-categories" aria-label="Категории дизайн-системы">
        {[
          { id: 'foundations', label: 'Основы', number: '01' },
          { id: 'branding', label: 'Логотипы', number: '02' },
          { id: 'components', label: 'Кнопки и поля', number: '03' },
          { id: 'patterns', label: 'Готовые блоки', number: '04' },
          { id: 'rules', label: 'Единые правила', number: '05' },
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
      {category === 'rules' && <DesignRules />}
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
            <div className="ds-training-colors">
              <h3>Интенсивность занятий</h3>
              <p>
                Зелёный — низкая нагрузка, жёлтый — средняя, красный — высокая. Цвет не обозначает
                наличие мест или отмену. В окне занятия интенсивность написана словами; в календаре
                есть легенда.
              </p>
              <div className="calendar-intensity-legend">
                {TRAINING_INTENSITIES.map((item) => (
                  <span key={item.value}>
                    <i style={{ background: item.color }} />
                    {item.label}
                    <code>{item.color}</code>
                  </span>
                ))}
              </div>
            </div>
            <div className="ds-occupancy-colors">
              <h3>Заполняемость у директоров</h3>
              <p>
                Чем темнее занятие, тем больше мест занято. Рядом всегда указан процент и число
                записанных. Отменённые занятия не входят в сводку. Интенсивность можно включить
                отдельно.
              </p>
              <div className="calendar-occupancy-legend">
                {OCCUPANCY_SCALE.map((item) => (
                  <span key={item.min}>
                    <i style={{ background: item.background, borderColor: item.line }} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="ds-membership-colors">
              <h3>Цвета карточек абонементов</h3>
              <p>
                Цветом заполняется вся карточка. Он помогает различать назначения услуг; состояние
                «Действует» или «Истёк» показывается отдельно. Это примеры оформления, а не
                ограничение числа тарифов: названия, категории и условия могут быть любыми.
              </p>
              <div className="membership-kind-grid">
                {membershipKinds.map((kind) => (
                  <div
                    className="membership-kind-card"
                    key={kind.id}
                    style={{
                      background: kind.background === 'transparent' ? '#F8F9F5' : kind.background,
                      color: kind.foreground,
                      borderColor: kind.line,
                    }}
                  >
                    <MembershipTag name={kind.name} kindId={kind.id} textOnly />
                    <p>
                      {kind.description} · {kind.colorName.toLowerCase()}
                    </p>
                    <code>
                      Текст {kind.foreground}
                      <br />
                      Фон {kind.background === 'transparent' ? '#F8F9F5' : kind.background}
                    </code>
                  </div>
                ))}
              </div>
              <h3>Карты для выбора абонемента</h3>
              <p>
                Часы доступа и возраст показываются словами рядом с картой. Вне разрешённого времени
                или возраста карта недоступна; рядом указана причина. Для предзаписи подходящий
                абонемент выделяется рамкой и подписью, а окончательное списание требует
                подтверждения.
              </p>
              <p>
                Крупная карта помогает выбрать абонемент: на ней название, назначение, срок или
                остаток посещений. В карточке клиента абонементы показаны компактным списком:
                название, статус, срок и остаток, а подробности раскрываются по нажатию. В журнале
                посещений используем только цветные буквы, чтобы строки оставались компактными.
              </p>
              <div className="plastic-card-grid">
                {membershipKinds.map((kind) => (
                  <MembershipCard
                    key={kind.id}
                    name={kind.name}
                    kindId={kind.id}
                    detail={quantityLabel(kind.duration, 'day')}
                    footer={
                      kind.type === 'Безлимитный'
                        ? 'Без ограничений'
                        : quantityLabel(kind.visits, 'visit')
                    }
                  />
                ))}
              </div>
              <div className="component-panel">
                {membershipKinds.map((kind) => (
                  <MembershipTag key={kind.id} name={kind.name} kindId={kind.id} textOnly />
                ))}
              </div>
              <p>
                Всегда сохраняются название и значок: услугу можно узнать без различения цветов. В
                других темах цвета карт остаются прежними. Гостевой визит показан очень светлым.
                Каталог и продажа используют одинаковые разделы: абонементы, персональный тренинг,
                корпоративные абонементы, исключения, товары и услуги. Раздел определяет место
                предложения в каталоге, а цвет карты можно выбрать отдельно.
              </p>
            </div>
            <div className="palette-guidance">
              <div>
                <span className="palette-action-demo">
                  Основное действие <ArrowRight size={15} />
                </span>
                <h3>Главная кнопка</h3>
                <p>
                  {
                    'Главные кнопки используют фирменный цвет или его читаемый оттенок. Для светлых ярких кнопок подбирается тёмный текст.'
                  }
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
              subtitle={
                'Основной текст — 16 px, подписи — от 14 px. На телефоне текст не уменьшается. Ниже — текст-рыба для сравнения образцов.'
              }
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
                    size: '44 px · полужирный',
                    text: 'Равным образом',
                    className: 'type-display',
                  },
                  {
                    name: 'Заголовок справочной страницы',
                    size: '32 px · полужирный',
                    text: 'Повседневная практика',
                    className: 'type-h1',
                  },
                  {
                    name: 'Название рабочего экрана',
                    size: '20 px · полужирный',
                    text: 'Повседневная практика',
                    className: 'type-h2',
                  },
                  {
                    name: 'Заголовок раздела',
                    size: '20 px · полужирный',
                    text: 'Разнообразный и богатый опыт',
                    className: 'type-h2',
                  },
                  {
                    name: 'Обычный текст',
                    size: '16 px · обычный',
                    text: 'Равным образом, дальнейшее развитие различных форм деятельности играет важную роль в формировании новых предложений.',
                    className: 'type-body',
                  },
                  {
                    name: 'Подпись',
                    size: '14 px · обычный',
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
                  {
                    n: 10,
                    label: 'Кнопки',
                  },
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
                <span>Фамилия, имя, отчество</span>
                <input
                  placeholder="Смирнова Анна Андреевна"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <small>Полное ФИО клиента.</small>
              </label>
              <label className="form-field">
                <span>Абонемент</span>
                <Select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}>
                  {membershipKinds.map((kind) => (
                    <option key={kind.id}>{kind.name}</option>
                  ))}
                </Select>
                <small>
                  Стрелки — выбор, Enter — подтвердить, Escape — закрыть. В длинных списках
                  появляется поиск.
                </small>
              </label>
              <label className="form-field field-error">
                <span>Email</span>
                <input defaultValue="anna@" aria-invalid="true" aria-describedby="ds-email-error" />
                <small id="ds-email-error">Пример ошибки: проверьте адрес почты.</small>
              </label>
              <div className="selection-examples">
                <Switch checked={toggle} onChange={setToggle} label="Уведомления" />
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
              title="Меню по сегментам"
              subtitle="Сначала основные рабочие задачи. Детальные настройки доступны внутри разделов, а не длинным списком слева."
            />
            <nav className="ds-sidebar-example" aria-label="Пример бокового меню">
              <details className="nav-accordion">
                <summary>Занятия и тренеры</summary>
                <button>Расписание</button>
                <button>Персональные клиенты</button>
              </details>
              <details className="nav-accordion">
                <summary>Клиенты и продажи</summary>
                <button>Регистрация посещения</button>
                <button>Продажа услуг</button>
              </details>
            </nav>
            <p>
              Группы по умолчанию свёрнуты, без рамок и отдельных подложек. Строки — от 44 px,
              промежутки между группами — 4 px. При переходе раскрывается текущий сегмент. Заголовок
              целиком нажимается, стрелка стоит справа с отступом, выбранный пункт имеет мягкую
              фирменную подложку. Управление — мышью, Enter или пробелом; видимая рамка показывает
              фокус.
            </p>
            <h3>Регистрация посещения</h3>
            <p>
              Поиск по телефону, ФИО или карте → выбор клиента → «Зарегистрировать посещение» →
              выбор доступного абонемента → подтверждение. До подтверждения посещение не создаётся.
              Рядом — продажа абонементов, товаров, услуг и персонального тренинга.
            </p>
          </section>
          <section className="ds-section">
            <SectionTitle
              title="Правила рабочих экранов"
              subtitle="Помогают быстро находить нужное и не совершать действие случайно."
            />
            <div className="ds-work-rules">
              {[
                [
                  'Навигация',
                  'Левое меню сворачивается кнопкой в узкую панель иконок. Кнопка остаётся в одном месте в обоих состояниях. У иконок остаются подписи для программ чтения и подсказки при наведении. Повторное нажатие возвращает названия. На телефоне основные пункты находятся внизу. У вложенного экрана есть понятный возврат.',
                ],
                [
                  'Рабочая строка страницы',
                  'Название экрана, возврат и основное действие занимают одну короткую строку от 44 px. Название — 20 px. Подзаголовки, слоганы и повтор роли или даты не добавляются. Поиск, таблица или форма начинаются сразу ниже. Во вкладках название не повторяется над содержимым. Пояснения остаются рядом с полем или действием, когда помогают его выполнить.',
                ],
                [
                  'Карточка клиента',
                  'Первыми идут абонементы, посещения и финансы. ФИО включает отчество. Подписи светлее значений, основные сведения крупнее. У администратора телефон скрыт, рядом кнопка демозвонка; управляющим номер открыт. Комментарии сохраняются в истории, один важный можно закрепить в карточке. Наличие личного кабинета и приложения находится в информации.',
                ],
                [
                  'Рабочая страница в пределах экрана',
                  'На компьютере шапка с действиями и название страницы остаются на месте. Длинные таблицы, формы и сведения прокручиваются внутри рабочей области, а в чатах — внутри истории. Поле ответа остаётся снизу. Шрифты не уменьшаются ради размещения данных. На телефоне и маленьком окне сохраняется обычная прокрутка.',
                ],
                [
                  'Одинаковая рабочая область',
                  'Правая панель убрана. Рабочие страницы администратора ограничены по ширине и расположены в центре; расписанию оставлено больше места для залов. Крупный поиск и основные действия остаются в общей шапке. На телефоне кнопки располагаются строками под поиском.',
                ],
                [
                  'Переписка',
                  'Входящие и исходящие сообщения различаются расположением и мягкой подложкой. У каждого есть время, у исходящих — подпись «Отправлено», «Доставлено» или «Прочитано» и галочки. Сообщение клуба можно изменить или удалить через меню. Изменение отмечается подписью, удаление требует подтверждения. Если диалог связан с клиентом, из шапки открывается его карточка.',
                ],
                [
                  'Действия в шапке',
                  'Крупный поиск — основная зона администратора. Рядом по порядку находятся новый клиент, расписание и товары; отдельных кнопок посещения и продажи в шапке нет. На телефоне новый клиент занимает отдельную строку, расписание и товары расположены рядом ниже. Продажа доступна в карточке клиента и каталоге разделов. Левое меню администратора открыто по умолчанию; иконки сохраняют положение при сворачивании.',
                ],
                [
                  'Меню на телефоне',
                  'Текущий раздел выделяется акцентным цветом, более жирной подписью и утолщённой иконкой. Цветная подложка не используется. Размер и положение пунктов при переходе сохраняются.',
                ],
                [
                  'Поиск клиента',
                  'Карта, ФИО и телефон ищутся в одном поле. Поиск в шапке открывает карточку. Посещение создаётся только после отдельного подтверждения.',
                ],
                [
                  'Резерв занятия',
                  'Когда места закончились, клиента можно добавить в отдельный резерв. Абонемент при этом не списывается. Если место освободилось, администратор сразу видит уведомление и открывает нужное занятие. Перевод из резерва подтверждается вручную.',
                ],
                [
                  'Клиенты младше 14 лет',
                  'В карточке и при регистрации показано предупреждение о сопровождении. Подходящая персональная запись проверяется по базе тренеров. Если её нет, администратор подтверждает, что клиент занимается с тренером или ответственным взрослым. Возрастные ограничения абонемента сохраняются.',
                ],
                [
                  'Списки и таблицы',
                  'Основной текст — 16 px, подписи — не меньше 14 px. В таблицах строки от 44 px и могут расти, чтобы текст не обрезался. На телефоне используются карточки с удобными кнопками.',
                ],
                [
                  'Расписание',
                  'По умолчанию показан день, все залы и масштаб «Весь день». Время не дублируется в плитках: оно видно по сетке и в окне занятия. Администратор выбирает клуб расписания независимо от рабочего места, отменяет занятия и управляет записями и присутствием клиентов. Добавление, удаление и перенос занятий ему недоступны. На телефоне фильтры раскрываются по кнопке.',
                ],
                [
                  'Перенос тренировки',
                  'Управляющие роли и тренер для своих персональных занятий могут менять расписание. После перетаскивания показываются прежние и новые дата, время и зал. Изменение применяется после подтверждения. Пересечения по залу и тренеру проверяются. Та же операция доступна через кнопку в карточке занятия.',
                ],
                [
                  'База тренировок',
                  'Шаблон заполняет название, длительность, тренера, зал, вместимость и условия записи. Перед добавлением эти данные можно проверить. Изменение отдельного занятия не меняет сам шаблон.',
                ],
                [
                  'Спокойный интерфейс',
                  'Между разделами оставляется 28–32 px, внутри крупных блоков — 28 px. На телефоне отступы сокращаются до 20 px. Показатели стоят в одной спокойной строке, без отдельной рамки вокруг каждого числа. Акцентный цвет выделяет главное действие, а выбранный пункт меню — мягкая подложка. Текст остаётся от 14 px, основной — 16 px. Строки клиентов сохраняют компактность, расписание — комфортный масштаб.',
                ],
                [
                  'Рабочее место тренера',
                  'Тренер видит свои занятия, добавляет персональную тренировку с одним клиентом и делает заметки о закреплённых клиентах. Время проверяется по залу, тренеру и клиенту. Перенос применяется после подтверждения. Групповые занятия доступны для просмотра.',
                ],
                [
                  'Рабочее место бармена',
                  'Бармен открывает смену, собирает заказ, смотрит каталог и продажи бара. Корзина сохраняется при переходах между страницами. Редактирование каталога и общая касса клуба в этом рабочем месте не показываются.',
                ],
                [
                  'Формы',
                  'Подпись поля остаётся видимой. Для даты, числа и выбора используются подходящие поля. Ошибка появляется после проверки, рядом с формой. Отмена не сохраняет изменения.',
                ],
                [
                  'Выпадающие списки',
                  'Открываются в светлой панели с мягким акцентным выделением и галочкой у выбранного пункта. Пункты от 44 px. В списках длиннее семи вариантов есть поиск; при отсутствии совпадений выводится подсказка. Панель располагается в пределах экрана и не обрезается соседними блоками. Стрелки перемещают выбор, Enter подтверждает, Escape закрывает без изменения. Tab переводит к следующему полю.',
                ],
                [
                  'Статусы',
                  'Состояние объясняется словами: «Черновик», «Опубликован», «В архиве». Цвет помогает ориентироваться, но не заменяет подпись. Статус клиента и его абонемента различаются.',
                ],
                [
                  'Действия с последствиями',
                  'Перед регистрацией, продажей и проведением документа показываются данные для проверки. Удаление требует подтверждения с названием объекта.',
                ],
              ].map(([title, text]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{visualStyle === 'vivid' ? contrastRules[title] || text : text}</p>
                </article>
              ))}
            </div>
          </section>
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
                    <strong>Смирнова Анна Андреевна</strong>
                    <small>Железная карта · активен</small>
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
