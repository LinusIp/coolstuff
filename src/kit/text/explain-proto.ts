/**
 * PROTOTYPE, copied from the design study (kit/_dev/design/explain.ts, gitignored) so G1 has it
 * in the repo: the measured explain-this layout. G1 turns it into the pure, tested
 * `text/explain-layout.ts` (+ Formula) and then deletes this file. Not exported from any barrel.
 */
/**
 * "Explain this" layout for a key formula (DESIGN.md §7): plain-word notes
 * under symbols joined by curved leaders in each concept's ink, brackets over
 * groups, and on narrow blocks a dotted-rule key with line-style stubs under
 * each term. Positions are measured from the rendered KaTeX, so the TeX stays
 * the single source of truth.
 */

export interface RowItem {
  want: number;
  w: number;
}

/** Left edges for labels as close to their wanted centres as possible, in order, `gap` apart, inside [0, W]. */
export function packRow(items: RowItem[], W: number, gap: number): number[] | null {
  const total = items.reduce((s, it) => s + it.w, 0) + gap * Math.max(0, items.length - 1);
  if (total > W + 0.5) return null;
  const x = items.map((it) => it.want - it.w / 2);
  for (let i = 0; i < x.length; i++) x[i] = Math.max(x[i], i === 0 ? 0 : x[i - 1] + items[i - 1].w + gap);
  for (let i = x.length - 1; i >= 0; i--) x[i] = Math.min(x[i], i === x.length - 1 ? W - items[i].w : x[i + 1] - gap - items[i].w);
  return x;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
}

const GLYPHS = '.mord, .mop, .mbin, .mrel, .mopen, .mclose, .minner';

function termBox(term: Element, origin: DOMRect): Box {
  const parts = [...term.querySelectorAll(GLYPHS)];
  const rects = (parts.length ? parts : [term]).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
  const left = Math.min(...rects.map((q) => q.left)) - origin.left;
  const right = Math.max(...rects.map((q) => q.right)) - origin.left;
  const top = Math.min(...rects.map((q) => q.top)) - origin.top;
  const bottom = Math.max(...rects.map((q) => q.bottom)) - origin.top;
  return { left, right, top, bottom, cx: (left + right) / 2 };
}

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag: string, attrs: Record<string, string | number>, parent: Element): SVGElement {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent.appendChild(e);
  return e;
}

/** Smooth S-curve from a dot under the glyph down to the top of its note. */
function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dy = y2 - y1;
  return `M${x1} ${y1}C${x1} ${y1 + dy * 0.55} ${x2} ${y2 - dy * 0.55} ${x2} ${y2}`;
}

/**
 * Lay out one `.formula` block. Markup it expects:
 *   .formula__stage > .formula__over (brackets: .bracket[data-for=anchorId])
 *                   > .math-key (KaTeX with \anchor{id}{…} terms)
 *                   > ol.formula__notes > li[data-for=anchorId]
 *                   > svg.formula__leaders
 */
export function layoutExplain(block: HTMLElement): void {
  const stage = block.querySelector<HTMLElement>('.formula__stage');
  const math = block.querySelector<HTMLElement>('.math-key');
  const notes = block.querySelector<HTMLElement>('.formula__notes');
  const over = block.querySelector<HTMLElement>('.formula__over');
  const svg = block.querySelector<SVGSVGElement>('.formula__leaders');
  if (!stage || !math || !notes || !svg || !over) return;
  svg.replaceChildren();
  stage.querySelectorAll('.term-stub').forEach((s) => s.remove());
  const W = stage.clientWidth;
  const stacked = W < 560;
  block.classList.toggle('is-stacked', stacked);

  const items = [...notes.querySelectorAll<HTMLElement>(':scope > li')];
  const brackets = [...over.querySelectorAll<HTMLElement>('.bracket')];
  const find = (id: string) => math.querySelector(`[data-anchor="${id}"]`);

  // Brackets above groups (both modes): label, then a thin bracket over the group.
  over.style.height = '0px';
  let o = stage.getBoundingClientRect();
  const bh = Math.max(0, ...brackets.map((b) => b.offsetHeight));
  over.style.height = `${bh + 14}px`;
  o = stage.getBoundingClientRect();
  const bBoxes = brackets.map((b) => {
    const t = find(b.dataset.for ?? '');
    return t ? termBox(t, o) : null;
  });
  const bLefts = packRow(
    brackets.map((b, i) => ({ want: bBoxes[i]?.cx ?? 0, w: b.offsetWidth })),
    W,
    16,
  );
  brackets.forEach((b, i) => {
    const box = bBoxes[i];
    if (!box) return;
    const bw = b.offsetWidth;
    b.style.left = `${bLefts ? bLefts[i] : Math.max(0, Math.min(W - bw, box.cx - bw / 2))}px`;
    const y = box.top - 6;
    const cls = b.dataset.concept ? `leader ct ct-${b.dataset.concept}` : 'leader';
    svgEl('path', { class: cls, d: `M${box.left + 1} ${y + 4}V${y}H${box.right - 1}V${y + 4}M${box.cx} ${y}V${y - 5}` }, svg);
  });

  if (stacked) {
    notes.style.height = '';
    items.forEach((li) => {
      li.style.left = '';
      li.style.width = '';
      const t = find(li.dataset.for ?? '');
      if (!t) return;
      const box = termBox(t, o);
      // A short stub in the term's line style ties the key row back to the symbol.
      const stub = document.createElement('span');
      stub.className = `term-stub ct ct-${li.dataset.concept}`;
      stub.style.left = `${box.left + 1}px`;
      stub.style.width = `${Math.max(10, box.right - box.left - 2)}px`;
      stub.style.top = `${box.bottom + 5}px`;
      stage.appendChild(stub);
    });
    return;
  }

  // Wide: notes in one row under their symbols, packed so they never overlap.
  const mathBottom = math.getBoundingClientRect().bottom - o.top;
  const top = mathBottom + 34;
  const colW = Math.min(190, (W - 24 * (items.length - 1)) / items.length);
  items.forEach((li) => (li.style.width = `${colW}px`));
  const boxes = items.map((li) => {
    const t = find(li.dataset.for ?? '');
    return t ? termBox(t, o) : null;
  });
  const lefts = packRow(
    items.map((li, i) => ({ want: boxes[i]?.cx ?? 0, w: li.offsetWidth })),
    W,
    20,
  );
  let maxH = 0;
  items.forEach((li, i) => {
    const box = boxes[i];
    if (!box || !lefts) return;
    li.style.left = `${lefts[i]}px`;
    li.style.top = `${top - (notes.getBoundingClientRect().top - o.top)}px`;
    maxH = Math.max(maxH, li.offsetHeight);
    const x2 = lefts[i] + li.offsetWidth / 2;
    const y1 = box.bottom + 6;
    const cls = `ct ct-${li.dataset.concept}`;
    svgEl('circle', { class: `leader-dot ${cls}`, cx: box.cx, cy: y1, r: 2.2 }, svg);
    svgEl('path', { class: `leader ${cls}`, d: curve(box.cx, y1 + 2, x2, top - 4) }, svg);
  });
  notes.style.height = `${top - (notes.getBoundingClientRect().top - o.top) + maxH}px`;
}
