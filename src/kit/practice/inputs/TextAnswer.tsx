/**
 * Typed answers (numeric and symbolic, README §8.2): one mono field, a
 * rows × cols matrix grid in brackets (row-major; arrow keys move between
 * cells), or one `a + bi` field per complex number. Below: the stated
 * precision and, as the learner types, a live "We read: …" preview of how
 * the checker understood it (never whether it is right).
 */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { checkAnswer } from '../../core/answers';
import { RichText } from '../../core/RichText';
import { Tex } from '../../core/Tex';
import { unitToTex } from '../../core/units';
import type { NumericAnswer, SymbolicAnswer } from '../../types';
import { answerHelp, cellMove, draftText, numericLayout, type Draft, type DraftUpdate } from '../draft';

export interface TextAnswerProps {
  answer: NumericAnswer | SymbolicAnswer;
  draft: Draft;
  onDraft: (u: DraftUpdate) => void;
  idBase: string;
  disabled?: boolean;
  /** Field state after a check. */
  status?: 'wrong' | 'correct' | null;
  /** The Check button (practice), placed in the row after the fields. */
  action?: ComponentChildren;
  /** id of the feedback line, so screen readers hear the verdict with the field. */
  feedbackId?: string;
  /** Show the live "We read" preview (practice and exam; not review). Default true. */
  preview?: boolean;
  /** A verdict is on screen: the preview keeps quiet about unreadable input (the feedback line says it). */
  checked?: boolean;
}

const FIELD_ATTRS = { autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: false, enterKeyHint: 'done' } as const;

export function TextAnswer({ answer, draft, onDraft, idBase, disabled, status, action, feedbackId, preview = true, checked }: TextAnswerProps) {
  const layout = answer.kind === 'numeric' ? numericLayout(answer) : ({ kind: 'single' } as const);
  const text = draftText(answer, draft);
  const help = useMemo(() => answerHelp(answer), [answer]);
  const helpId = `${idBase}-help`;
  const readId = `${idBase}-read`;
  const describedBy = [help ? helpId : '', preview ? readId : '', feedbackId ?? ''].filter(Boolean).join(' ') || undefined;
  const fieldCls = `field${status === 'wrong' ? ' is-wrong' : status === 'correct' ? ' is-correct' : ''}`;
  const unitAfter = answer.kind === 'numeric' && answer.unit && answer.askUnit === false ? unitToTex(answer.unit) : null;
  const labelId = `${idBase}-alabel`; // (`${idBase}-label` is the card head's)

  let fields: ComponentChildren;
  if (layout.kind === 'matrix' && draft.kind === 'cells') {
    fields = <MatrixGrid rows={layout.rows} cols={layout.cols} cells={draft.cells} onCell={(k, v) => onDraft(setCell(k, v))} cls={fieldCls} idBase={idBase} disabled={disabled} labelledBy={answer.label ? labelId : undefined} describedBy={describedBy} />;
  } else if (layout.kind === 'complex' && draft.kind === 'cells') {
    fields = (
      <span class="cfields" role="group" aria-labelledby={answer.label ? labelId : undefined} aria-label={answer.label ? undefined : 'Your answer'}>
        {draft.cells.map((c, k) => (
          <input
            key={k}
            {...FIELD_ATTRS}
            class={`${fieldCls} field--complex`}
            id={k === 0 ? `${idBase}-field` : `${idBase}-field-${k}`}
            value={c}
            placeholder="a + bi"
            aria-label={`Complex number ${k + 1} of ${draft.cells.length}`}
            aria-describedby={describedBy}
            disabled={disabled}
            onInput={(e) => onDraft(setCell(k, e.currentTarget.value))}
          />
        ))}
      </span>
    );
  } else {
    const wide = answer.kind === 'symbolic' ? ' field--wide' : layout.kind === 'list' || layout.kind === 'complex' || (answer.kind === 'numeric' && answer.unit) ? ' field--list' : '';
    fields = (
      <input
        {...FIELD_ATTRS}
        class={`${fieldCls}${wide}`}
        id={`${idBase}-field`}
        value={draft.kind === 'text' ? draft.text : ''}
        placeholder={layout.kind === 'complex' ? 'a + bi' : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onInput={(e) => onDraft({ kind: 'text', text: e.currentTarget.value })}
      />
    );
  }

  return (
    <div class={`answer-row${layout.kind === 'matrix' ? ' answer-row--matrix' : ''}`}>
      {layout.kind === 'matrix' || (layout.kind === 'complex' && draft.kind === 'cells') ? (
        answer.label ? (
          <span class="answer-row__label" id={labelId}>
            <Tex tex={answer.label} />
          </span>
        ) : null
      ) : answer.label ? (
        <label class="answer-row__label" for={`${idBase}-field`} id={labelId}>
          <Tex tex={answer.label} />
        </label>
      ) : (
        <label class="sr-only" for={`${idBase}-field`}>
          Your answer
        </label>
      )}
      {fields}
      {unitAfter && (
        <span class="answer-row__unit">
          <Tex tex={unitAfter} />
        </span>
      )}
      {action}
      {help && <RichText as="p" inline class="answer-row__help" id={helpId} text={help} />}
      {preview && <ReadPreview answer={answer} text={text} id={readId} quiet={checked} />}
    </div>
  );
}

/** One cell of a grid draft, from the latest draft. */
const setCell =
  (k: number, v: string) =>
  (d: Draft): Draft =>
    d.kind === 'cells' ? { kind: 'cells', cells: d.cells.map((x, j) => (j === k ? v : x)) } : d;

/** "We read: ⅓ m/s²" as the learner types; a gentle "can't read that yet" only after a pause. */
function ReadPreview({ answer, text, id, quiet }: { answer: NumericAnswer | SymbolicAnswer; text: string; id: string; quiet?: boolean }) {
  const v = useMemo(() => (text.trim() ? checkAnswer(answer, { kind: answer.kind, text }) : null), [answer, text]);
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    setIdle(false);
    if (!text.trim()) return;
    const t = setTimeout(() => setIdle(true), 900);
    return () => clearTimeout(t);
  }, [text]);
  let body: ComponentChildren = null;
  if (v?.understood) {
    body = (
      <>
        We read: <Tex tex={v.understood} />
      </>
    );
  } else if (v && idle && !quiet && (v.reason === 'unparseable' || v.reason === 'count')) {
    body = <>Can’t read that yet: {v.message}</>;
  }
  return (
    <p class="answer-row__read" id={id}>
      {body}
    </p>
  );
}

interface GridProps {
  rows: number;
  cols: number;
  cells: readonly string[];
  onCell: (k: number, value: string) => void;
  cls: string;
  idBase: string;
  disabled?: boolean;
  labelledBy?: string;
  describedBy?: string;
}

/** A matrix of fields between brackets; ↑ ↓ move between rows, ← → at the caret's edge move across. */
function MatrixGrid({ rows, cols, cells, onCell, cls, idBase, disabled, labelledBy, describedBy }: GridProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const onKeyDown = (k: number) => (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    // A whole-cell selection (after moving in) counts as both ends: one press moves on.
    const atStart = el.selectionStart === 0;
    const atEnd = el.selectionEnd === el.value.length;
    const to = cellMove(k, e.key, rows, cols, atStart, atEnd);
    if (to === null) return;
    e.preventDefault();
    const t = refs.current[to];
    t?.focus();
    t?.select();
  };
  return (
    <span class="mgrid" role="group" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : `A ${rows} by ${cols} matrix`} style={{ '--cols': String(cols) }}>
      <span class="mgrid__bracket mgrid__bracket--l" aria-hidden="true" />
      <span class="mgrid__cells">
        {cells.map((c, k) => (
          <input
            key={k}
            ref={(el) => {
              refs.current[k] = el;
            }}
            {...FIELD_ATTRS}
            class={`${cls} mgrid__cell`}
            id={k === 0 ? `${idBase}-field` : `${idBase}-field-${k}`}
            value={c}
            aria-label={`Row ${Math.floor(k / cols) + 1}, column ${(k % cols) + 1}`}
            aria-describedby={k === 0 ? describedBy : undefined}
            disabled={disabled}
            onKeyDown={onKeyDown(k)}
            onInput={(e) => onCell(k, e.currentTarget.value)}
          />
        ))}
      </span>
      <span class="mgrid__bracket mgrid__bracket--r" aria-hidden="true" />
    </span>
  );
}
