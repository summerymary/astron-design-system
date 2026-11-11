import { useTheme } from './ThemeProvider';
import { Select } from './Select';
import { THEME_OPTIONS } from '../lib/visual-style';
import type { ThemeId } from '../lib/visual-style';
import { THEME_PRESETS } from '../lib/theme';

export function ThemeSelect() {
  const { theme, setTheme, palette } = useTheme();
  const hasCustom = !THEME_PRESETS.some((preset) => preset.color === palette.primary);
  return (
    <label className="theme-select">
      <span>Тема</span>
      <Select
        aria-label="Тема интерфейса"
        value={theme}
        onChange={(event) => setTheme(event.target.value as ThemeId | 'custom')}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
        {hasCustom && <option value="custom">Свой цвет</option>}
      </Select>
    </label>
  );
}
