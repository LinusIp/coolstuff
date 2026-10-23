/**
 * A choice problem's options (README §8.2): radio rows for one answer,
 * checkboxes for "choose all that apply", in a stable (optionally shuffled)
 * order, plus a one-line reason field when the problem asks for reasoning.
 * After a check, the picked options turn green or red with their `why`.
 */
import { RichText } from '../../core/RichText';
import { IconCheck, IconCross } from '../../core/icons';
import type { ChoiceAnswer, ChoiceOption, Rich, Verdict } from '../../types';
import { isMultiChoice, optionLetter, type Draft, type DraftUpdate } from '../draft';

export interface ChoiceInputProps {
  answer: ChoiceAnswer;
  draft: Extract<Draft, { kind: 'choice' }>;
  onDraft: (u: DraftUpdate) => void;
  idBase: string;
  /** Display position → original index. */
  order: readonly number[];
  /** The verdict being shown (practice after a check, or review). */
  verdict?: Verdict | null;
  /** Review: also mark the right options the learner didn't pick. */
  review?: boolean;
  disabled?: boolean;
  feedbackId?: string;
}

const optText = (o: Rich | ChoiceOption): Rich => (typeof o === 'string' ? o : o.text);
const optWhy = (o: Rich | ChoiceOption): Rich | undefined => (typeof o === 'string' ? undefined : o.why);

export function ChoiceInput({ answer, draft, onDraft, idBase, order, verdict, review, disabled, feedbackId }: ChoiceInputProps) {
  const multi = isMultiChoice(answer);
  const correct = typeof answer.correct === 'number' ? [answer.correct] : [...answer.correct];
  const toggle = (orig: number, on: boolean) =>
    onDraft((d) => {
      if (d.kind !== 'choice') return d;
      const sel = multi ? (on ? [...new Set([...d.selected, orig])] : d.selected.filter((s) => s !== orig)) : on ? [orig] : [];
      return { ...d, selected: sel.sort((a, b) => a - b) };
    });
  const stateOf = (orig: number): 'correct' | 'wrong' | 'answer' | null => {
    const picked = draft.selected.includes(orig);
    if (verdict && picked) {
      if (verdict.correct) return 'correct';
      if (!multi) return 'wrong';
      return correct.includes(orig) ? (review ? 'correct' : null) : 'wrong';
    }
    if (review && !picked && correct.includes(orig)) return 'answer';
    return null;
  };
  return (
    <>
      <fieldset class="choices" aria-describedby={feedbackId}>
        <legend class="sr-only">{multi ? 'Choose every option that is true' : 'Choose one option'}</legend>
        {multi && <p class="answer-row__help choices__help">Choose every option that is true.</p>}
        {order.map((orig, pos) => {
          const o = answer.options[orig];
          const st = stateOf(orig);
          const why = optWhy(o);
          const id = `${idBase}-o${pos}`;
          return (
            <div key={orig} class={`choice${st === 'correct' ? ' is-correct' : st === 'wrong' ? ' is-wrong' : st === 'answer' ? ' is-answer' : ''}`}>
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={`${idBase}-choice`}
                id={id}
                checked={draft.selected.includes(orig)}
                disabled={disabled}
                onChange={(e) => toggle(orig, e.currentTarget.checked)}
              />
              <label for={id}>
                <span class="choice__key" aria-hidden="true">
                  {optionLetter(pos)}
                </span>
                <RichText inline text={optText(o)} />
                <span class="choice__mark">
                  {st === 'correct' ? (
                    <>
                      <IconCheck />
                      <span class="sr-only">right</span>
                    </>
                  ) : st === 'wrong' ? (
                    <>
                      <IconCross />
                      <span class="sr-only">not right</span>
                    </>
                  ) : st === 'answer' ? (
                    <span class="choice__tag">
                      <IconCheck /> the answer
                    </span>
                  ) : null}
                </span>
              </label>
              {st && why && (
                <div class="choice__why">
                  <p class="choice__verdict">{st === 'wrong' ? 'Not quite.' : st === 'answer' ? 'The right one.' : 'Right.'}</p>
                  <RichText text={why} />
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
      {answer.askReason && !review && (
        <div class="answer-row answer-row--reason">
          <label class="answer-row__label answer-row__label--text" for={`${idBase}-reason`}>
            Your reason, in one line
          </label>
          <input
            class="field field--reason"
            id={`${idBase}-reason`}
            value={draft.reason}
            autocomplete="off"
            disabled={disabled}
            placeholder="Because…"
            onInput={(e) => {
              const reason = e.currentTarget.value;
              onDraft((d) => (d.kind === 'choice' ? { ...d, reason } : d));
            }}
          />
        </div>
      )}
    </>
  );
}
