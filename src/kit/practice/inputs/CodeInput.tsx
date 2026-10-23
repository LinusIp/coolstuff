/**
 * Write-the-code answers (README §8.2): an editor in CodeCell's style (a
 * textarea over its highlighted copy, line numbers; Tab indents, Esc then
 * Tab leaves, Ctrl/⌘+Enter runs the tests) and the per-test results of a
 * sandboxed run. Hidden tests show only "hidden test 4 ✓/×".
 */
import type { JSX } from 'preact';
import { useMemo, useRef } from 'preact/hooks';
import { tokenizeJs } from '../../controls';
import { IconCheck, IconCross, IconRefresh } from '../../core/icons';
import { lineCount, newlineIndent, outdentLine, INDENT } from '../code-edit';
import type { TestLine } from '../code-results';

export interface CodeEditorProps {
  value: string;
  onChange?: (source: string) => void;
  /** Read-only: no textarea (review, the reference solution). */
  readOnly?: boolean;
  label: string;
  idBase: string;
  /** Ctrl/⌘+Enter. */
  onRun?: () => void;
  /** Shows Reset when the code differs from this. */
  starter?: string;
  disabled?: boolean;
}

/** A small code editor with CodeCell's look (`.codecell` classes) and keyboard rules. */
export function CodeEditor({ value, onChange, readOnly, label, idBase, onRun, starter, disabled }: CodeEditorProps) {
  const area = useRef<HTMLTextAreaElement>(null);
  const hl = useRef<HTMLPreElement>(null);
  const escaped = useRef(false);
  const tokens = useMemo(() => tokenizeJs(value), [value]);
  const n = Math.max(lineCount(value), 4);
  const editable = !readOnly && !!onChange;

  const insert = (ta: HTMLTextAreaElement, text: string) => {
    ta.focus();
    const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
    if (!ok) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      onChange?.(ta.value);
    }
  };
  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (e.key === 'Escape') {
      escaped.current = true;
      return;
    }
    if (e.key === 'Tab') {
      if (escaped.current) {
        escaped.current = false; // Esc, then Tab: let focus leave the editor
        return;
      }
      e.preventDefault();
      if (e.shiftKey) {
        const ed = outdentLine(ta.value, ta.selectionStart);
        ta.value = ed.text;
        ta.setSelectionRange(ed.caret, ed.caret);
        onChange?.(ed.text);
      } else insert(ta, INDENT);
      return;
    }
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
    escaped.current = false;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onRun?.();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      insert(ta, newlineIndent(ta.value, ta.selectionStart));
    }
  };
  const onScroll = () => {
    const ta = area.current;
    if (ta && hl.current) hl.current.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
  };

  return (
    <div class={`codecell problem__code${readOnly ? ' is-readonly' : ''}`}>
      <div class="codecell__bar">
        <span class="label codecell__label" id={`${idBase}-code-label`}>
          {label}
        </span>
        {editable && starter !== undefined && (
          <span class="btn-row codecell__actions">
            <button type="button" class="btn btn--sm btn--quiet" data-hit disabled={disabled || value === starter} onClick={() => onChange?.(starter)}>
              <IconRefresh /> Reset
            </button>
          </span>
        )}
      </div>
      <div class="codecell__code" style={{ '--rows': String(n) }}>
        <div class="codecell__gutter" aria-hidden="true">
          {Array.from({ length: n }, (_, k) => (
            <span key={k}>{k + 1}</span>
          ))}
        </div>
        <div class="codecell__area">
          <pre ref={hl} class="codecell__hl" aria-hidden={editable ? 'true' : undefined} aria-labelledby={editable ? undefined : `${idBase}-code-label`}>
            <code>
              {tokens.map((t, k) => (t.kind === 'ws' || t.kind === 'punct' || t.kind === 'id' ? t.text : <span key={k} class={`tok-${t.kind}`}>{t.text}</span>))}
              {'\n'}
            </code>
          </pre>
          {editable && (
            <textarea
              ref={area}
              class="codecell__input"
              id={`${idBase}-code`}
              value={value}
              wrap="off"
              spellcheck={false}
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              disabled={disabled}
              aria-labelledby={`${idBase}-code-label`}
              aria-describedby={`${idBase}-code-keys`}
              onInput={(e) => onChange?.(e.currentTarget.value)}
              onKeyDown={onKeyDown}
              onScroll={onScroll}
              onBlur={() => (escaped.current = false)}
            />
          )}
        </div>
      </div>
      {editable && (
        <p class="fig-keys codecell__keys" id={`${idBase}-code-keys`}>
          <kbd>Tab</kbd> indents · <kbd>Esc</kbd>, then <kbd>Tab</kbd>, leaves the editor{onRun ? <> · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs the tests</> : null}
        </p>
      )}
    </div>
  );
}

/** One line per test: ✓/× name, the call, expected and got (visible tests), or just "hidden test 4 ✓". */
export function TestResults({ lines, logs }: { lines: readonly TestLine[]; logs?: readonly string[] }) {
  return (
    <div class="tests">
      <ul class="tests__list" aria-label="Test results">
        {lines.map((l, k) => (
          <li key={k} class={`test ${l.ok ? 'is-pass' : 'is-fail'}`}>
            <span class="test__mark">{l.ok ? <IconCheck /> : <IconCross />}</span>
            <span class="test__body">
              <span class="test__name">
                {l.name}
                <span class="sr-only">{l.ok ? ': passes' : ': fails'}</span>
              </span>
              {l.call && <code class="test__call">{l.call}</code>}
              {!l.ok && !l.hidden && (l.error ? <span class="test__detail">{l.error}</span> : <span class="test__detail">{`expected ${l.expected ?? '?'}, got ${l.got ?? 'nothing'}`}</span>)}
              {l.ok && l.got !== undefined && !l.hidden && <span class="test__detail test__detail--ok">{`→ ${l.got}`}</span>}
            </span>
          </li>
        ))}
      </ul>
      {logs && logs.length > 0 && (
        <div class="tests__logs">
          <p class="label">Console</p>
          <pre>{logs.join('\n')}</pre>
        </div>
      )}
    </div>
  );
}
