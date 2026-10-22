import { prefersReducedMotion } from '../../../src/shared/capabilities';

// Screens are sections; navigation crossfades with intent, instantly when motion is reduced.
function go(name: string): void {
  const next = document.querySelector<HTMLElement>(`[data-screen="${name}"]`);
  const current = document.querySelector<HTMLElement>('.screen:not([hidden])');
  if (!next || next === current) return;
  const swap = () => {
    current?.setAttribute('hidden', '');
    next.removeAttribute('hidden');
    next.querySelector<HTMLElement>('h1')?.focus();
  };
  if (prefersReducedMotion() || !current) return swap();
  current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).finished.then(() => {
    swap();
    next.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  });
}

document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
  if (target) go(target.dataset.go!);
});
document.querySelectorAll('h1').forEach((h) => (h.tabIndex = -1));
