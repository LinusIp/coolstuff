import './style.css';
import data from './projects.json';
import { mountField } from './field';
import { prefersReducedMotion } from '../shared/capabilities';
import { CATEGORY_LABELS, CATEGORY_SINGULAR, type Category, type Project } from './types';

const projects = (data as Project[]).filter((p) => p.status === 'shipped');
const categories = Object.keys(CATEGORY_LABELS) as Category[];

const grid = document.querySelector<HTMLOListElement>('#grid')!;
const tabs = document.querySelector<HTMLDivElement>('#tabs')!;
const q = document.querySelector<HTMLInputElement>('#q')!;
const empty = document.querySelector<HTMLDivElement>('#empty')!;
const resultLine = document.querySelector<HTMLParagraphElement>('#result-line')!;

const params = new URLSearchParams(location.search);
let active: Category | 'all' = categories.includes(params.get('c') as Category) ? (params.get('c') as Category) : 'all';
q.value = params.get('q') ?? '';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const pad = (n: number) => String(n).padStart(2, '0');

function matches(p: Project, query: string): boolean {
  if (!query) return true;
  const hay = [p.title, p.tagline, p.category, CATEGORY_SINGULAR[p.category], ...p.tags, ...p.tech].join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => hay.includes(word));
}

function visibleProjects(): Project[] {
  return projects.filter((p) => (active === 'all' || p.category === active) && matches(p, q.value.trim()));
}

function renderTabs(): void {
  const count = (c: Category) => projects.filter((p) => p.category === c).length;
  const tab = (id: string, label: string, n: number) =>
    `<button class="tab" type="button" data-cat="${id}" aria-pressed="${active === id}"${n === 0 ? ' data-empty' : ''}>${label}<span class="count">${pad(n)}</span></button>`;
  // Only categories with shipped work get a tab; empty ones would just be noise.
  tabs.innerHTML =
    tab('all', 'All', projects.length) +
    categories
      .filter((c) => count(c) > 0 || c === active)
      .map((c) => tab(c, CATEGORY_LABELS[c], count(c)))
      .join('');
}

function card(p: Project, i: number): string {
  const href = `./projects/${p.slug}/`;
  const thumb = p.hasThumb
    ? `<img src="./projects/${p.slug}/thumb.webp" alt="" width="1200" height="750" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async" />`
    : `<span class="ph">${escapeHtml(p.title)}</span>`;
  return `<li class="card" style="--i:${i}" data-slug="${p.slug}">
    <span class="thumb">${thumb}</span>
    <div class="card-body">
      <p class="card-kicker mono"><span class="cat">${CATEGORY_SINGULAR[p.category]}</span><span>${p.date.slice(0, 7).replace('-', '.')}</span></p>
      <h2><a href="${href}">${escapeHtml(p.title)}</a></h2>
      <a class="notes-link mono" href="./notes.html?p=${p.slug}" aria-label="How ${escapeHtml(p.title)} was made">Notes →</a>
      <p class="tagline">${escapeHtml(p.tagline)}</p>
      <ul class="tech" aria-label="Built with">${p.tech.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
    </div>
  </li>`;
}

function render(): void {
  const list = visibleProjects();
  grid.innerHTML = list.map(card).join('');
  empty.hidden = list.length > 0;
  document.querySelector('#empty-q')!.textContent = q.value.trim() ? `“${q.value.trim()}”` : CATEGORY_LABELS[active as Category] ?? 'this filter';
  const scope = active === 'all' ? 'all categories' : CATEGORY_LABELS[active].toLowerCase();
  resultLine.textContent = `${pad(list.length)} ${list.length === 1 ? 'project' : 'projects'} · ${scope}`;

  const url = new URL(location.href);
  url.searchParams.delete('c');
  url.searchParams.delete('q');
  if (active !== 'all') url.searchParams.set('c', active);
  if (q.value.trim()) url.searchParams.set('q', q.value.trim());
  history.replaceState(null, '', url);
}

tabs.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.tab');
  if (!btn) return;
  active = btn.dataset.cat as Category | 'all';
  renderTabs();
  render();
  tabs.querySelector<HTMLButtonElement>(`[data-cat="${active}"]`)?.focus();
});

q.addEventListener('input', render);

document.querySelector('#clear')!.addEventListener('click', () => {
  q.value = '';
  active = 'all';
  renderTabs();
  render();
});

addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  if (e.key === '/' && !typing) {
    e.preventDefault();
    q.focus();
    q.select();
  } else if (e.key === 'Escape' && e.target === q) {
    q.value = '';
    render();
  }
});

/**
 * "Surprise me": a quick roulette of highlights across the visible cards that
 * decelerates onto a random pick, then opens it. Instant when motion is reduced.
 */
let spinning = false;
document.querySelector('#surprise')!.addEventListener('click', async () => {
  if (spinning || projects.length === 0) return;
  const pool = visibleProjects().length ? visibleProjects() : projects;
  const last = sessionStorage.getItem('coolstuff:last-surprise');
  const choices = pool.length > 1 ? pool.filter((p) => p.slug !== last) : pool;
  const pick = choices[Math.floor(Math.random() * choices.length)];
  sessionStorage.setItem('coolstuff:last-surprise', pick.slug);
  const go = () => (location.href = `./projects/${pick.slug}/`);

  const cards = [...grid.querySelectorAll<HTMLLIElement>('.card')];
  if (prefersReducedMotion() || cards.length < 2 || !pool.includes(pick)) return go();
  spinning = true;
  const target = cards.findIndex((c) => c.dataset.slug === pick.slug);
  const steps = cards.length * 2 + target;
  for (let s = 0; s <= steps; s++) {
    cards.forEach((c, i) => c.classList.toggle('lit', i === s % cards.length));
    // Ease-out: each hop waits a little longer than the last.
    await new Promise((r) => setTimeout(r, 40 + (s / steps) ** 3 * 260));
  }
  cards[target].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  setTimeout(go, 380);
});

// Restore state when navigating back from a project (bfcache).
addEventListener('pageshow', () => {
  spinning = false;
  grid.querySelectorAll('.lit').forEach((c) => c.classList.remove('lit'));
});

const shippedCats = new Set(projects.map((p) => p.category)).size;
document.querySelector('#stats')!.textContent = `${pad(projects.length)} projects · ${pad(shippedCats)}/${pad(categories.length)} categories`;

renderTabs();
render();
mountField(document.querySelector<HTMLCanvasElement>('.field')!, getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c8ff2e');
