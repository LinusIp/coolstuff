/**
 * The kit's small line icons (16px grid unless noted), drawn with
 * `currentColor` strokes (styled by `.icon` / `.btn svg` in components.css).
 * Always decorative: pair each with a word (DESIGN.md: colour and icons never
 * travel alone), so they're aria-hidden.
 */

export const IconCheck = () => (
  <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
  </svg>
);

export const IconCross = () => (
  <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </svg>
);

export const IconWarn = () => (
  <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 2.5 14.5 13.5h-13z" />
    <path d="M8 6.8v3.2M8 11.8v.2" />
  </svg>
);

export const IconRefresh = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3" />
  </svg>
);

export const IconPrint = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z" />
  </svg>
);

/** 24px grid, for icon buttons. */
export const IconPrev = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14.5 6.5 9 12l5.5 5.5" />
  </svg>
);

export const IconNext = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9.5 6.5 15 12l-5.5 5.5" />
  </svg>
);

export const IconPlay = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.5v13l10-6.5z" />
  </svg>
);

export const IconPause = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8.5 5.5v13M15.5 5.5v13" />
  </svg>
);

export const IconMoon = () => (
  <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />
  </svg>
);

export const IconSun = () => (
  <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);

/** The coolstuff wordmark glyph (an open book). */
export const IconBook = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 5.5h7a2 2 0 0 1 2 2V19a1.6 1.6 0 0 0-1.6-1.6H4zM20 5.5h-7a2 2 0 0 0-2 2V19a1.6 1.6 0 0 1 1.6-1.6H20z" />
  </svg>
);
