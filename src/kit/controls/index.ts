/**
 * G4 — controls & code (README §7). Owned by G4 (see ../PLAN.md).
 */
export { Toggle, Segmented, type ToggleProps, type SegmentedProps, type SegmentedOption } from './Toggle';
export { Stepper, type StepperProps } from './Stepper';
export { Slider, type SliderProps } from './Slider';
export { PlayScrub, type PlayScrubProps } from './PlayScrub';
export { Scrolly, type ScrollyProps, type ScrollyStep } from './Scrolly';
export { CodeCell, codeOutput, type CodeCellProps, type CodeOutput } from './CodeCell';
export * from './parsers';
export { runSandboxed, createSandbox, type SandboxRequest, type SandboxResult, type SandboxOptions, type StreamOption } from './sandbox';
export { stepIndex, clampIndex, frameInterval, playTick, playStart, frameCounter, nearestToLine, REDUCED_MOTION_MAX_FPS } from './timeline';
export { tokenizeJs, forbiddenSyntax, type Token, type TokenKind } from './highlight';
