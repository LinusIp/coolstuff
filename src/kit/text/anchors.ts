/**
 * Repeated `\anchor` ids (README §5.1–5.2), pure and tested so Formula and
 * Derivation agree on one rule:
 *
 * - An id may tag several occurrences (`\anchor{v}{…}` on both sides of
 *   A v = λ v). The FIRST occurrence carries the explain note, its leader and
 *   the inline live value; EVERY occurrence lights on hover (`data-anchor`).
 * - Between two derivation steps, occurrences of the same id are paired in
 *   order (1st with 1st, 2nd with 2nd) and FLIP-slide; unpaired extras fade
 *   out (old step) or fade in (new step).
 *
 * Kit architect seed, handed to G1 with its tests (PLAN.md §2).
 */

/** Every `\anchor{id}{…}` occurrence in a TeX string, in reading order (ids may repeat). */
export function anchorOccurrences(tex: string): string[] {
  return [...tex.matchAll(/\\anchor\s*\{\s*([^{}\s]+)\s*\}/g)].map((m) => m[1]);
}

/** For each occurrence, whether it carries the explain note / leader / live value (the first of its id). */
export function noteCarriers(occurrences: readonly string[]): boolean[] {
  const seen = new Set<string>();
  return occurrences.map((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export interface AnchorPairing {
  /** [index in `from`, index in `to`]: these occurrences slide from the old position to the new one. */
  pairs: [number, number][];
  /** Indices in `from` with no partner: fade out. */
  leaving: number[];
  /** Indices in `to` with no partner: fade in. */
  entering: number[];
}

/**
 * Pair the anchor occurrences of two consecutive derivation steps: the k-th
 * occurrence of an id in `from` with the k-th occurrence of the same id in `to`.
 */
export function pairAnchors(from: readonly string[], to: readonly string[]): AnchorPairing {
  const queues = new Map<string, number[]>();
  from.forEach((id, i) => {
    const q = queues.get(id);
    if (q) q.push(i);
    else queues.set(id, [i]);
  });
  const pairs: [number, number][] = [];
  const entering: number[] = [];
  to.forEach((id, j) => {
    const i = queues.get(id)?.shift();
    if (i === undefined) entering.push(j);
    else pairs.push([i, j]);
  });
  const paired = new Set(pairs.map(([i]) => i));
  const leaving = from.map((_, i) => i).filter((i) => !paired.has(i));
  return { pairs, leaving, entering };
}
