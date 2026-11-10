import { useTheme } from './ThemeProvider';

export function VisualStyleSwitch() {
  const { visualStyle, setVisualStyle } = useTheme();
  return (
    <div className="visual-style-switch" role="group" aria-label="Стиль прототипа">
      <button
        type="button"
        aria-pressed={visualStyle === 'astron'}
        onClick={() => setVisualStyle('astron')}
        title="Исходный дизайн Астрона"
      >
        <span className="visual-style-dot astron-style-dot" aria-hidden="true" />
        Астрон
      </button>
      <button
        type="button"
        aria-pressed={visualStyle === 'spectrum'}
        onClick={() => setVisualStyle('spectrum')}
        title="Минимал — новый интерфейс"
      >
        <span className="visual-style-dot spectrum-style-dot" aria-hidden="true" />
        Минимал
      </button>
    </div>
  );
}
