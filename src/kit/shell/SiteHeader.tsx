/**
 * The masthead every page uses (README §4.4): wordmark · breadcrumb ·
 * reading progress (lesson pages) · theme toggle. Tablets keep the first and
 * last crumb; phones show wordmark + toggle, and the progress becomes a
 * hairline on the bottom edge (layout.css).
 *
 *   <SiteHeader crumbs={[{ label: 'Linear algebra', href: '../../../#linalg' }, { label: 'Eigenvectors' }]} progress />
 */
import { IconBook } from '../core/icons';
import { siteRoot } from './links';
import { ReadingProgress } from './ReadingProgress';
import { ThemeToggle } from './ThemeToggle';

export interface SiteHeaderProps {
  /** The last one is the current page (`aria-current="page"`). */
  crumbs: readonly { label: string; href?: string }[];
  /** Show ReadingProgress (lesson pages). */
  progress?: boolean;
  /** Wordmark href, relative; default the site root (from the page's manifest link). */
  home?: string;
}

export function SiteHeader({ crumbs, progress = false, home }: SiteHeaderProps) {
  const root = home ?? siteRoot();
  return (
    <header class="masthead">
      <div class="masthead__inner">
        <a class="wordmark" href={root} aria-label="coolstuff, home">
          <IconBook />
          coolstuff
        </a>
        {crumbs.length > 0 && (
          <nav class="crumbs" aria-label="Breadcrumb">
            <ol>
              {crumbs.map((c, k) => {
                const last = k === crumbs.length - 1;
                return (
                  <li key={k} aria-current={last ? 'page' : undefined}>
                    {c.href && !last ? <a href={c.href}>{c.label}</a> : c.label}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        <div class="masthead__end">
          {progress && <ReadingProgress />}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
