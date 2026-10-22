import { initChrome } from './chrome';
import { allTags, escapeHtml, formatDate, postUrl, posts, seasonOf, tagUrl, type Post } from './content';
import { site } from './site';

initChrome();

const filter = document.querySelector<HTMLElement>('#tag-filter')!;
const list = document.querySelector<HTMLElement>('#archive')!;
const summary = document.querySelector<HTMLElement>('#archive-summary')!;
const tags = allTags();

const NUMBERS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const spell = (n: number) => NUMBERS[n] ?? String(n);

function currentTag(): string | null {
  const t = new URLSearchParams(location.search).get('tag');
  return t && tags.some(([name]) => name === t) ? t : null;
}

function renderFilter(active: string | null): void {
  const chip = (href: string, label: string, count: number, on: boolean) =>
    `<a class="chip" href="${href}"${on ? ' aria-current="page"' : ''}>${escapeHtml(label)} <span class="chip-count">${count}</span></a>`;
  filter.innerHTML = [chip('./archive.html', 'All', posts.length, !active), ...tags.map(([t, n]) => chip(tagUrl(t), t, n, t === active))].join('');
}

function item(p: Post): string {
  const tagLinks = p.tags.map((t) => `<a class="tag" href="${tagUrl(t)}">${escapeHtml(t)}</a>`).join('');
  return `
    <li class="archive-item">
      <time class="archive-date" datetime="${p.date}">${formatDate(p.date, { day: 'numeric', month: 'short' })}</time>
      <div class="archive-entry">
        <h3 class="archive-heading"><a class="archive-title" href="${postUrl(p)}">${escapeHtml(p.title)}</a></h3>
        <p class="archive-excerpt">${escapeHtml(p.excerpt)}</p>
        <p class="archive-tags">${tagLinks}</p>
      </div>
      <span class="archive-minutes">${p.minutes} min</span>
    </li>`;
}

function renderList(active: string | null): void {
  const shown = posts.filter((p) => !active || p.tags.includes(active));
  // Group by season, keeping newest first.
  const groups = new Map<string, { label: string; kanji: string; posts: Post[] }>();
  for (const p of shown) {
    const s = seasonOf(p.date);
    const key = `${s.year}-${s.name}`;
    if (!groups.has(key)) groups.set(key, { label: `${s.name} ${s.year}`, kanji: s.kanji, posts: [] });
    groups.get(key)!.posts.push(p);
  }
  list.innerHTML = shown.length
    ? [...groups.values()]
        .map(
          (g) => `
      <section class="season" aria-label="${g.label}">
        <h2 class="season-head"><span class="season-kanji" aria-hidden="true">${g.kanji}</span><span>${g.label}</span></h2>
        <ol class="archive-list">${g.posts.map(item).join('')}</ol>
      </section>`,
        )
        .join('')
    : `<p class="archive-empty">Nothing filed under that yet.</p>`;

  const n = shown.length;
  summary.textContent = active
    ? `${spell(n)} ${n === 1 ? 'essay' : 'essays'} tagged “${active}”.`
    : `${spell(n)} essays since ${formatDate(posts[posts.length - 1]?.date ?? '', { month: 'long', year: 'numeric' })}, grouped by season.`;
  document.title = active ? `#${active} · Archive · ${site.name}` : `Archive · ${site.name}`;
}

function render(): void {
  const active = currentTag();
  renderFilter(active);
  renderList(active);
}

// Tag chips filter in place (no reload), but stay real links so they work without JS and can be shared.
filter.addEventListener('click', (e) => {
  const a = (e.target as Element).closest('a');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  history.pushState(null, '', a.href);
  render();
  a.blur();
  filter.querySelector<HTMLAnchorElement>('[aria-current="page"]')?.focus();
});
window.addEventListener('popstate', render);

render();
