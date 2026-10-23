/**
 * G3 — practice (README §8). Owned by G3 (see ../PLAN.md).
 */
export { WorkedExample, WorkedExampleSet, type WorkedExampleProps, type WorkedExampleSetProps } from './WorkedExample';
export { Problem, useProblemProgress, type ProblemProps } from './Problem';
export { ProblemSet, type ProblemSetProps } from './ProblemSet';
export { Quiz, type QuizProps } from './Quiz';
export { Predict, type PredictProps, type PredictRenderState } from './Predict';
export { ExamSet, type ExamSetProps } from './ExamSet';
// Pure rules behind them (tested): useful to site pages and lesson tests.
export {
  initialDraft,
  draftText,
  draftToCheck,
  draftToResponse,
  draftFromResponse,
  isDraftAnswered,
  numericLayout,
  choiceOrder,
  countsAsAttempt,
  metaLine,
  difficultyWord,
  kindLabel,
  answerHelp,
  wrongNoteTitle,
  nextInstance,
  type Draft,
  type NumericLayout,
} from './draft';
export { proposeParams, choiceAvailability, clampReveal, startValues, levelInfo as exampleLevelInfo } from './example-state';
export { quizStart, answerQuestion, retryQuestion, nextQuestion, quizScore, quizMisses, judgeQuiz, type QuizState, type QuizRecord } from './quiz-state';
export { judgeGuess, describeGuess, hasGuess as hasPredictGuess } from './predict-state';
export { formatClock, formatDuration, timerAnnouncement, isAnswered as isExamAnswered, attemptsSummary } from './exam-state';
export { testLines, runVerdict, type TestLine } from './code-results';
