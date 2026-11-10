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
        aria-pressed={visualStyle === 'vivid'}
        onClick={() => setVisualStyle('vivid')}
        title="Астрон Контраст — яркая палитра с привычной компоновкой"
      >
        <span className="visual-style-dot vivid-style-dot" aria-hidden="true" />
        Контраст
      </button>
    </div>
  );
}
