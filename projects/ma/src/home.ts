import { initChrome } from './chrome';
import { escapeHtml, formatDate, img, postUrl, posts, seasonOf } from './content';

initChrome();

const [featured, ...rest] = posts;

if (featured) {
  const season = seasonOf(featured.date);
  document.querySelector('#hero-season')!.textContent = `${season.name} ${season.year}`;
  document.querySelector<HTMLAnchorElement>('#hero-latest')!.href = postUrl(featured);

  // The featured essay: its painting, its kanji as a seal, and its title written vertically.
  document.querySelector('#feature')!.innerHTML = `
    <a class="feature-link" href="${postUrl(featured)}">
      <figure class="feature-media ink-in">
        <div class="feature-frame">
          ${/* object-fit: cover shows a 3:2 painting in a tall frame, so the drawn width is ~1.5× the frame height. */ ""}${img(featured.cover, featured.coverAlt, { sizes: '(min-width: 900px) 57rem, min(45rem, 177vw)', eager: true })}
        </div>
        ${featured.kanji ? `<span class="feature-stamp" aria-hidden="true">${escapeHtml(featured.kanji)}</span>` : ''}
      </figure>
      <div class="feature-v rise" style="--i:3">
        <span class="feature-label">Latest essay</span>
        <h2 class="feature-title">${escapeHtml(featured.title)}</h2>
        <span class="feature-meta">${formatDate(featured.date, { day: 'numeric', month: 'short' })} · ${featured.minutes} min</span>
      </div>
    </a>`;
}

document.querySelector('#essays')!.innerHTML = rest
  .map(
    (p) => `
    <li>
      <a class="essay-link" href="${postUrl(p)}">
        <span class="essay-kanji" aria-hidden="true">${escapeHtml(p.kanji)}</span>
        <div class="essay-body">
          <p class="essay-meta"><time datetime="${p.date}">${formatDate(p.date)}</time> · ${p.minutes} min read</p>
          <h3 class="essay-title">${escapeHtml(p.title)}</h3>
          <p class="essay-excerpt">${escapeHtml(p.excerpt)}</p>
        </div>
        <div class="essay-thumb">${p.cover ? img(p.cover, '', { sizes: '(min-width: 760px) 13rem, 6.5rem' }) : ''}</div>
      </a>
    </li>`,
  )
  .join('');

// Stagger the hero text in.
document.querySelectorAll('.hero-text > *').forEach((el, i) => {
  el.classList.add('rise');
  (el as HTMLElement).style.setProperty('--i', String(i));
});
