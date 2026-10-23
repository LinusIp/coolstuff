/**
 * GraphView (README §9.3): nodes and edges in SVG, directed (arrowheads) or
 * not, with weights, node badges (distances, discovery times, ∞), marks on
 * nodes and edges, and four layouts: `given` (x, y in 0..1), `force`
 * (seeded, stable), `layered` (DAGs, left to right) and `circle`. Nodes move
 * by id when the layout changes (FLIP, 420ms); a two-way pair of directed
 * edges bends apart; self-loops sit above their node. `editable` lets the
 * learner drag nodes (or move the focused one with the arrow keys).
 *
 *   <GraphView state={dijkstraState} label="Dijkstra from A" showWeights />
 *
 * DOM: div.ds.ds-graph.plate__stage > .ds-scroll > svg.ds-svg[role=group] >
 * g.ds-edges > g.ds-edge[data-edge="from->to"][data-mark] · g.ds-nodes >
 * g.ds-node[data-node][data-mark] (role=button + tabindex when clickable or
 * editable, else role=img) · p.sr-only summary.
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { useKit } from '../core/context';
import { useElementSize, useReducedMotion } from '../core/hooks';
import type { GraphState } from '../types';
import { cellText, graphEdgeLabel, graphNodeLabel, summarizeGraph } from './describe';
import type { Pos } from './flip';
import {
  defaultGraphLayout,
  edgeGeometry,
  edgeKey,
  edgeMarkOf,
  graphBox,
  graphUnitPositions,
  hasReverse,
  placeUnit,
  selfLoopGeometry,
  unitFromPixel,
  type EdgeGeom,
  type GraphLayoutName,
} from './geometry';
import { markClass, markInfo } from './marks';
import { useFlip } from './motion';
import { graphSequence, navLinear } from './nav';
import { conceptStroke, NodeGlyph, NodeShape, onActivate, readState, useChanges, useRoving, type StateProp } from './shared';

export interface GraphViewProps {
  /** graph, nodeMarks?, edgeMarks? ("from->to"), nodeBadges? (types.ts §8). */
  state: StateProp<GraphState>;
  label: string;
  /** Default: 'given' when every node has x, y (0..1), else 'force'. */
  layout?: GraphLayoutName;
  /** Show edge weights at the middle of each edge (an edge's `label` always shows). */
  showWeights?: boolean;
  /** Drag nodes; keyboard: every node is a tab stop and the arrows move it (Shift ×5). */
  editable?: boolean;
  /** Makes nodes buttons (one tab stop shared with clickable edges; arrows walk nodes in id order, edges after their source). */
  onNodeClick?: (id: string) => void;
  /** Makes edges buttons; receives "from->to" as the edge is given. */
  onEdgeClick?: (key: string) => void;
  /** While a node is dragged or moved by keys: its new position in the unit square. */
  onNodeMove?: (id: string, x: number, y: number) => void;
  /** Height ÷ width of the drawing (default by layout). */
  aspect?: number;
  /** Seed for the force layout (default 7): the same graph always lands the same way. */
  seed?: number;
  describeNode?: (id: string, state: GraphState) => string;
  describeEdge?: (key: string, state: GraphState) => string;
  class?: string;
}

const NODE = 44;
const R = NODE / 2 - 2;
const STEP = 0.02;

const fmt = (p: Pos) => `translate(${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10})`;

export function GraphView(props: GraphViewProps) {
  const { state, label, showWeights, editable, onNodeClick, onEdgeClick, onNodeMove, aspect, seed = 7, describeNode, describeEdge, class: cls } = props;
  const s = readState(state);
  const g = s.graph;
  const { concepts } = useKit();
  const reduced = useReducedMotion();
  const sumId = useId();
  const layoutName = props.layout ?? defaultGraphLayout(g);

  // Positions depend on the graph's structure, not on object identity (traces often rebuild it).
  const sig = useMemo(
    () => `${layoutName}|${seed}|${g.nodes.map((n) => `${n.id}:${n.x ?? ''}:${n.y ?? ''}`).join(',')}|${g.edges.map((e) => `${e.from}>${e.to}`).join(',')}`,
    [g, layoutName, seed],
  );
  const unit = useMemo(() => graphUnitPositions(g, layoutName, seed), [sig]);
  const [moved, setMoved] = useState<ReadonlyMap<string, [number, number]>>(new Map());

  const scrollEl = useRef<HTMLDivElement>(null);
  const avail = useElementSize(scrollEl).width;
  const box = useMemo(() => graphBox(g, layoutName, Math.max(0, Math.floor(avail || 600) - 2), { node: NODE, aspect }), [sig, avail, aspect]);
  const pos = useMemo(() => {
    const m = new Map<string, Pos>();
    for (const n of g.nodes) {
      const u = moved.get(n.id) ?? unit.get(n.id) ?? [0.5, 0.5];
      m.set(n.id, placeUnit(u, box));
    }
    return m;
  }, [g, unit, moved, box]);

  const dragging = useRef<{ id: string; pointer: number; x0: number; y0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const lastBox = useRef(box);
  const instant = lastBox.current.width !== box.width || lastBox.current.height !== box.height || !!dragging.current;
  lastBox.current = box;

  const edges = useMemo(() => [...g.edges].map((e, i) => ({ ...e, key: edgeKey(e.from, e.to), i })).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }) || a.i - b.i), [g]);
  const geomOf = (from: Pos, to: Pos, e: { from: string; to: string }): EdgeGeom =>
    e.from === e.to ? selfLoopGeometry(from, R + 2, g.directed ? 8 : 0) : edgeGeometry(from, to, { r1: R + 2, r2: R + 3, bend: hasReverse(g, e.from, e.to) ? 18 : 0, arrow: g.directed ? 9 : 0 });

  const nodeEls = useRef(new Map<string, SVGGElement>());
  const edgeEls = useRef(new Map<string, SVGGElement>());
  const edgesNow = useRef(edges);
  edgesNow.current = edges;
  useFlip(
    pos,
    (p) => {
      for (const [id, el] of nodeEls.current) {
        const q = p.get(id);
        if (q) el.setAttribute('transform', fmt(q));
      }
      for (const e of edgesNow.current) {
        const a = p.get(e.from);
        const b = p.get(e.to);
        const el = edgeEls.current.get(`${e.key}#${e.i}`);
        if (!a || !b || !el) continue;
        const geo = geomOf(a, b, e);
        el.querySelectorAll<SVGPathElement>('.ds-edge__line, .ds-edge__case, .ds-edge__hitline').forEach((path) => path.setAttribute('d', geo.d));
        el.querySelector('.ds-edge__head')?.setAttribute('d', geo.head ?? '');
        el.querySelector('.ds-edge__mid')?.setAttribute('transform', fmt(geo.mid));
      }
    },
    reduced,
    { instant },
  );
  const { entered } = useChanges(g.nodes.map((n) => [n.id, n.label ?? n.id] as const));

  // ── Keyboard ──
  const clickable = !!onNodeClick || !!onEdgeClick;
  const seq = useMemo(() => (clickable && !editable ? graphSequence(g, { nodes: !!onNodeClick, edges: !!onEdgeClick }) : []), [g, clickable, editable, !!onNodeClick, !!onEdgeClick]);
  const roving = useRoving(seq.map((x) => x.key));
  const tabFor = (key: string): 0 | -1 => (editable ? 0 : roving.tabIndex(key));

  const moveNode = (id: string, u: [number, number]) => {
    setMoved((m) => new Map(m).set(id, u));
    onNodeMove?.(id, u[0], u[1]);
  };
  const onKeyDown = (e: JSX.TargetedKeyboardEvent<SVGElement>) => {
    const rk = (e.target as Element).getAttribute?.('data-rk');
    if (!rk) return;
    if (editable && rk.startsWith('n:')) {
      const id = rk.slice(2);
      const d = (e.shiftKey ? 5 : 1) * STEP;
      const dir: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
      const v = dir[e.key];
      if (!v) return;
      e.preventDefault();
      const cur = moved.get(id) ?? unit.get(id) ?? [0.5, 0.5];
      moveNode(id, [Math.min(1, Math.max(0, cur[0] + v[0])), Math.min(1, Math.max(0, cur[1] + v[1]))]);
      return;
    }
    if (editable) return;
    const i = seq.findIndex((x) => x.key === rk);
    if (i < 0) return;
    const next = navLinear(e.key, i, seq.length);
    if (next === null) return;
    e.preventDefault();
    roving.focusKey(seq[next].key);
  };

  // ── Dragging (editable) ──
  const svgRef = useRef<SVGSVGElement | null>(null);
  const toUnit = (ev: PointerEvent): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return unitFromPixel([ev.clientX - r.left, ev.clientY - r.top], box);
  };
  const dragHandlers = (id: string) =>
    editable
      ? {
          onPointerDown: (ev: JSX.TargetedPointerEvent<SVGGElement>) => {
            if (ev.button !== 0) return;
            ev.currentTarget.setPointerCapture(ev.pointerId);
            dragging.current = { id, pointer: ev.pointerId, x0: ev.clientX, y0: ev.clientY, moved: false };
          },
          onPointerMove: (ev: JSX.TargetedPointerEvent<SVGGElement>) => {
            const d = dragging.current;
            if (!d || d.pointer !== ev.pointerId) return;
            if (!d.moved && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 4) return;
            d.moved = true;
            ev.preventDefault();
            moveNode(id, toUnit(ev));
          },
          onPointerUp: (ev: JSX.TargetedPointerEvent<SVGGElement>) => {
            const d = dragging.current;
            if (!d || d.pointer !== ev.pointerId) return;
            suppressClick.current = d.moved;
            dragging.current = null;
          },
          onPointerCancel: () => {
            dragging.current = null;
          },
        }
      : {};

  const boxW = box.width;
  const overflow = avail > 0 && boxW > avail + 1;

  return (
    <div class={['ds', 'ds-graph', 'plate__stage', clickable ? 'is-interactive' : '', editable ? 'is-editable' : '', cls].filter(Boolean).join(' ')}>
      <div
        class="ds-scroll"
        ref={scrollEl}
        tabIndex={overflow && !clickable && !editable ? 0 : undefined}
        role={overflow && !clickable && !editable ? 'region' : undefined}
        aria-label={overflow && !clickable && !editable ? `${label} (scrolls sideways)` : undefined}
      >
        {g.nodes.length === 0 ? (
          <p class="ds-empty">Empty graph</p>
        ) : (
          <svg
            class="ds-svg"
            width={box.width}
            height={box.height}
            viewBox={`0 0 ${box.width} ${box.height}`}
            role="group"
            aria-label={label}
            aria-describedby={sumId}
            ref={(el) => {
              svgRef.current = el;
              roving.root.current = el;
            }}
            onKeyDown={onKeyDown}
          >
            <title>{label}</title>
            <g class="ds-edges">
              {edges.map((e) => {
                const a = pos.get(e.from);
                const b = pos.get(e.to);
                if (!a || !b) return null;
                const geo = geomOf(a, b, e);
                const info = markInfo(edgeMarkOf(s.edgeMarks, e.from, e.to, !!g.directed), concepts);
                const st = conceptStroke(info, 2.5, concepts);
                const text = e.label ?? (showWeights && e.weight !== undefined ? cellText(e.weight) : '');
                const eKey = `e:${e.key}`;
                const aria = describeEdge ? describeEdge(e.key, s) : graphEdgeLabel(s, e.from, e.to, concepts);
                const a11y = onEdgeClick
                  ? {
                      role: 'button' as const,
                      tabindex: tabFor(eKey),
                      'data-rk': eKey,
                      onClick: () => {
                        roving.setActive(eKey);
                        onEdgeClick(e.key);
                      },
                      onKeyDown: onActivate(() => onEdgeClick(e.key)),
                    }
                  : { role: 'img' as const };
                return (
                  <g
                    key={`${e.key}#${e.i}`}
                    class={['ds-edge', markClass(info), onEdgeClick ? 'is-button' : ''].filter(Boolean).join(' ')}
                    data-mark={info?.mark}
                    data-edge={e.key}
                    data-double={st.double ? '' : undefined}
                    aria-label={aria}
                    ref={(el) => {
                      if (el) edgeEls.current.set(`${e.key}#${e.i}`, el);
                      else edgeEls.current.delete(`${e.key}#${e.i}`);
                    }}
                    {...a11y}
                  >
                    {onEdgeClick && <path class="ds-edge__hitline" d={geo.d} />}
                    {st.double && <path class="ds-edge__case" d={geo.d} />}
                    <path class="ds-edge__line" d={geo.d} stroke-dasharray={st.dash} stroke-linecap={st.cap} />
                    {geo.head !== null && <path class="ds-edge__head" d={geo.head} />}
                    {(text || info?.glyph || onEdgeClick) && (
                      <g class="ds-edge__mid" transform={fmt(geo.mid)}>
                        {onEdgeClick && <circle class="ds-edge__hit" r={NODE / 2} />}
                        {text && (
                          <text class="ds-edge__label" aria-hidden="true">
                            {text}
                          </text>
                        )}
                        {info?.glyph && <NodeGlyph info={info} x={text ? 6 + text.length * 4 + 8 : 0} y={text ? -9 : 0} />}
                        {onEdgeClick && <circle class="ds-edge__focus" r={NODE / 2 - 4} />}
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
            <g class="ds-nodes">
              {g.nodes.map((n) => {
                const p = pos.get(n.id)!;
                const info = markInfo(s.nodeMarks?.[n.id], concepts);
                const name = n.label ?? n.id;
                const badge = s.nodeBadges?.[n.id];
                const nKey = `n:${n.id}`;
                const aria = describeNode ? describeNode(n.id, s) : graphNodeLabel(s, n.id, concepts);
                const w = Math.max(NODE, Math.ceil(name.length * 9.2 + 20));
                const button = !!onNodeClick || !!editable;
                const a11y = button
                  ? {
                      role: 'button' as const,
                      tabindex: tabFor(nKey),
                      'data-rk': nKey,
                      'aria-roledescription': editable ? 'movable node' : undefined,
                      onClick: () => {
                        if (suppressClick.current) {
                          suppressClick.current = false;
                          return;
                        }
                        roving.setActive(nKey);
                        onNodeClick?.(n.id);
                      },
                      onKeyDown: onNodeClick ? onActivate(() => onNodeClick(n.id)) : undefined,
                    }
                  : { role: 'img' as const };
                return (
                  <g
                    key={n.id}
                    class={['ds-node', markClass(info), entered.has(n.id) ? 'is-entering' : '', button ? 'is-button' : ''].filter(Boolean).join(' ')}
                    data-mark={info?.mark}
                    data-node={n.id}
                    transform={fmt(p)}
                    aria-label={aria}
                    ref={(el) => {
                      if (el) nodeEls.current.set(n.id, el);
                      else nodeEls.current.delete(n.id);
                    }}
                    {...a11y}
                    {...dragHandlers(n.id)}
                  >
                    {w > NODE ? <rect class="ds-node__hit" x={-w / 2} y={-NODE / 2} width={w} height={NODE} rx={NODE / 2} /> : <circle class="ds-node__hit" r={NODE / 2} />}
                    <NodeShape w={w - 4} h={NODE - 4} info={info} concepts={concepts} cls="ds-node__shape" />
                    <text class="ds-node__label" aria-hidden="true">
                      {name}
                    </text>
                    <NodeGlyph info={info} x={w / 2 - 6} y={-NODE / 2 + 6} />
                    {badge && (
                      <text class="ds-node__badge ds-node__badge--below" y={NODE / 2 + 15} aria-hidden="true">
                        {badge}
                      </text>
                    )}
                    {button && (w > NODE ? <rect class="ds-node__focus" x={-w / 2 - 3} y={-NODE / 2 - 3} width={w + 6} height={NODE + 6} rx={NODE / 2 + 3} /> : <circle class="ds-node__focus" r={NODE / 2 + 3} />)}
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>
      <p class="sr-only" id={sumId}>
        {summarizeGraph(s, concepts)}
      </p>
    </div>
  );
}
