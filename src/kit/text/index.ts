/**
 * G1 — formulas & text (README §5). Owned by G1 (see ../PLAN.md).
 */
export { Formula, type FormulaProps, type FormulaLive } from './Formula';
export { Derivation, type DerivationProps } from './Derivation';
export { Glossary, Term, installGlossary, registerGlossary, glossaryEntry, type GlossaryProps, type TermProps, type GlossaryEntry } from './Glossary';
export { TLDR, type TLDRProps } from './TLDR';
export { Trap, type TrapProps } from './Trap';
export { Callout, Sidenote, type CalloutProps, type CalloutKind, type SidenoteProps } from './Callout';
// Pure rules behind them (tested).
export { anchorOccurrences, noteCarriers, pairAnchors, anchorSpans, firstSpans, conceptInTex, stripAnchors, type AnchorPairing, type AnchorSpan } from './anchors';
export {
  packRow,
  fitWidths,
  layoutWide,
  layoutBrackets,
  layoutLiveRow,
  layoutStubs,
  leaderPath,
  leadersCross,
  stubFor,
  explainMode,
  STACK_BELOW,
  type Box as ExplainBox,
  type WideLayout,
  type Leader,
  type BracketLayout,
  type PlacedStub,
} from './explain-layout';
export { liveCells, liveSpeech, type LiveCells, type LiveKind } from './live-format';
export { labelRuns, type LabelRun } from './label';
export { flipPlan, visibleSteps, FLIP_MS, type FlipPlan, type FlipMove } from './flip';
export { placePopover, normalizeTerm, createGlossaryRegistry, type RegisteredTerm } from './glossary-core';
