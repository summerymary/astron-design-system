import { useState } from 'react';
import { ArrowRight, Check, Copy, RotateCcw } from 'lucide-react';
import { Button, SectionTitle } from './ui';
import { useTheme } from './ThemeProvider';
import { contrastRatio, DEFAULT_PRIMARY, normalizeHex, paletteToCss } from '../lib/theme';

const presets = [
  { name: 'Астрон', color: DEFAULT_PRIMARY },
  { name: 'Океан', color: '#2563EB' },
  { name: 'Лес', color: '#16825D' },
  { name: 'Солнце', color: '#F6C445' },
  { name: 'Графит', color: '#111111' },
];

export function ThemePlayground({ onNotify }: { onNotify: (text: string) => void }) {
  const { palette, setPrimary } = useTheme();
  const [draft, setDraft] = useState(palette.primary);
  const [error, setError] = useState('');
  const colors = palette.tokens;
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
            Кнопки, выделения, фоны, границы и текст подстроятся автоматически. Результат сразу
            виден во всём макете.
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
            {presets.map((preset) => (
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
            Выбор действует до обновления страницы. Логотип клуба сохраняет свои цвета.
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
            <input value="Безлимит" readOnly />
          </label>
          <Button onClick={() => onNotify('Это образец кнопки в выбранной палитре')}>
            Оформить абонемент <ArrowRight size={14} />
          </Button>
          <dl className="theme-result" aria-live="polite">
            <div>
              <dt>Цвет для кнопок</dt>
              <dd>{colors['--color-accent']}</dd>
            </div>
            <div>
              <dt>Контраст текста кнопки</dt>
              <dd>
                {contrastRatio(colors['--color-on-accent'], colors['--color-accent']).toFixed(2)}:1
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
          ? 'Используется исходная палитра «Астрона» с бордовым акцентом и серо-зелёными подписями.'
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
            Для обычного текста проверяется контраст от 4,5:1, для границ полей — от 3:1. Слишком
            светлый цвет кнопок затемняется.
          </p>
        </div>
      </div>
    </section>
  );
}
