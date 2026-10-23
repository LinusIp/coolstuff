/**
 * coolstuff design tokens and the semantic colour API ("Paper").
 *
 * This file is the single source of truth for every colour on the site.
 * `styles/tokens.css` mirrors these tables as CSS custom properties, and
 * `theme.test.ts` fails if the two ever drift or if any pairing drops below
 * WCAG AA. See `DESIGN.md` §4 for the rules in prose.
 *
 *   Chrome is ink. Hue is meaning.
 *
 * Five global meanings never change from lesson to lesson:
 *   blue = input / independent      orange = output / dependent
 *   red  = error / gradient / force purple = probability / uncertainty
 *   green = correct / solution (a STATE: verdicts, boxed answers, "you found it")
 * Three free inks (teal, rose, gold) carry a lesson's own concepts.
 * A lesson names 3–5 concepts with `defineConcepts()`; each gets a hue AND a
 * line style, so colour is never the only signal.
 *
 * Pure data + pure functions at the top (safe in Node and tests); the DOM
 * helpers at the bottom guard against a missing `document`.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type ThemeName = 'light' | 'dark';
export type Hex = `#${string}`;

/** Surface and ink tokens (CSS: `--paper`, `--ink-2`, …). */
export const SURFACE_TOKENS = [
  'paper', // page
  'raised', // cards, figure plates
  'sunk', // hints, folded sidenotes, wells
  'plate', // figure stage
  'ink', // body text, primary buttons, focus ring
  'ink-2', // secondary text, kickers
  'ink-3', // captions, meta (still AA text)
  'ink-4', // decoration and disabled only — never text a reader must read
  'rule', // hairlines (decorative)
  'rule-strong', // dividers that must read
  'grid', // figure grid (quiet by design, decorative)
  'axis', // figure axes (graphics: ≥ 3:1 on plate)
  'ui-line', // boundaries of controls you must find, e.g. text fields (≥ 3:1)
  'on-ink', // text on an ink or hue fill
  'marker', // highlighter pen (not a concept): "this changed"
] as const;
export type SurfaceToken = (typeof SURFACE_TOKENS)[number];

/** The eight inks. Five carry global meanings; teal, rose and gold are free. */
export const HUE_NAMES = ['blue', 'orange', 'red', 'green', 'purple', 'teal', 'rose', 'gold'] as const;
export type Hue = (typeof HUE_NAMES)[number];

/** Global meanings, identical in every lesson. */
export const SEMANTIC_HUES = {
  input: 'blue',
  output: 'orange',
  error: 'red',
  correct: 'green',
  prob: 'purple',
} as const satisfies Record<string, Hue>;
export type SemanticRole = keyof typeof SEMANTIC_HUES;

/** Inks a lesson may give to a concept none of the global meanings covers. */
export const FREE_HUES = ['teal', 'rose', 'gold'] as const satisfies readonly Hue[];
export type FreeHue = (typeof FREE_HUES)[number];

/**
 * What a concept may wear: a global meaning (input/output/error/prob) or a
 * free ink. Green is not on the list: it is the colour of "correct", a state
 * the learner earns, so no concept may own it.
 */
export type ConceptHue = Exclude<SemanticRole, 'correct'> | FreeHue;

// ── Palette ─────────────────────────────────────────────────────────────────

/** Warm paper and iron-gall ink (light); a lamp-lit desk (dark). */
export const SURFACES: Readonly<Record<ThemeName, Readonly<Record<SurfaceToken, Hex>>>> = {
  light: {
    paper: '#f8f5ee',
    raised: '#fdfbf6',
    sunk: '#f1ece1',
    plate: '#fdfbf6',
    ink: '#1e1b16',
    'ink-2': '#4a443a',
    'ink-3': '#6b6356',
    'ink-4': '#a39a8b',
    rule: '#ddd5c6',
    'rule-strong': '#bdb29e',
    grid: '#e9e2d4',
    axis: '#8d8473',
    'ui-line': '#8a8070',
    'on-ink': '#fdfbf6',
    marker: '#f2c94c',
  },
  dark: {
    paper: '#191714',
    raised: '#211e1a',
    sunk: '#141210',
    plate: '#1d1a17',
    ink: '#ece6d9',
    'ink-2': '#c5bcac',
    'ink-3': '#a0978a',
    'ink-4': '#6a6255',
    rule: '#36312a',
    'rule-strong': '#524a3f',
    grid: '#2a2621',
    axis: '#757062',
    'ui-line': '#7c7364',
    'on-ink': '#191714',
    marker: '#dba52c',
  },
};

/**
 * Inks per theme, plus a darker set for print on white (the TL;DR revision
 * card). Light inks are deep, ink-like versions (burnt orange, not traffic
 * cone); dark inks are lifted so they read on charcoal without glowing.
 */
export const HUES: Readonly<Record<ThemeName | 'print', Readonly<Record<Hue, Hex>>>> = {
  light: {
    blue: '#1f62b0',
    orange: '#974f09',
    red: '#b92a2d',
    green: '#19712e',
    purple: '#754aba',
    teal: '#0f6d69',
    rose: '#a63481',
    gold: '#705e0c',
  },
  dark: {
    blue: '#7caff1',
    orange: '#ea9a53',
    red: '#fe8b85',
    green: '#79bc80',
    purple: '#ba9ff3',
    teal: '#50bdb4',
    rose: '#ec8dce',
    gold: '#d3ba4e',
  },
  print: {
    blue: '#174c8c',
    orange: '#8c3e06',
    red: '#9a2219',
    green: '#1f5f2b',
    purple: '#573896',
    teal: '#0a5a56',
    rose: '#88255f',
    gold: '#614b00',
  },
};

/** Ink and paper for print (the revision sheet prints ink on white). */
export const PRINT_SURFACES = { paper: '#ffffff', ink: '#111111', 'ink-2': '#333333', 'ink-3': '#555555', rule: '#bbbbbb' } as const;

/** Share of a hue laid over a surface for washes (chips, linked highlight, verdict panels). */
export const WASH_PCT = 0.12;
/** Share of the highlighter laid over a surface (lower in dark, where it would glare). */
export const MARKER_PCT: Readonly<Record<ThemeName, number>> = { light: 0.3, dark: 0.22 };

// ── Line styles: colour never travels alone ────────────────────────────────

export const LINE_STYLES = ['solid', 'dashed', 'dotted', 'double', 'dashdot', 'longdash'] as const;
export type LineStyle = (typeof LINE_STYLES)[number];

/** Default line style for each ink (a lesson may override; clashes are resolved automatically). */
export const DEFAULT_LINE: Readonly<Record<Hue, LineStyle>> = {
  blue: 'solid',
  orange: 'dashed',
  red: 'dashdot',
  purple: 'dotted',
  green: 'solid',
  teal: 'dotted',
  rose: 'double',
  gold: 'longdash',
};

export interface StrokeSpec {
  /** SVG `stroke-dasharray`, scaled to the stroke width; null = solid. */
  dasharray: string | null;
  linecap: 'round' | 'butt';
  /**
   * Drawn as two parallel lines: a wide stroke in the ink, then a narrower
   * stroke in the plate colour on top ("casing"). Stage2D does this for you.
   */
  double: boolean;
}

const r2 = (x: number): string => String(Math.round(x * 100) / 100);

/** SVG stroke for a line style at a given stroke width (px). Patterns scale with the width. */
export function strokeFor(style: LineStyle, width = 2): StrokeSpec {
  const w = Math.max(0.5, width);
  switch (style) {
    case 'solid':
      return { dasharray: null, linecap: 'round', double: false };
    case 'dashed':
      return { dasharray: `${r2(w * 3.2)} ${r2(w * 2)}`, linecap: 'butt', double: false };
    case 'dotted':
      // Round caps turn near-zero dashes into dots one stroke-width across.
      return { dasharray: `0.01 ${r2(w * 2.4)}`, linecap: 'round', double: false };
    case 'double':
      return { dasharray: null, linecap: 'butt', double: true };
    case 'dashdot':
      return { dasharray: `${r2(w * 2.6)} ${r2(w * 2.6)} 0.01 ${r2(w * 2.6)}`, linecap: 'round', double: false };
    case 'longdash':
      return { dasharray: `${r2(w * 6)} ${r2(w * 2.4)}`, linecap: 'butt', double: false };
  }
}

/**
 * CSS `background` layers that draw a line style as an underline in `var(--c)`
 * (prose terms, explain-this stubs, legend swatches). Same pattern as the figure.
 */
export function underlineFor(style: LineStyle): string {
  const c = 'var(--c)';
  const at = '0 100%';
  switch (style) {
    case 'solid':
      return `linear-gradient(${c},${c}) ${at}/100% 1.5px no-repeat`;
    case 'dashed':
      return `repeating-linear-gradient(90deg,${c} 0 5px,transparent 5px 8px) ${at}/100% 1.5px no-repeat`;
    case 'dotted':
      return `radial-gradient(circle closest-side,${c} 85%,transparent) ${at}/4px 2px repeat-x`;
    case 'double':
      return `linear-gradient(${c},${c}) ${at}/100% 1px no-repeat,linear-gradient(${c},${c}) 0 calc(100% - 3px)/100% 1px no-repeat`;
    case 'dashdot':
      return `repeating-linear-gradient(90deg,${c} 0 6px,transparent 6px 8.5px,${c} 8.5px 10px,transparent 10px 12.5px) ${at}/100% 1.5px no-repeat`;
    case 'longdash':
      return `repeating-linear-gradient(90deg,${c} 0 10px,transparent 10px 14px) ${at}/100% 1.5px no-repeat`;
  }
}

// ── Colour maths (pure) ─────────────────────────────────────────────────────

type RGB = [number, number, number];

export function parseHex(hex: string): RGB {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export function toHex([r, g, b]: RGB): Hex {
  const c = (x: number) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

const lin = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1–21. AA needs 4.5 for text, 3 for large text and graphics. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `fg` laid over `bg` at opacity `t` (what `color-mix(in srgb, fg t, transparent)` paints on bg). */
export function mix(fg: string, bg: string, t: number): Hex {
  const f = parseHex(fg);
  const b = parseHex(bg);
  return toHex([0, 1, 2].map((i) => f[i] * t + b[i] * (1 - t)) as RGB);
}

/** sRGB → OKLab (Björn Ottosson). */
export function toOklab(hex: string): [number, number, number] {
  const [r, g, b] = parseHex(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Perceptual distance between two colours (OKLab Euclidean; ~0.02 is a just-noticeable step). */
export function oklabDistance(a: string, b: string): number {
  const p = toOklab(a);
  const q = toOklab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** OKLCH → hex, reducing chroma until the colour fits in sRGB. Hue in degrees. */
export function oklch(L: number, C: number, h: number): Hex {
  const toRgb = (c: number): RGB | null => {
    const a = c * Math.cos((h * Math.PI) / 180);
    const b = c * Math.sin((h * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    const out = [lr, lg, lb];
    if (out.some((v) => v < -1e-4 || v > 1 + 1e-4)) return null;
    return out.map((v) => {
      const x = Math.min(1, Math.max(0, v));
      return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
    }) as RGB;
  };
  for (let c = C; c >= 0; c -= 0.005) {
    const rgb = toRgb(c);
    if (rgb) return toHex(rgb);
  }
  return toHex(toRgb(0) ?? [128, 128, 128]);
}

// ── Token lookups (pure) ────────────────────────────────────────────────────

export function surface(token: SurfaceToken, theme: ThemeName): Hex {
  return SURFACES[theme][token];
}

export function hue(name: Hue, theme: ThemeName | 'print'): Hex {
  return HUES[theme][name];
}

/** A hue's wash over a surface, as painted (for contrast checks and canvas). */
export function wash(name: Hue, theme: ThemeName, over: SurfaceToken = 'raised'): Hex {
  return mix(HUES[theme][name], SURFACES[theme][over], WASH_PCT);
}

/** The highlighter as painted over a surface. */
export function marker(theme: ThemeName, over: SurfaceToken = 'raised'): Hex {
  return mix(SURFACES[theme].marker, SURFACES[theme][over], MARKER_PCT[theme]);
}

export function hueOf(role: ConceptHue | SemanticRole): Hue {
  return (role in SEMANTIC_HUES ? SEMANTIC_HUES[role as SemanticRole] : role) as Hue;
}

/**
 * Subject identity colour (home grid, subject page rule, prerequisite graph
 * ring) from `curriculum.ts`'s `hue` (0–360). Low chroma, fixed lightness, so
 * every subject passes AA as text on paper. Site pages only: never inside a
 * lesson, where hue is reserved for concepts.
 */
export function subjectInk(hueDeg: number, theme: ThemeName): Hex {
  return theme === 'light' ? oklch(0.5, 0.085, hueDeg) : oklch(0.78, 0.075, hueDeg);
}

// ── Concepts: a lesson's named colours ──────────────────────────────────────

export interface ConceptSpec {
  /** A global meaning ('input' | 'output' | 'error' | 'prob') or a free ink ('teal' | 'rose' | 'gold'). */
  hue: ConceptHue;
  /** Override the ink's default line style. Must be unique within the lesson. */
  line?: LineStyle;
  /** Plain-words name for legends and screen readers, e.g. "input vector". */
  label?: string;
  /** TeX for the concept's symbol, e.g. "\\mathbf{v}". Creates a `\c<Name>` shorthand macro. */
  symbol?: string;
}

export interface Concept {
  name: string;
  hue: Hue;
  role: ConceptHue;
  line: LineStyle;
  label: string;
  symbol?: string;
  /** Classes for HTML, SVG and KaTeX (`\colorTerm{name}{…}` produces the same). */
  className: string;
  /** CSS colour value that re-themes live, e.g. `var(--ct-matrix)`. */
  cssVar: string;
}

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const MAX_CONCEPTS = 5;

/** The global meanings, available on every page without defining them (styles in components.css). */
export const GLOBAL_CONCEPTS: Readonly<Record<SemanticRole, { hue: Hue; line: LineStyle }>> = {
  input: { hue: 'blue', line: 'solid' },
  output: { hue: 'orange', line: 'dashed' },
  error: { hue: 'red', line: 'dashdot' },
  prob: { hue: 'purple', line: 'dotted' },
  correct: { hue: 'green', line: 'solid' },
};

/** `matrix` → `\cMatrix`, `eigen-value` → `\cEigenValue`. */
export function shorthandMacro(name: string): string {
  return '\\c' + name.replace(/(^|-)([a-z0-9])/g, (_, __, ch: string) => ch.toUpperCase());
}

/** The attribute selector for a concept scope: `[data-lesson="calc1/derivative"]`. */
export function conceptScopeSelector(scope: string): string {
  return `[data-lesson="${scope.replace(/["\\]/g, '\\$&')}"]`;
}

/**
 * The CSS rules for one concept (custom property, class, linked highlight).
 * With `scope` (a lesson id) they apply only inside `[data-lesson="<scope>"]`,
 * so a page that mixes lessons (subject practice, exam set) can give two
 * lessons' `rate` concepts different inks.
 */
export function conceptRules(name: string, h: Hue, line: LineStyle, scope?: string): string {
  if (scope) {
    const sel = conceptScopeSelector(scope);
    return [
      `${sel}{--ct-${name}:var(--hue-${h})}`,
      `${sel} .ct-${name}{--c:var(--hue-${h});--w:var(--w-${h});--u:${underlineFor(line)}}`,
      `[data-hl~="${name}"] ${sel} .ct-${name}{--lit:1}`,
    ].join('\n');
  }
  return [
    `:root{--ct-${name}:var(--hue-${h})}`,
    `.ct-${name}{--c:var(--hue-${h});--w:var(--w-${h});--u:${underlineFor(line)}}`,
    `[data-hl~="${name}"] .ct-${name}{--lit:1}`,
  ].join('\n');
}

/** Mounted concept stylesheets per document, ref-counted by their text. */
const mountedConcepts = new WeakMap<Document, Map<string, { el: HTMLStyleElement; count: number }>>();

export class ConceptSet<N extends string = string> {
  readonly names: readonly N[];
  private readonly map: ReadonlyMap<N, Concept>;

  constructor(concepts: Concept[]) {
    this.names = concepts.map((c) => c.name as N);
    this.map = new Map(concepts.map((c) => [c.name as N, c]));
  }

  get(name: N): Concept {
    const c = this.map.get(name);
    if (!c) throw new Error(`Unknown concept "${name}". Defined: ${this.names.join(', ')}`);
    return c;
  }

  /** `ct ct-matrix`: put on any HTML/SVG element to give it the concept's colour, wash and underline. */
  className(name: N): string {
    return this.get(name).className;
  }

  /** `var(--ct-matrix)`: for inline styles and SVG attributes; re-themes without re-rendering. */
  color(name: N): string {
    return this.get(name).cssVar;
  }

  /** The concrete hex for canvas/WebGL drawing (re-read on `onThemeChange`). */
  hex(name: N, theme: ThemeName | 'print' = currentTheme()): Hex {
    return HUES[theme][this.get(name).hue];
  }

  line(name: N): LineStyle {
    return this.get(name).line;
  }

  /** SVG stroke attributes (colour + line style) for this concept at a stroke width. */
  stroke(name: N, width = 2): Record<string, string> {
    const c = this.get(name);
    const s = strokeFor(c.line, width);
    const attrs: Record<string, string> = { stroke: c.cssVar, 'stroke-width': String(width), 'stroke-linecap': s.linecap };
    if (s.dasharray) attrs['stroke-dasharray'] = s.dasharray;
    if (s.double) attrs['data-double'] = '';
    return attrs;
  }

  /** KaTeX shorthands from each concept's `symbol`: `{ '\\cMatrix': '\\colorTerm{matrix}{A}' }`. */
  macros(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const n of this.names) {
      const c = this.get(n);
      if (c.symbol) out[shorthandMacro(n)] = `\\colorTerm{${n}}{${c.symbol}}`;
    }
    return out;
  }

  /** Legend rows, in definition order. */
  legend(): { name: N; label: string; hue: Hue; line: LineStyle; symbol?: string }[] {
    return this.names.map((n) => {
      const c = this.get(n);
      return { name: n, label: c.label, hue: c.hue, line: c.line, symbol: c.symbol };
    });
  }

  /** The stylesheet text for these concepts: page-wide, or limited to `[data-lesson="<scope>"]` (see `conceptRules`). */
  css(scope?: string): string {
    return this.names.map((n) => conceptRules(n, this.get(n).hue, this.get(n).line, scope)).join('\n');
  }

  /**
   * Inject `css(scope)` into the document. Mounting the same stylesheet twice
   * shares one <style> (ref-counted); the returned function releases this
   * mount and removes the element when the last one goes. Single-lesson pages
   * mount page-wide (`LessonPage`); pages that mix lessons mount one scoped
   * sheet per lesson (`KitProvider` does it when given `lessonId` + `concepts`).
   */
  mount(doc: Document | undefined = typeof document === 'undefined' ? undefined : document, scope?: string): () => void {
    if (!doc) return () => {};
    const text = this.css(scope);
    let byText = mountedConcepts.get(doc);
    if (!byText) mountedConcepts.set(doc, (byText = new Map()));
    let entry = byText.get(text);
    if (!entry) {
      const el = doc.createElement('style');
      el.dataset.concepts = this.names.join(' ');
      if (scope) el.dataset.scope = scope;
      el.textContent = text;
      doc.head.append(el);
      byText.set(text, (entry = { el, count: 0 }));
    }
    entry.count++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const e = byText!.get(text);
      if (!e) return;
      if (--e.count <= 0) {
        e.el.remove();
        byText!.delete(text);
      }
    };
  }
}

/**
 * Name a lesson's 3–5 concepts and give each an ink and a line style.
 *
 *   const C = defineConcepts({
 *     input:  { hue: 'input',  label: 'input vector', symbol: '\\mathbf{v}' },
 *     output: { hue: 'output', label: 'output', symbol: 'A\\mathbf{v}' },
 *     matrix: { hue: 'teal',   label: 'the matrix', symbol: 'A' },
 *     eigenvalue: { hue: 'rose', label: 'eigenvalue', symbol: '\\lambda' },
 *   });
 *   C.mount();                       // once per page
 *   <span class={C.className('matrix')}>A</span>
 *   \colorTerm{matrix}{A}  or  \cMatrix   (pass C.macros() to Formula)
 *   <path {...C.stroke('output', 2.5)} />
 *
 * Throws on: more than 5 concepts, a bad name, green (reserved for "correct"),
 * two concepts sharing an ink, or two explicit identical line styles.
 * Unspecified line styles default per ink; a clash takes the next free style.
 */
export function defineConcepts<N extends string>(spec: Record<N, ConceptSpec | ConceptHue>): ConceptSet<N> {
  const entries = Object.entries(spec) as [N, ConceptSpec | ConceptHue][];
  if (entries.length === 0) throw new Error('defineConcepts: name at least one concept.');
  if (entries.length > MAX_CONCEPTS) {
    throw new Error(`defineConcepts: ${entries.length} concepts; a lesson has at most ${MAX_CONCEPTS}. Split the lesson or merge concepts.`);
  }
  const usedHue = new Map<Hue, string>();
  const usedLine = new Map<LineStyle, string>();
  const parsed = entries.map(([name, raw]) => {
    const s: ConceptSpec = typeof raw === 'string' ? { hue: raw } : raw;
    if (!NAME_RE.test(name)) throw new Error(`defineConcepts: "${name}" must be lowercase letters, digits and hyphens.`);
    if ((s.hue as string) === 'correct' || (s.hue as string) === 'green') {
      throw new Error(`defineConcepts: "${name}" cannot be green. Green means correct/solution, a state the learner earns, never a concept.`);
    }
    const allowed: readonly string[] = ['input', 'output', 'error', 'prob', ...FREE_HUES];
    if (!allowed.includes(s.hue)) {
      throw new Error(`defineConcepts: "${name}" has hue "${s.hue}". Use a meaning (input, output, error, prob) or a free ink (teal, rose, gold).`);
    }
    const h = hueOf(s.hue);
    const prev = usedHue.get(h);
    if (prev) throw new Error(`defineConcepts: "${name}" and "${prev}" both use ${h}. One ink per concept.`);
    usedHue.set(h, name);
    if (s.line) {
      const clash = usedLine.get(s.line);
      if (clash) throw new Error(`defineConcepts: "${name}" and "${clash}" both use the ${s.line} line style.`);
      usedLine.set(s.line, name);
    }
    return { name, s, h };
  });
  // Second pass: defaults, taking the next free style on a clash.
  const concepts: Concept[] = parsed.map(({ name, s, h }) => {
    let line = s.line;
    if (!line) {
      const want = DEFAULT_LINE[h];
      line = usedLine.has(want) ? LINE_STYLES.find((ls) => !usedLine.has(ls)) : want;
      if (!line) throw new Error('defineConcepts: ran out of line styles.');
      usedLine.set(line, name);
    }
    return {
      name,
      hue: h,
      role: s.hue,
      line,
      label: s.label ?? name,
      symbol: s.symbol,
      className: `ct ct-${name}`,
      cssVar: `var(--ct-${name})`,
    };
  });
  return new ConceptSet<N>(concepts);
}

// ── Theme preference (light / dark / follow the OS) ────────────────────────

export type ThemePreference = ThemeName | 'system';
export const THEME_STORAGE_KEY = 'coolstuff:theme';
export const THEME_EVENT = 'coolstuff:themechange';

/** Pure: which theme shows for a preference, given the OS setting. */
export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ThemeName {
  return pref === 'system' ? (systemPrefersDark ? 'dark' : 'light') : pref;
}

/**
 * Inline this in every page's <head>, before any stylesheet, so a pinned
 * theme applies before first paint (no flash). Mirrors `readThemePreference`.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;

const hasDom = (): boolean => typeof document !== 'undefined';
const systemDark = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export function readThemePreference(): ThemePreference {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

/** The theme on screen right now. */
export function currentTheme(): ThemeName {
  if (!hasDom()) return 'light';
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' || t === 'dark' ? t : systemDark() ? 'dark' : 'light';
}

function syncMetaThemeColor(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = SURFACES[currentTheme()].paper;
}

/** Show a preference without saving it. */
export function applyThemePreference(pref: ThemePreference): void {
  if (!hasDom()) return;
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  syncMetaThemeColor();
  document.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: currentTheme() }));
}

/** Show and remember a preference (shared by every page of the site). */
export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  applyThemePreference(pref);
}

/** Flip to the other theme and pin it. Returns the theme now showing. */
export function toggleTheme(): ThemeName {
  const next: ThemeName = currentTheme() === 'dark' ? 'light' : 'dark';
  setThemePreference(next);
  return next;
}

/** Apply the saved preference (the boot script normally did already) and keep meta theme-color in sync. */
export function initTheme(): void {
  if (!hasDom()) return;
  applyThemePreference(readThemePreference());
}

/** Call `cb` whenever the visible theme changes (toggle, OS switch, another tab). Returns an unsubscribe. */
export function onThemeChange(cb: (theme: ThemeName) => void): () => void {
  if (!hasDom()) return () => {};
  let last = currentTheme();
  const fire = () => {
    const now = currentTheme();
    if (now !== last) {
      last = now;
      cb(now);
    }
  };
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) applyThemePreference(readThemePreference());
  };
  mq?.addEventListener('change', fire);
  document.addEventListener(THEME_EVENT, fire);
  window.addEventListener('storage', onStorage);
  return () => {
    mq?.removeEventListener('change', fire);
    document.removeEventListener(THEME_EVENT, fire);
    window.removeEventListener('storage', onStorage);
  };
}

// ── Non-colour tokens (mirrored in tokens.css) ─────────────────────────────

/** Motion: durations (ms) and easings. Everything collapses under prefers-reduced-motion. */
export const MOTION = {
  /** State feedback (hover, press). Not motion: colour and border only. */
  instant: 140,
  /** Reveals: hint, explanation, solution, toggle. */
  reveal: 240,
  /** A derivation step entering; a figure tween. */
  step: 420,
  /** Emphasis: highlighter sweep, leader draw-in, snap flash. */
  emphasis: 600,
  easeOut: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.45, 0, 0.2, 1)',
  /** Small settles only (handle snap, mission tick), ≤ 240ms. */
  easeSnap: 'cubic-bezier(0.3, 1.35, 0.5, 1)',
} as const;

/** Breakpoints (px, min-width). */
export const BREAKPOINTS = { phone: 0, tablet: 700, margin: 1000, rail: 1240 } as const;

/** Page geometry at ≥ 1240px (px). */
export const GRID = { rail: 164, text: 608, gutter: 56, margin: 248 } as const;

/** Minimum touch target (px). */
export const HIT = 44;
