/**
 * coolstuff kit — the one import for lessons and site pages:
 *
 *   import { LessonPage, Section, Formula, Stage2D, ProblemSet, defineConcepts } from '@kit';
 *
 * Export map (README.md is the API reference; PLAN.md says who builds what):
 *
 *   design system   ./theme  ./notation                       (frozen)
 *   contracts       ./types                                    (frozen; additive changes logged in PLAN.md)
 *   foundations     ./core   — link bus, RichText, Tex, answers, expressions, units, pretty TeX,
 *                              problems/audits, lesson audits, exam, figures convention,
 *                              slider scales, progress, rng, hooks, icons
 *   G1 text         ./text        Formula, Derivation, Glossary, TLDR, Trap, Callout
 *   G2 visual       ./visual      Stage2D (+ primitives), Plot, MatrixGrid, imageOf   (Stage3D, MatrixGrid3D: '@kit/visual/Stage3D')
 *   G3 practice     ./practice    WorkedExample, Problem, ProblemSet, Quiz, Predict, ExamSet
 *   G4 controls     ./controls    Slider, Toggle, Segmented, Stepper, PlayScrub, Scrolly, CodeCell, parsers
 *   G4 shell        ./shell       LessonPage, Section, Step, Figure, SiteHeader, WhereNext, …
 *   G5 structures   ./structures  ArrayView, TreeView, GraphView, TableView, ArchDiagram
 *
 * Lessons' problems.ts and math.ts never import this barrel: they import the
 * Node-safe subset '@kit/pure' (./pure.ts) and '@kit/math' (ESLint enforces it).
 * Not re-exported here (import by subpath): '@kit/math' (generic names),
 * '@kit/util' (browser helpers), '@kit/visual/Stage3D' (heavy), '@kit/vite-katex'
 * and '@kit/vite-pwa' (build only).
 *
 * This file is owned by the kit architect and never edited by the groups:
 * each group adds export lines to its own folder's index.ts.
 */
export * from './theme';
export * from './notation';
export * from './types';
export * from './core';
export * from './text';
export * from './visual';
export * from './practice';
export * from './controls';
export * from './shell';
export * from './structures';
