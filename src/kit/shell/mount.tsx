/**
 * `mountLesson(<LessonPage …/>)`: apply the saved theme, render into `#app`
 * and register the offline service worker (its URL comes from the page's
 * manifest link, so no argument is needed at any depth).
 */
import { render, type VNode } from 'preact';
import { initTheme } from '../theme';
import { registerPWA } from '../util/pwa';

export function mountLesson(vnode: VNode, el: string | HTMLElement = '#app'): void {
  initTheme();
  const target = typeof el === 'string' ? document.querySelector<HTMLElement>(el) : el;
  if (!target) throw new Error(`mountLesson: no element ${String(el)}`);
  render(vnode, target);
  registerPWA();
}
