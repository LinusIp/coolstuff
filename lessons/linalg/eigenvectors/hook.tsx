/**
 * The Hook: before anything shows them, guess the two directions
 * A = [[2, 1], [1, 2]] leaves on their own line, by dragging two arrows on
 * the transformed plane. Locking in reveals the rose kept lines and the
 * images of the learner's own arrows (so a wrong guess visibly turns).
 *
 * No side effects at import; state is local.
 */
import { signal, useSignal, type Signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { Figure, MatrixGrid, Predict, type PredictSpec } from '@kit';
import type { Mat2, Vec2 } from '@kit/math';
import { fitArrow, HOOK_A, type PlateFit } from './math';

/** Inside MatrixGrid's default view (x ±4, y ±3.2), leaving room for heads and labels, so a guess's image stays on the plate after the reveal. */
const HOOK_FIT: PlateFit = { hx: 3.6, hy: 2.85, minLength: 0.6 };

/**
 * A writable signal whose writes pass through `f` (MatrixGrid vectors take no
 * constraint, so the constraint lives in the signal). Duck-typed like the
 * kit's own lenses: `value` (tracked) and `peek`.
 */
function constrained(start: Vec2, f: (p: Vec2) => Vec2): Signal<Vec2> {
  const inner = signal<Vec2>(f(start));
  return {
    get value() {
      return inner.value;
    },
    set value(p: Vec2) {
      inner.value = f(p);
    },
    peek: () => inner.peek(),
    subscribe: (fn: (v: Vec2) => void) => inner.subscribe(fn),
  } as unknown as Signal<Vec2>;
}

export function GuessDirections({ spec }: { spec: PredictSpec }) {
  const A = useSignal<Mat2>([...HOOK_A] as Mat2);
  const fit = (p: Vec2) => fitArrow(HOOK_A, p, HOOK_FIT);
  const a = useMemo(() => constrained([1.5, 0.5], fit), []);
  const b = useMemo(() => constrained([-0.5, 1.5], fit), []);
  return (
    <Predict spec={spec}>
      {({ locked, setGuess }) => {
        const push = () => setGuess([a.peek(), b.peek()]);
        return (
          <Figure
            name="eigen-guess"
            interactive={!locked}
            caption={
              locked
                ? 'The rose lines are the two directions $\\cMatrix$ keeps; the dashed orange arrows are where it sends your two guesses.'
                : 'The faint teal grid is the plane after $\\cMatrix$. Drag the two blue arrows onto the directions you think it doesn’t turn.'
            }
            description={
              locked
                ? 'The plane transformed by the matrix with columns (2, 1) and (1, 2). Two rose lines mark the diagonals y = x, labelled stretched by 3, and y = −x, labelled unchanged. The learner’s two guess arrows are drawn in blue with their images under the matrix as dashed orange arrows.'
                : 'The plane transformed by the matrix with columns (2, 1) and (1, 2): a faint teal grid of parallelograms and the unit square stretched along the diagonal. Two draggable blue arrows, a and b, are the learner’s guesses for the two directions the matrix does not turn.'
            }
          >
            <MatrixGrid
              matrix={A}
              title="Guess the two directions this matrix doesn't turn: drag the two blue arrows."
              editable={false}
              show={{ eigen: locked, determinant: false }}
              aspect={{ desktop: 0.62, phone: 0.94 }}
              vectors={[
                { value: a, concept: 'input', label: 'your first guess, arrow a', tex: '$\\vec a$', draggable: !locked, onDragEnd: push, image: locked ? { concept: 'output', label: 'where A sends a', tex: '$A\\vec a$' } : undefined },
                { value: b, concept: 'input', label: 'your second guess, arrow b', tex: '$\\vec b$', draggable: !locked, onDragEnd: push, image: locked ? { concept: 'output', label: 'where A sends b', tex: '$A\\vec b$' } : undefined },
              ]}
            />
          </Figure>
        );
      }}
    </Predict>
  );
}
