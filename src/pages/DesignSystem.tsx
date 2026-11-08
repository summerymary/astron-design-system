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
  const { palette: theme } = useTheme();
  const themeColor = (token: ThemeToken) => theme.tokens[token];
  const [category, setCategory] = useState('foundations');
  const [toggle, setToggle] = useState(true);
  const [checked, setChecked] = useState(true);
  const [tab, setTab] = useState('Все');
  const [input, setInput] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('Железная карта');
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
            <div className="ds-membership-colors">
              <h3>Виды абонементов</h3>
              <p>
                Светлый фон и небольшая цветная подпись помогают различать услуги. Это не кнопки и
                не статусы. Главные действия сохраняют фирменный цвет клуба, а состояния «Действует»
                или «Истёк» показываются отдельно.
              </p>
              <div className="membership-kind-grid">
                {membershipKinds.map((kind) => (
                  <div className="membership-kind-card" key={kind.id}>
                    <MembershipTag name={kind.name} kindId={kind.id} />
                    <p>
                      {kind.description} · {kind.colorName.toLowerCase()}
                    </p>
                    <code>
                      Текст {kind.foreground}
                      <br />
                      Фон {kind.background === 'transparent' ? 'прозрачный' : kind.background}
                    </code>
                  </div>
                ))}
              </div>
              <h3>Карты для выбора абонемента</h3>
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
                других темах эти пять цветов остаются прежними. Гостевой визит показан без заливки,
                с тонким контуром.
              </p>
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
              subtitle="Основной текст — 16 px, подписи — от 14 px. На телефоне текст не уменьшается. Ниже — текст-рыба для сравнения образцов."
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
                  {membershipKinds.map((kind) => (
                    <option key={kind.id}>{kind.name}</option>
                  ))}
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
                  'Левое меню сворачивается кнопкой в узкую панель иконок. У иконок остаются подписи для программ чтения и подсказки при наведении. Повторное нажатие возвращает названия. На телефоне основные пункты находятся внизу. У вложенного экрана есть понятный возврат.',
                ],
                [
                  'Рабочая строка страницы',
                  'Название экрана, возврат и основное действие занимают одну короткую строку от 44 px. Название — 20 px. Подзаголовки, слоганы и повтор роли или даты не добавляются. Поиск, таблица или форма начинаются сразу ниже. Во вкладках название не повторяется над содержимым. Пояснения остаются рядом с полем или действием, когда помогают его выполнить.',
                ],
                [
                  'Карточка клиента',
                  'Сведения разделены на контакты, историю в клубе, тренировки и документы, связь и доступ. Тонкая линия отделяет одну строку от другой. Подпись стоит рядом со значением, на телефоне — над ним. Кнопка «Написать» открывает переписку именно с этим клиентом. Новый диалог сохраняется после первого сообщения.',
                ],
                [
                  'Быстрые действия',
                  'У быстрых переходов справа есть тонкая рамка, значок, название и короткое пояснение. Рамка помогает увидеть границы кнопки, а выделение при наведении и фокусе показывает, что её можно нажать.',
                ],
                [
                  'Поиск клиента',
                  'Карта, ФИО и телефон ищутся в одном поле. Поиск в шапке открывает карточку. Посещение создаётся только после отдельного подтверждения.',
                ],
                [
                  'Списки и таблицы',
                  'Основной текст — 16 px, подписи — не меньше 14 px. В таблицах строки от 44 px и могут расти, чтобы текст не обрезался. На телефоне используются карточки с удобными кнопками.',
                ],
                [
                  'Расписание',
                  'Основной вид — один день с широкими колонками и просторными строками. «Комфортно» подходит для работы, «Весь день» — для общего обзора. Занятия не скрываются за счётчиком. На телефоне фильтры раскрываются по кнопке, а календарь прокручивается.',
                ],
                [
                  'Перенос тренировки',
                  'После перетаскивания показываются прежние и новые дата, время и зал. Изменение применяется только после подтверждения. Пересечения по залу и тренеру проверяются. Та же операция доступна через кнопку в карточке занятия, без перетаскивания.',
                ],
                [
                  'База тренировок',
                  'Шаблон заполняет название, длительность, тренера, зал, вместимость и условия записи. Перед добавлением эти данные можно проверить. Изменение отдельного занятия не меняет сам шаблон.',
                ],
                [
                  'Спокойный интерфейс',
                  'Между разделами оставляется 28–32 px, внутри крупных блоков — 28 px. На телефоне отступы сокращаются до 20 px. Показатели стоят в одной спокойной строке, без отдельной рамки вокруг каждого числа. Бордовый выделяет главное действие, а выбранный пункт меню — мягкая подложка. Текст остаётся от 14 px, основной — 16 px. Строки клиентов сохраняют компактность, расписание — комфортный масштаб.',
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
                  <p>{text}</p>
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
                    <strong>Анна Смирнова</strong>
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
