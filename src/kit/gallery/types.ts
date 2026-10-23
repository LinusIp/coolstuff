/**
 * The gallery contract: each component group exports one `GalleryGroup` from
 * src/kit/gallery/<group>.tsx. The /kit page renders every group; each
 * group's dev page (kit/_dev/<group>.html) renders just its own.
 *
 * A demo shows one component in one or more states (default, hover-linked,
 * focused, error, empty, solved, reduced motion…) with real data, ideally the
 * reference specs in ./samples.ts.
 */
import type { ComponentChildren } from 'preact';

export type GalleryGroupId = 'core' | 'text' | 'visual' | 'practice' | 'controls' | 'structures';

export interface GalleryDemo {
  /** Anchor id, unique on the page: 'formula-explain'. */
  id: string;
  /** "Formula · explain this". */
  title: string;
  /** Component name(s) shown: 'Formula'. */
  component: string;
  /** One or two sentences (Rich) on what the demo shows and which states it covers. */
  notes?: string;
  /** Span the text column and the margin (912px) at ≥ 1000px. */
  wide?: boolean;
  render: () => ComponentChildren;
}

export interface GalleryGroup {
  id: GalleryGroupId;
  title: string;
  owner: 'architect' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5';
  /** One line under the group heading. */
  blurb: string;
  demos: GalleryDemo[];
}
