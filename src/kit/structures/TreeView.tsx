/**
 * TreeView (README §9.2): a rooted tree in SVG. `tidy` centres parents over
 * children (heaps, tries, recursion trees); `inorder` places a binary tree
 * by in-order rank, so a BST reads sorted left to right and keeps that order
 * through rotations. Nodes move to their new places by id (FLIP, 420ms;
 * instant under reduced motion); `null` children keep left and right
 * distinct; badges (balance factor, height, colour) sit beside nodes.
 *
 *   <TreeView state={avlState} layout="inorder" label="AVL tree after inserting 7" />
 *
 * DOM: div.ds.ds-tree.plate__stage > .ds-scroll > svg.ds-svg[role=group] >
 * g.ds-edges > g.ds-edge[data-mark] · g.ds-nodes > g.ds-node[data-mark]
 * (role=button + tabindex with onNodeClick, else role=img) · p.sr-only summary.
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef } from 'preact/hooks';
import { useKit } from '../core/context';
import { useElementSize, useReducedMotion } from '../core/hooks';
import type { TreeState } from '../types';
import { summarizeTree, treeNodeLabel } from './describe';
import type { Pos } from './flip';
import { treeGeometry, type TreeNodeGeom } from './geometry';
import { markClass, markInfo } from './marks';
import { useFlip } from './motion';
import { indexTree, navTree } from './nav';
import { byNatural, conceptStroke, NodeGlyph, NodeShape, onActivate, readState, useChanges, useRoving, type StateProp } from './shared';

export interface TreeViewProps {
  /** root, marks?, edgeMarks? ("parentId->childId"), badges? (types.ts §8). */
  state: StateProp<TreeState>;
  label: string;
  /** Default 'tidy'; BSTs, AVL and red–black trees use 'inorder' (sorted left to right). */
  layout?: 'tidy' | 'inorder';
  /** Node diameter in px (default 44, never below 44). */
  nodeSize?: number;
  /** Makes nodes buttons (one tab stop; ↑ parent, ← → children, Home root, End last). */
  onNodeClick?: (id: string) => void;
  /** Replace the spoken label of a node (default "node 7, left child of 9, current, balance +1"). */
  describeNode?: (id: string, state: TreeState) => string;
  class?: string;
}

const linePath = (a: Pos, b: Pos) => `M${Math.round(a[0] * 10) / 10} ${Math.round(a[1] * 10) / 10}L${Math.round(b[0] * 10) / 10} ${Math.round(b[1] * 10) / 10}`;

export function TreeView({ state, label, layout = 'tidy', nodeSize = 44, onNodeClick, describeNode, class: cls }: TreeViewProps) {
  const s = readState(state);
  const { concepts } = useKit();
  const reduced = useReducedMotion();
  const sumId = useId();
  const node = Math.max(44, Math.round(nodeSize));
  const hasBadges = !!s.badges && Object.keys(s.badges).length > 0;

  const geo = useMemo(
    () => treeGeometry(s.root, layout, { node, gap: Math.round(node * (hasBadges ? 0.75 : 0.35)), right: hasBadges ? 30 : 0, pad: 14 }),
    [s.root, layout, node, hasBadges],
  );
  const byId = useMemo(() => new Map(geo.nodes.map((n) => [n.id, n])), [geo]);
  const ordered = useMemo(() => [...geo.nodes].sort((a, b) => byNatural(a.id, b.id)), [geo]);
  const edges = useMemo(() => [...geo.edges].sort((a, b) => byNatural(a.key, b.key)), [geo]);

  const targets = useMemo(() => new Map<string, Pos>(geo.nodes.map((n) => [n.id, [n.x, n.y]])), [geo]);
  const nodeEls = useRef(new Map<string, SVGGElement>());
  const edgeEls = useRef(new Map<string, SVGPathElement>());
  const edgesNow = useRef(edges);
  edgesNow.current = edges;
  useFlip(
    targets,
    (pos) => {
      for (const [id, el] of nodeEls.current) {
        const p = pos.get(id);
        if (p) el.setAttribute('transform', `translate(${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10})`);
      }
      for (const e of edgesNow.current) {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        const el = edgeEls.current.get(e.key);
        if (a && b && el) {
          const d = linePath(a, b);
          el.setAttribute('d', d);
          el.parentElement?.querySelector('.ds-edge__case')?.setAttribute('d', d);
          el.parentElement?.querySelector('.ds-edge__mid')?.setAttribute('transform', `translate(${Math.round(((a[0] + b[0]) / 2) * 10) / 10} ${Math.round(((a[1] + b[1]) / 2) * 10) / 10})`);
        }
      }
    },
    reduced,
  );
  const { entered } = useChanges(geo.nodes.map((n) => [n.id, n.label] as const));

  const interactive = !!onNodeClick;
  const tIndex = useMemo(() => indexTree(s.root), [s.root]);
  const keys = useMemo(() => (interactive ? [...tIndex.order] : []), [interactive, tIndex]);
  const roving = useRoving(keys);
  const onKeyDown = (e: JSX.TargetedKeyboardEvent<SVGElement>) => {
    const rk = (e.target as Element).getAttribute?.('data-rk');
    if (!interactive || !rk) return;
    const next = navTree(e.key, rk, tIndex);
    if (next === null) return;
    e.preventDefault();
    roving.focusKey(next);
  };

  const scrollEl = useRef<HTMLDivElement>(null);
  const box = useElementSize(scrollEl);
  const overflow = box.width > 0 && geo.width > box.width + 1;

  const renderNode = (n: TreeNodeGeom) => {
    const info = markInfo(s.marks?.[n.id], concepts);
    const text = describeNode ? describeNode(n.id, s) : treeNodeLabel(s, n.id, concepts);
    const badge = s.badges?.[n.id];
    const h = node;
    const cls2 = ['ds-node', markClass(info), entered.has(n.id) ? 'is-entering' : '', interactive ? 'is-button' : ''].filter(Boolean).join(' ');
    const a11y = interactive
      ? {
          role: 'button' as const,
          tabindex: roving.tabIndex(n.id),
          'data-rk': n.id,
          onClick: () => {
            roving.setActive(n.id);
            onNodeClick!(n.id);
          },
          onKeyDown: onActivate(() => onNodeClick!(n.id)),
        }
      : { role: 'img' as const };
    return (
      <g
        key={n.id}
        class={cls2}
        data-mark={info?.mark}
        data-node={n.id}
        transform={`translate(${n.x} ${n.y})`}
        aria-label={text}
        ref={(el) => {
          if (el) nodeEls.current.set(n.id, el);
          else nodeEls.current.delete(n.id);
        }}
        {...a11y}
      >
        {n.w > h ? <rect class="ds-node__hit" x={-n.w / 2} y={-h / 2} width={n.w} height={h} rx={h / 2} /> : <circle class="ds-node__hit" r={h / 2} />}
        <NodeShape w={n.w - 4} h={h - 4} info={info} concepts={concepts} cls="ds-node__shape" />
        <text class="ds-node__label" aria-hidden="true">
          {n.label}
        </text>
        <NodeGlyph info={info} x={n.w / 2 - 6} y={-h / 2 + 6} />
        {badge && (
          <text class="ds-node__badge" x={n.w / 2 + (info?.glyph ? 8 : 3)} y={-h / 2 + 5} aria-hidden="true">
            {badge}
          </text>
        )}
        {interactive && (n.w > h ? <rect class="ds-node__focus" x={-n.w / 2 - 3} y={-h / 2 - 3} width={n.w + 6} height={h + 6} rx={h / 2 + 3} /> : <circle class="ds-node__focus" r={h / 2 + 3} />)}
      </g>
    );
  };

  return (
    <div class={['ds', 'ds-tree', 'plate__stage', interactive ? 'is-interactive' : '', cls].filter(Boolean).join(' ')}>
      <div
        class="ds-scroll"
        ref={scrollEl}
        tabIndex={overflow && !interactive ? 0 : undefined}
        role={overflow && !interactive ? 'region' : undefined}
        aria-label={overflow && !interactive ? `${label} (scrolls sideways)` : undefined}
      >
        {geo.nodes.length === 0 ? (
          <p class="ds-empty">Empty tree</p>
        ) : (
          <svg
            class="ds-svg"
            width={geo.width}
            height={geo.height}
            viewBox={`0 0 ${geo.width} ${geo.height}`}
            role="group"
            aria-label={label}
            aria-describedby={sumId}
            ref={roving.root as never}
            onKeyDown={onKeyDown}
          >
            <title>{label}</title>
            <g class="ds-edges">
              {edges.map((e) => {
                const a = byId.get(e.from)!;
                const b = byId.get(e.to)!;
                const info = markInfo(s.edgeMarks?.[e.key], concepts);
                const st = conceptStroke(info, 2.5, concepts);
                const d = linePath([a.x, a.y], [b.x, b.y]);
                return (
                  <g key={e.key} class={['ds-edge', markClass(info)].filter(Boolean).join(' ')} data-mark={info?.mark} data-edge={e.key} data-double={st.double ? '' : undefined}>
                    {st.double && <path class="ds-edge__case" d={d} />}
                    <path
                      class="ds-edge__line"
                      d={d}
                      stroke-dasharray={st.dash}
                      stroke-linecap={st.cap}
                      ref={(el) => {
                        if (el) edgeEls.current.set(e.key, el);
                        else edgeEls.current.delete(e.key);
                      }}
                    />
                    {info?.glyph && (
                      <g class="ds-edge__mid" transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`}>
                        <NodeGlyph info={info} x={0} y={0} />
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
            <g class="ds-nodes">{ordered.map(renderNode)}</g>
          </svg>
        )}
      </div>
      <p class="sr-only" id={sumId}>
        {summarizeTree(s, layout, concepts)}
      </p>
    </div>
  );
}
