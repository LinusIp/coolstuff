/**
 * Drag a point to the right place (drag mode 'point', README §8.2): a small
 * Stage2D with the target's context curves and one Handle (mouse, touch and
 * arrow keys, from G2), snapping and constraints from the target, and a
 * readout of where the point is. The point turns green when it is right.
 */
import { signal } from '@preact/signals';
import { useMemo, useRef } from 'preact/hooks';
import { compileExpr, parseExpr } from '../../core/expr';
import { formatLive } from '../../core/live';
import type { Vec2 } from '../../math/vec';
import type { PointTarget } from '../../types';
import { Curve, Handle, Stage2D, type Constraint } from '../../visual';
import type { Draft, DraftUpdate } from '../draft';
import { useSyncSignalEffect } from '../hooks';

export interface PointInputProps {
  target: PointTarget;
  draft: Extract<Draft, { kind: 'drag' }>;
  onDraft: (u: DraftUpdate) => void;
  disabled?: boolean;
  /** Turns the handle green. */
  correct?: boolean;
}

const fn = (expr: string): ((x: number) => number) => {
  const f = compileExpr(parseExpr(expr, { vars: ['x'] }));
  return (x: number) => f({ x });
};

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function PointInput({ target, draft, onDraft, disabled, correct }: PointInputProps) {
  const pt = useMemo(() => signal<Vec2>([...(draft.state as Vec2)] as Vec2), []);
  const touched = useRef(draft.touched);
  const first = useRef(true);
  const send = useRef(onDraft);
  send.current = onDraft;
  useSyncSignalEffect(() => {
    const v = pt.value;
    if (first.current) {
      first.current = false;
      return;
    }
    touched.current = touched.current || v[0] !== target.start[0] || v[1] !== target.start[1];
    send.current({ kind: 'drag', state: [v[0], v[1]], touched: touched.current });
  });
  const curves = useMemo(() => (target.curves ?? []).map((c) => ({ ...c, f: fn(c.expr) })), [target]);
  const constrain = useMemo<Constraint | undefined>(() => {
    const c = target.constrain;
    if (!c) return undefined;
    if ('curve' in c) return { curve: fn(c.curve) };
    return c;
  }, [target]);
  const ratio = (target.view.y[1] - target.view.y[0]) / (target.view.x[1] - target.view.x[0]);
  const aspect = { desktop: clamp(ratio, 0.5, 0.9), phone: clamp(ratio, 0.78, 1) };
  return (
    <div class="plate problem__plate">
      <Stage2D
        view={target.view}
        title={`Drag ${target.label}`}
        aspect={aspect}
        static={
          <>
            {curves.map((c, k) => (
              <Curve key={k} f={c.f} concept={c.concept} emphasis="quiet" label={c.label} />
            ))}
          </>
        }
      >
        <Handle
          value={pt}
          label={target.label}
          constrain={constrain}
          snap={target.snap}
          step={target.snap}
          correct={!!correct}
          disabled={disabled}
          onDragEnd={(v) => {
            // The final position (a drag's last frame may not have reached the signal yet).
            touched.current = true;
            send.current({ kind: 'drag', state: [v[0], v[1]], touched: true });
          }}
        />
      </Stage2D>
      <div class={`readout problem__readout${correct ? ' is-correct' : ''}`}>
        <span class="readout__pair">
          <span class="readout__sym">Point</span>
          <span>{formatLive(pt.value)}</span>
        </span>
      </div>
      {!disabled && (
        <p class="fig-keys">
          Drag the ring, or <kbd>Tab</kbd> to it and use the arrow keys (<kbd>Shift</kbd> for bigger steps).
        </p>
      )}
    </div>
  );
}
