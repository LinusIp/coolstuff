/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUBJECTS } from '@content/curriculum';
import {
  conceptScopeSelector,
  DEFAULT_LINE,
  GLOBAL_CONCEPTS,
  HUE_NAMES,
  HUES,
  LINE_STYLES,
  MARKER_PCT,
  PRINT_SURFACES,
  SURFACES,
  SURFACE_TOKENS,
  THEME_BOOT_SCRIPT,
  THEME_STORAGE_KEY,
  WASH_PCT,
  contrastRatio,
  defineConcepts,
  marker,
  mix,
  oklabDistance,
  parseHex,
  relativeLuminance,
  resolveTheme,
  shorthandMacro,
  strokeFor,
  subjectInk,
  toOklab,
  underlineFor,
  wash,
  type Hue,
  type SurfaceToken,
  type ThemeName,
} from './theme';

const THEMES: ThemeName[] = ['light', 'dark'];
const TEXT = 4.5; // WCAG AA, normal text
const GRAPHIC = 3; // WCAG AA, large text and graphical objects / UI boundaries
const READING_SURFACES: SurfaceToken[] = ['paper', 'raised', 'sunk', 'plate'];

const css = (file: string) => readFileSync(join(import.meta.dirname, 'styles', file), 'utf8');

/** Custom properties declared directly inside the first block whose selector matches. */
function declarations(source: string, selector: RegExp): Record<string, string> {
  const m = selector.exec(source);
  if (!m) throw new Error(`no block for ${selector}`);
  let i = source.indexOf('{', m.index) + 1;
  let depth = 1;
  const start = i;
  while (depth > 0 && i < source.length) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  const body = source.slice(start, i - 1);
  const out: Record<string, string> = {};
  for (const d of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  return out;
}

describe('contrast maths', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // #767676 on white is the classic 4.54:1 grey.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6);
    expect(parseHex('#abc')).toEqual([170, 187, 204]);
  });
  it('mixes like color-mix over a surface', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#0000ff', 1)).toBe('#ff0000');
  });
  it('is symmetric', () => {
    expect(contrastRatio('#2366b4', '#f8f5ee')).toBeCloseTo(contrastRatio('#f8f5ee', '#2366b4'), 10);
  });
});

for (const t of THEMES) {
  describe(`${t} theme meets WCAG AA`, () => {
    const S = SURFACES[t];
    const H = HUES[t];

    it('ink, ink-2 and ink-3 are text-safe on every reading surface', () => {
      for (const ink of ['ink', 'ink-2', 'ink-3'] as const) {
        for (const s of READING_SURFACES) expect(contrastRatio(S[ink], S[s]), `${ink} on ${s}`).toBeGreaterThanOrEqual(TEXT);
      }
    });
    it('primary buttons (on-ink on ink) are text-safe', () => {
      expect(contrastRatio(S['on-ink'], S.ink)).toBeGreaterThanOrEqual(TEXT);
    });
    it('control boundaries, axes and the focus ring clear 3:1', () => {
      for (const s of ['paper', 'raised', 'sunk'] as const) {
        expect(contrastRatio(S['ui-line'], S[s]), `ui-line on ${s}`).toBeGreaterThanOrEqual(GRAPHIC);
        expect(contrastRatio(S.ink, S[s]), `focus ring on ${s}`).toBeGreaterThanOrEqual(GRAPHIC);
      }
      expect(contrastRatio(S.axis, S.plate), 'axis on plate').toBeGreaterThanOrEqual(GRAPHIC);
      expect(contrastRatio(S.axis, S.raised), 'axis on raised').toBeGreaterThanOrEqual(GRAPHIC);
      expect(contrastRatio(S.axis, S.sunk), 'axis on sunk').toBeGreaterThanOrEqual(GRAPHIC);
    });
    it('every ink is text-safe on every reading surface (so one token colours a stroke, a symbol and a word)', () => {
      for (const h of HUE_NAMES) {
        for (const s of READING_SURFACES) expect(contrastRatio(H[h], S[s]), `${h} on ${s}`).toBeGreaterThanOrEqual(TEXT);
      }
    });
    it('every ink stays text-safe on its own wash, and ink stays safe on every wash', () => {
      for (const h of HUE_NAMES) {
        for (const s of ['paper', 'raised'] as const) {
          const w = wash(h, t, s);
          expect(contrastRatio(H[h], w), `${h} on its wash over ${s}`).toBeGreaterThanOrEqual(TEXT);
          expect(contrastRatio(S.ink, w), `ink on ${h} wash over ${s}`).toBeGreaterThanOrEqual(TEXT);
          expect(contrastRatio(S['ink-2'], w), `ink-2 on ${h} wash over ${s}`).toBeGreaterThanOrEqual(TEXT);
        }
      }
    });
    it('the highlighter never costs a term its contrast', () => {
      for (const s of ['paper', 'raised'] as const) {
        const m = marker(t, s);
        expect(contrastRatio(S.ink, m), `ink over marker on ${s}`).toBeGreaterThanOrEqual(TEXT);
        for (const h of HUE_NAMES) expect(contrastRatio(H[h], m), `${h} over marker on ${s}`).toBeGreaterThanOrEqual(TEXT);
      }
    });
    it('text on a filled ink (quiz keys, solved dots) is text-safe', () => {
      for (const h of HUE_NAMES) expect(contrastRatio(S['on-ink'], H[h]), `on-ink on ${h}`).toBeGreaterThanOrEqual(TEXT);
    });
    it('every ink clears 3:1 as a graphic on the figure plate and grid', () => {
      for (const h of HUE_NAMES) {
        expect(contrastRatio(H[h], S.plate)).toBeGreaterThanOrEqual(GRAPHIC);
        expect(contrastRatio(H[h], S.grid)).toBeGreaterThanOrEqual(GRAPHIC);
      }
    });
    it('inks are distinguishable from one another', () => {
      for (let i = 0; i < HUE_NAMES.length; i++) {
        for (let j = i + 1; j < HUE_NAMES.length; j++) {
          const a = HUE_NAMES[i];
          const b = HUE_NAMES[j];
          expect(oklabDistance(H[a], H[b]), `${a} vs ${b}`).toBeGreaterThanOrEqual(0.07);
        }
      }
    });
    it('every subject ink is text-safe on paper and raised', () => {
      for (const s of SUBJECTS) {
        const c = subjectInk(s.hue, t);
        expect(contrastRatio(c, S.paper), s.id).toBeGreaterThanOrEqual(TEXT);
        expect(contrastRatio(c, S.raised), s.id).toBeGreaterThanOrEqual(TEXT);
      }
    });
  });
}

describe('inks keep their identity across themes', () => {
  const angle = (hex: string) => {
    const [, a, b] = toOklab(hex);
    return (Math.atan2(b, a) * 180) / Math.PI;
  };
  it('light, dark and print versions of an ink share a hue angle (±20°)', () => {
    for (const h of HUE_NAMES) {
      for (const other of ['dark', 'print'] as const) {
        let d = Math.abs(angle(HUES.light[h]) - angle(HUES[other][h]));
        d = Math.min(d, 360 - d);
        expect(d, `${h} ${other}`).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe('print set (TL;DR revision sheet on white)', () => {
  it('every print ink and print text colour is text-safe on white', () => {
    for (const h of HUE_NAMES) expect(contrastRatio(HUES.print[h], PRINT_SURFACES.paper), h).toBeGreaterThanOrEqual(TEXT);
    for (const ink of ['ink', 'ink-2', 'ink-3'] as const) {
      expect(contrastRatio(PRINT_SURFACES[ink], PRINT_SURFACES.paper)).toBeGreaterThanOrEqual(TEXT);
    }
  });
  it('components.css print block matches the print tables', () => {
    const src = css('components.css');
    const at = src.indexOf('@media print');
    const decl = declarations(src.slice(at), /html:root:not\(\[data-print='as-screen'\]\)\s*\{/);
    for (const h of HUE_NAMES) expect(decl[`--hue-${h}`], h).toBe(HUES.print[h]);
    expect(decl['--paper']).toBe(PRINT_SURFACES.paper);
    expect(decl['--ink']).toBe(PRINT_SURFACES.ink);
    expect(decl['--ink-2']).toBe(PRINT_SURFACES['ink-2']);
    expect(decl['--ink-3']).toBe(PRINT_SURFACES['ink-3']);
  });
});

describe('tokens.css mirrors theme.ts', () => {
  const src = css('tokens.css');
  const light = declarations(src, /^:root\s*\{/m);
  const pinnedDark = declarations(src, /:root\[data-theme='dark'\]\s*\{/);
  const mediaAt = src.indexOf('@media (prefers-color-scheme: dark)');
  const osDark = declarations(src.slice(mediaAt), /:root:not\(\[data-theme='light'\]\)\s*\{/);
  const derived = declarations(src, /:root,\s*:root\[data-theme\]\s*\{/);

  it('light block holds every surface and ink exactly', () => {
    for (const k of SURFACE_TOKENS) expect(light[`--${k}`], k).toBe(SURFACES.light[k]);
    for (const h of HUE_NAMES) expect(light[`--hue-${h}`], h).toBe(HUES.light[h]);
    expect(light['--marker-pct']).toBe(`${MARKER_PCT.light * 100}%`);
  });
  it('dark block holds every surface and ink exactly', () => {
    for (const k of SURFACE_TOKENS) expect(pinnedDark[`--${k}`], k).toBe(SURFACES.dark[k]);
    for (const h of HUE_NAMES) expect(pinnedDark[`--hue-${h}`], h).toBe(HUES.dark[h]);
    expect(pinnedDark['--marker-pct']).toBe(`${MARKER_PCT.dark * 100}%`);
  });
  it('the OS-dark block is identical to the pinned-dark block', () => {
    expect(osDark).toEqual(pinnedDark);
  });
  it('washes use the WASH_PCT share and semantic aliases point at the right inks', () => {
    for (const h of HUE_NAMES) expect(derived[`--w-${h}`]).toBe(`color-mix(in srgb, var(--hue-${h}) ${WASH_PCT * 100}%, transparent)`);
    expect(derived['--c-input']).toBe('var(--hue-blue)');
    expect(derived['--c-output']).toBe('var(--hue-orange)');
    expect(derived['--c-error']).toBe('var(--hue-red)');
    expect(derived['--c-correct']).toBe('var(--hue-green)');
    expect(derived['--c-prob']).toBe('var(--hue-purple)');
    expect(derived['--focus']).toBe('var(--ink)');
  });
  it('focus is ink, never a concept hue', () => {
    expect(css('base.css')).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--focus\)/);
  });
});

describe('global concepts in components.css match the generator', () => {
  const src = css('components.css').replace(/\s+/g, '');
  for (const [name, { hue, line }] of Object.entries(GLOBAL_CONCEPTS)) {
    it(`.ct-${name} wears ${hue} and a ${line} underline`, () => {
      const block = new RegExp(`\\.ct-${name}\\{([^}]*)\\}`).exec(src)?.[1] ?? '';
      expect(block).toContain(`--c:var(--hue-${hue})`);
      expect(block).toContain(`--w:var(--w-${hue})`);
      expect(block).toContain(`--u:${underlineFor(line).replace(/\s+/g, '')}`);
    });
  }
});

describe('line styles', () => {
  it('every ink has a default line style, and the global meanings are all different', () => {
    for (const h of HUE_NAMES) expect(LINE_STYLES).toContain(DEFAULT_LINE[h]);
    const globalLines = Object.entries(GLOBAL_CONCEPTS)
      .filter(([k]) => k !== 'correct')
      .map(([, v]) => v.line);
    expect(new Set(globalLines).size).toBe(globalLines.length);
  });
  it('dash patterns scale with the stroke width', () => {
    expect(strokeFor('solid', 2).dasharray).toBeNull();
    expect(strokeFor('dashed', 2).dasharray).toBe('6.4 4');
    expect(strokeFor('dashed', 1).dasharray).toBe('3.2 2');
    expect(strokeFor('dotted', 2).linecap).toBe('round');
    expect(strokeFor('double', 2).double).toBe(true);
  });
  it('underlines draw in the concept colour', () => {
    for (const ls of LINE_STYLES) expect(underlineFor(ls)).toContain('var(--c)');
  });
});

describe('defineConcepts', () => {
  const C = defineConcepts({
    input: { hue: 'input', label: 'input vector', symbol: '\\mathbf{v}' },
    output: { hue: 'output', label: 'output', symbol: 'A\\mathbf{v}' },
    matrix: { hue: 'teal', label: 'the matrix', symbol: 'A' },
    eigenvalue: { hue: 'rose', label: 'eigenvalue', symbol: '\\lambda' },
  });

  it('maps names to inks, line styles, classes and CSS variables', () => {
    expect(C.names).toEqual(['input', 'output', 'matrix', 'eigenvalue']);
    expect(C.get('matrix').hue).toBe('teal');
    expect(C.line('matrix')).toBe('dotted');
    expect(C.line('eigenvalue')).toBe('double');
    expect(C.className('matrix')).toBe('ct ct-matrix');
    expect(C.color('matrix')).toBe('var(--ct-matrix)');
    expect(C.hex('matrix', 'light')).toBe(HUES.light.teal);
    expect(C.hex('output', 'dark')).toBe(HUES.dark.orange);
  });
  it('gives every concept a different line style', () => {
    const lines = C.names.map((n) => C.line(n));
    expect(new Set(lines).size).toBe(lines.length);
  });
  it('emits CSS rules and SVG stroke attributes', () => {
    const text = C.css();
    expect(text).toContain(':root{--ct-matrix:var(--hue-teal)}');
    expect(text).toContain('.ct-matrix{--c:var(--hue-teal);--w:var(--w-teal);');
    expect(text).toContain('[data-hl~="matrix"] .ct-matrix{--lit:1}');
    const s = C.stroke('output', 2.5);
    expect(s.stroke).toBe('var(--ct-output)');
    expect(s['stroke-dasharray']).toBe('8 5');
    expect(C.stroke('eigenvalue')['data-double']).toBe('');
  });
  it('makes shorthand macros from symbols', () => {
    expect(C.macros()).toEqual({
      '\\cInput': '\\colorTerm{input}{\\mathbf{v}}',
      '\\cOutput': '\\colorTerm{output}{A\\mathbf{v}}',
      '\\cMatrix': '\\colorTerm{matrix}{A}',
      '\\cEigenvalue': '\\colorTerm{eigenvalue}{\\lambda}',
    });
    expect(shorthandMacro('eigen-value')).toBe('\\cEigenValue');
  });
  it('resolves a default line-style clash by taking the next free style', () => {
    const D = defineConcepts({ density: 'prob', operator: 'teal' }); // both default to dotted
    expect(D.line('density')).toBe('dotted');
    expect(D.line('operator')).not.toBe('dotted');
  });
  it('respects explicit line styles and fills defaults around them', () => {
    const D = defineConcepts({ force: { hue: 'error', line: 'solid' }, position: 'input' });
    expect(D.line('force')).toBe('solid');
    expect(D.line('position')).not.toBe('solid');
  });
  it('refuses green, too many concepts, shared inks, shared explicit styles and bad names', () => {
    expect(() => defineConcepts({ found: 'correct' as never })).toThrow(/green/i);
    expect(() => defineConcepts({ found: 'green' as never })).toThrow(/green/i);
    expect(() => defineConcepts({ a: 'input', b: 'output', c: 'error', d: 'prob', e: 'teal', f: 'rose' })).toThrow(/at most 5/);
    expect(() => defineConcepts({ x: 'input', y: 'input' })).toThrow(/both use blue/);
    expect(() => defineConcepts({ x: { hue: 'teal', line: 'dashed' }, y: { hue: 'rose', line: 'dashed' } })).toThrow(/dashed/);
    expect(() => defineConcepts({ Bad: 'teal' } as never)).toThrow(/lowercase/);
    expect(() => defineConcepts({ x: 'blue' as never })).toThrow(/meaning/);
    expect(() => defineConcepts({})).toThrow();
  });
  it('legend rows come out in definition order', () => {
    expect(C.legend().map((r) => [r.name, r.hue, r.line])).toEqual([
      ['input', 'blue', 'solid'],
      ['output', 'orange', 'dashed'],
      ['matrix', 'teal', 'dotted'],
      ['eigenvalue', 'rose', 'double'],
    ]);
  });
});

describe('theme preference', () => {
  it('resolves system against the OS setting', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  /** Run the inline boot script against a fake document and storage. */
  function boot(stored: string | null | Error): string | null {
    let attr: string | null = null;
    const documentElement = { setAttribute: (k: string, v: string) => k === 'data-theme' && (attr = v) };
    const localStorage = {
      getItem: (k: string) => {
        if (stored instanceof Error) throw stored;
        return k === THEME_STORAGE_KEY ? stored : null;
      },
    };
    new Function('document', 'localStorage', THEME_BOOT_SCRIPT)({ documentElement }, localStorage);
    return attr;
  }
  it('boot script pins a stored theme before first paint', () => {
    expect(boot('dark')).toBe('dark');
    expect(boot('light')).toBe('light');
  });
  it('boot script follows the OS when nothing (or junk) is stored, and survives blocked storage', () => {
    expect(boot(null)).toBeNull();
    expect(boot('purple')).toBeNull();
    expect(boot(new Error('SecurityError'))).toBeNull();
  });
});

describe('surfaces read as a family', () => {
  it('raised is lighter than paper in light mode and lighter in dark mode too (lamp-lit cards)', () => {
    expect(relativeLuminance(SURFACES.light.raised)).toBeGreaterThan(relativeLuminance(SURFACES.light.paper));
    expect(relativeLuminance(SURFACES.dark.raised)).toBeGreaterThan(relativeLuminance(SURFACES.dark.paper));
  });
  it('every theme defines the same tokens', () => {
    for (const t of THEMES) {
      expect(Object.keys(SURFACES[t]).sort()).toEqual([...SURFACE_TOKENS].sort());
      expect(Object.keys(HUES[t]).sort()).toEqual([...HUE_NAMES].sort());
    }
    expect(Object.keys(HUES.print).sort()).toEqual([...HUE_NAMES].sort());
  });
  it('accepts every hue name as a Hue', () => {
    const all: Hue[] = [...HUE_NAMES];
    expect(all.length).toBe(8);
  });
});

describe('scoped concept CSS (pages that mix lessons)', () => {
  const A = defineConcepts({ rate: { hue: 'teal' } });
  const B = defineConcepts({ rate: { hue: 'gold' } });
  it('scopes rules to [data-lesson] so two lessons keep their own inks', () => {
    const a = A.css('calc1/derivative');
    expect(a).toContain('[data-lesson="calc1/derivative"]{--ct-rate:var(--hue-teal)}');
    expect(a).toContain('[data-lesson="calc1/derivative"] .ct-rate{--c:var(--hue-teal)');
    expect(a).toContain('[data-hl~="rate"] [data-lesson="calc1/derivative"] .ct-rate{--lit:1}');
    expect(a).not.toContain(':root');
    expect(B.css('ml/gradient-descent')).toContain('[data-lesson="ml/gradient-descent"] .ct-rate{--c:var(--hue-gold)');
    expect(conceptScopeSelector('a"b')).toBe('[data-lesson="a\\"b"]');
  });
  it('mount is ref-counted per stylesheet', () => {
    const head: { children: unknown[]; append(el: unknown): void } = {
      children: [],
      append(el) {
        this.children.push(el);
      },
    };
    const doc = {
      head,
      createElement: () => {
        const el = { dataset: {} as Record<string, string>, textContent: '', remove: () => head.children.splice(head.children.indexOf(el), 1) };
        return el;
      },
    } as unknown as Document;
    const r1 = A.mount(doc, 'calc1/derivative');
    const r2 = A.mount(doc, 'calc1/derivative');
    const r3 = B.mount(doc, 'ml/gradient-descent');
    expect(head.children).toHaveLength(2);
    r1();
    r1(); // releasing twice is harmless
    expect(head.children).toHaveLength(2);
    r2();
    expect(head.children).toHaveLength(1);
    r3();
    expect(head.children).toHaveLength(0);
  });
});
