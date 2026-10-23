/**
 * The masthead's light/dark switch (README §4.4): `button.icon-btn.theme-toggle`.
 * It shows the theme you would switch to (moon in light, sun in dark; CSS in
 * components.css), pins the choice with `toggleTheme()` (stored in
 * localStorage['coolstuff:theme'] for every page) and keeps
 * `<meta name="theme-color">` in sync.
 */
import { IconMoon, IconSun } from '../core/icons';
import { toggleTheme } from '../theme';

export function ThemeToggle({ class: cls }: { class?: string }) {
  return (
    <button type="button" class={['icon-btn', 'theme-toggle', cls].filter(Boolean).join(' ')} aria-label="Switch light or dark" onClick={() => toggleTheme()}>
      <IconMoon />
      <IconSun />
    </button>
  );
}
