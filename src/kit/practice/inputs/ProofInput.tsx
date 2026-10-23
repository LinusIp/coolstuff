/**
 * Proof / explanation (README §8.2): write your answer (optional), then
 * compare it with the model answer and tick each part of the checklist your
 * answer has. All ticked = solved (checkProof).
 */
import { RichText } from '../../core/RichText';
import type { ProofAnswer } from '../../types';
import type { Draft, DraftUpdate } from '../draft';

export interface ProofInputProps {
  answer: ProofAnswer;
  draft: Extract<Draft, { kind: 'proof' }>;
  onDraft: (u: DraftUpdate) => void;
  idBase: string;
  disabled?: boolean;
  /** Exam mode: the text only (no model answer before submitting). */
  examMode?: boolean;
}

export function ProofInput({ answer, draft, onDraft, idBase, disabled, examMode }: ProofInputProps) {
  return (
    <div class="proof">
      <label class="answer-row__label answer-row__label--text" for={`${idBase}-text`}>
        Your answer{examMode ? '' : ' (optional: writing it first makes the comparison honest)'}
      </label>
      <textarea
        class="field proof__text"
        id={`${idBase}-text`}
        rows={5}
        value={draft.text}
        disabled={disabled}
        spellcheck
        onInput={(e) => {
          const text = e.currentTarget.value;
          onDraft((d) => (d.kind === 'proof' ? { ...d, text } : d));
        }}
      />
      {!examMode &&
        (draft.compared ? (
          <div class="proof__compare is-entering">
            <p class="label proof__label">Model answer</p>
            <RichText class="proof__model" text={answer.modelAnswer} />
            <fieldset class="checklist">
              <legend class="label proof__label">Tick what your answer has</legend>
              {answer.checklist.map((item, k) => (
                <div key={k} class={`choice choice--check${draft.ticked[k] ? ' is-ticked' : ''}`}>
                  <input
                    type="checkbox"
                    id={`${idBase}-c${k}`}
                    checked={!!draft.ticked[k]}
                    disabled={disabled}
                    onChange={(e) => {
                      const on = e.currentTarget.checked;
                      onDraft((d) => (d.kind === 'proof' ? { ...d, ticked: d.ticked.map((t, j) => (j === k ? on : t)) } : d));
                    }}
                  />
                  <label for={`${idBase}-c${k}`}>
                    <span class="choice__key choice__box" aria-hidden="true">
                      <svg viewBox="0 0 16 16">
                        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                      </svg>
                    </span>
                    <RichText inline text={item} />
                  </label>
                </div>
              ))}
            </fieldset>
          </div>
        ) : (
          <div class="answer-row">
            <button type="button" class="btn" disabled={disabled} onClick={() => onDraft((d) => (d.kind === 'proof' ? { ...d, compared: true } : d))}>
              Compare with the model answer
            </button>
          </div>
        ))}
    </div>
  );
}
