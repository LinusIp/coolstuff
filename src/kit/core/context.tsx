/**
 * Page-level context every kit component reads: the lesson's concepts and the
 * KaTeX macros they generate (\cMatrix …), the lesson id (progress keys), and
 * the subject. LessonPage provides it; the gallery host provides a demo one;
 * pages that mix lessons wrap each problem in its own provider.
 *
 *   <KitProvider lessonId="linalg/eigenvectors" concepts={C}>…</KitProvider>
 *   const { macros, lessonId } = useKit();
 *
 * Concept-colour scope: given both `lessonId` and `concepts`, the provider
 * renders a `<div class="kit-scope" data-lesson="<lessonId>">` (display:
 * contents, so layout is untouched) and mounts the concepts' CSS limited to
 * it, so two lessons on one page keep their own inks for the same concept
 * name. Pass `scoped={false}` to skip the wrapper (LessonPage mounts its one
 * lesson's concepts page-wide instead).
 */
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useLayoutEffect, useMemo } from 'preact/hooks';
import type { ConceptSet } from '../theme';

export interface KitContextValue {
  /** `<subject>/<slug>`: the progress key prefix. Undefined on non-lesson pages (gallery, practice pages pass their own). */
  lessonId?: string;
  subject?: string;
  concepts?: ConceptSet;
  /** NOTATION macros are always on; these are the lesson's concept shorthands. */
  macros: Readonly<Record<string, string>>;
  /** The lesson id whose scoped concept CSS is active here (portaled UI renders inside `[data-lesson="<scope>"]`). */
  scope?: string;
}

export const KitContext = createContext<KitContextValue>({ macros: {} });

export interface KitProviderProps {
  lessonId?: string;
  concepts?: ConceptSet;
  /** Extra macros beyond the concepts' shorthands. */
  macros?: Readonly<Record<string, string>>;
  /** Render the `data-lesson` wrapper and mount scoped concept CSS. Default: true when both `lessonId` and `concepts` are given. */
  scoped?: boolean;
  children: ComponentChildren;
}

export function KitProvider({ lessonId, concepts, macros, scoped, children }: KitProviderProps) {
  const parent = useContext(KitContext);
  const scope = (scoped ?? !!(lessonId && concepts)) && lessonId && concepts ? lessonId : undefined;
  const value = useMemo<KitContextValue>(
    () => ({
      lessonId: lessonId ?? parent.lessonId,
      subject: (lessonId ?? parent.lessonId)?.split('/')[0],
      concepts: concepts ?? parent.concepts,
      macros: { ...parent.macros, ...(concepts?.macros() ?? {}), ...(macros ?? {}) },
      scope: scope ?? parent.scope,
    }),
    [lessonId, concepts, macros, parent, scope],
  );
  useLayoutEffect(() => (scope && concepts ? concepts.mount(document, scope) : undefined), [scope, concepts]);
  const tree = <KitContext.Provider value={value}>{children}</KitContext.Provider>;
  return scope ? (
    <div class="kit-scope" data-lesson={scope} style={{ display: 'contents' }}>
      {tree}
    </div>
  ) : (
    tree
  );
}

export function useKit(): KitContextValue {
  return useContext(KitContext);
}

/** Context macros merged with a component's own (memoised so KaTeX caches hit). */
export function useMacros(extra?: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const { macros } = useKit();
  return useMemo(() => (extra ? { ...macros, ...extra } : macros), [macros, extra]);
}
