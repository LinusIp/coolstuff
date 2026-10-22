import { safeStorage } from '../../../src/shared/capabilities';
import './fonts.css';
import './fonts-ja.css';
import './style.css';

/**
 * Shared page chrome: theme toggle, current-page nav state, footer year.
 *
 * The initial theme is applied by a tiny inline script in each page's <head>
 * (before any CSS paints) so there is never a flash of the wrong theme. This
 * module only handles changes after load.
 */

const KEY = 'ma-theme';
type Theme = 'light' | 'dark';

const root = document.documentElement;
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function current(): Theme {
  return root.dataset.theme === 'dark' ? 'dark' : 'light';
}

function apply(theme: Theme): void {
  root.dataset.theme = theme;
  const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if (button) {
    const next = theme === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', `Switch to ${next} theme`);
    button.title = `Switch to ${next} theme`;
  }
}

export function initChrome(): void {
  apply(current());
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    // Briefly allow colour transitions so the switch reads as ink drying, not a flicker.
    root.classList.add('theme-changing');
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    apply(next);
    safeStorage.set(KEY, next);
    window.setTimeout(() => root.classList.remove('theme-changing'), 450);
  });
  // Follow the OS setting live, unless the reader has made their own choice.
  systemDark.addEventListener('change', (e) => {
    if (!safeStorage.get(KEY)) apply(e.matches ? 'dark' : 'light');
  });

  const page = document.body.dataset.page;
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.site-nav a')) {
    if (link.dataset.nav === page) link.setAttribute('aria-current', 'page');
  }
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
}
