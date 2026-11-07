import { useState } from 'react';
import { ArrowRight, Check, Copy, RotateCcw } from 'lucide-react';
import { Button, SectionTitle } from './ui';
import { useTheme } from './ThemeProvider';
import {
  contrastRatio,
  DEFAULT_PRIMARY,
  normalizeHex,
  paletteToCss,
  THEME_PRESETS,
} from '../lib/theme';

export function ThemePlayground({ onNotify }: { onNotify: (text: string) => void }) {
  const { palette, setPrimary } = useTheme();
  const [draft, setDraft] = useState(palette.primary);
  const [error, setError] = useState('');
  const colors = palette.tokens;
  const swatches = [
    { label: 'Главный', value: colors['--color-action'] },
    { label: 'Дополнительный', value: colors['--color-accent'] },
    { label: 'Подписи', value: colors['--color-muted'] },
    { label: 'Фон', value: colors['--color-canvas'] },
    { label: 'Границы', value: colors['--color-control-border'] },
  ];
  const apply = (value: string) => {
    const hex = normalizeHex(value);
    if (!hex) {
      setError('Введите HEX из 3 или 6 символов: например, #8A332C.');
      return;
    }
    setPrimary(hex);
    setDraft(hex);
    setError('');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(paletteToCss(palette));
      onNotify('Палитра скопирована в формате CSS');
    } catch {
      onNotify('Не удалось скопировать палитру. Разрешите доступ к буферу обмена.');
    }
  };
  return (
    <section className="ds-section theme-playground" aria-labelledby="theme-title">
      <SectionTitle
        title="Цвета вашего клуба"
        subtitle="Один фирменный цвет — согласованная палитра для всех экранов."
        action={<span className="ds-section-number">ПРЕДПРОСМОТР</span>}
      />
      <div className="theme-editor">
        <div className="theme-settings">
          <h3 id="theme-title">Выберите основной цвет</h3>
          <p>
            Кнопки, выделения, фоны, границы и текст подстроятся автоматически. Образцы ниже
            обновятся сразу.
          </p>
          <form
            className="theme-color-form"
            onSubmit={(event) => {
              event.preventDefault();
              apply(draft);
            }}
          >
            <label className="theme-picker">
              <span className="sr-only">Выбрать основной цвет клуба</span>
              <input
                type="color"
                value={palette.primary}
                onChange={(event) => apply(event.target.value)}
              />
            </label>
            <label className="form-field theme-hex-field">
              <span>Основной цвет · HEX</span>
              <input
                aria-label="Основной цвет HEX"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError('');
                }}
                spellCheck={false}
                maxLength={16}
                aria-invalid={!!error}
                aria-describedby={error ? 'theme-color-error' : undefined}
              />
            </label>
            <Button type="submit">
              Применить <ArrowRight size={14} />
            </Button>
          </form>
          {error && (
            <p id="theme-color-error" className="theme-error" role="alert">
              {error}
            </p>
          )}
          <div className="theme-presets" aria-label="Примеры фирменных цветов">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                aria-pressed={palette.primary === preset.color}
                onClick={() => apply(preset.color)}
              >
                <i style={{ background: preset.color }} />
                {preset.name}
              </button>
            ))}
          </div>
          <div className="theme-swatch-strip" aria-label="Рассчитанная палитра с HEX">
            {swatches.map(({ label, value }) => (
              <button
                key={label}
                type="button"
                aria-label={`Скопировать ${label} ${value}`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(value);
                    onNotify(`${value} скопирован`);
                  } catch {
                    onNotify(`Цвет: ${value}`);
                  }
                }}
              >
                <i style={{ background: value }} />
                <span>{label}</span>
                <code>{value}</code>
              </button>
            ))}
          </div>
          <div className="theme-actions">
            <Button variant="secondary" onClick={() => apply(DEFAULT_PRIMARY)}>
              <RotateCcw size={14} />
              Вернуть «Астрон»
            </Button>
            <Button variant="ghost" onClick={() => void copy()}>
              <Copy size={14} />
              Скопировать CSS
            </Button>
          </div>
          <p className="theme-session-note">
            Цвет сохраняется в ссылке. Кнопка «Открыть прототип» покажет приложение в выбранной
            теме.
          </p>
        </div>
        <div className="theme-preview" aria-label="Образец новой палитры">
          <span className="eyebrow">ТАК БУДЕТ В ИНТЕРФЕЙСЕ</span>
          <div className="theme-preview-heading">
            <strong>Новый клиент</strong>
            <span>
              <Check size={12} />
              Активен
            </span>
          </div>
          <p>Анна Смирнова</p>
          <small>Подписи остаются читаемыми на светлом фоне.</small>
          <label className="form-field">
            <span>Абонемент</span>
            <input value="Железная карта" readOnly />
          </label>
          <Button onClick={() => onNotify('Это образец кнопки в выбранной палитре')}>
            Оформить абонемент <ArrowRight size={14} />
          </Button>
          <dl className="theme-result" aria-live="polite">
            <div>
              <dt>Цвет главной кнопки</dt>
              <dd>{colors['--color-action']}</dd>
            </div>
            <div>
              <dt>Контраст текста кнопки</dt>
              <dd>
                {contrastRatio(colors['--color-on-action'], colors['--color-action']).toFixed(2)}:1
              </dd>
            </div>
            <div>
              <dt>Контраст вторичного текста</dt>
              <dd>
                {contrastRatio(colors['--color-muted'], colors['--color-surface']).toFixed(2)}:1
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <p className="theme-adjustment" role="status">
        {palette.primary === DEFAULT_PRIMARY
          ? 'Палитра «Астрона»: тёплый бордовый, графитовый текст, белые карточки и едва тёплый белый фон. Серо-зелёные подписи сохраняют читаемость.'
          : palette.appearance === 'citrus'
            ? `Яркий лайм ${palette.primary} сочетается с холодным графитовым ${colors['--color-accent']}. На главной кнопке — тёмный текст, в подписях и фонах — спокойные холодные оттенки.`
            : palette.adjusted
              ? `Выбран ${palette.primary}. Для кнопок подобран ${colors['--color-accent']}, чтобы белый текст и выделения оставались хорошо видны.`
              : `Выбран ${palette.primary}. Этот цвет подходит для кнопок без дополнительного изменения яркости.`}
      </p>
      <div className="theme-rules">
        <div>
          <strong>Что подстраивается</strong>
          <p>
            Основные кнопки и их состояния, выбранные разделы, светлые фоны, границы и нейтральный
            текст.
          </p>
        </div>
        <div>
          <strong>Что сохраняет смысл</strong>
          <p>
            Успех — зелёный, предупреждение — янтарное, ошибка — красная. У статусов всегда есть
            подписи.
          </p>
        </div>
        <div>
          <strong>Как сохраняется читаемость</strong>
          <p>
            Для обычного текста проверяется контраст от 4,5:1, для границ полей — от 3:1. На ярком
            лайме используется тёмный текст, на тёмных кнопках — белый.
          </p>
        </div>
      </div>
    </section>
  );
}
