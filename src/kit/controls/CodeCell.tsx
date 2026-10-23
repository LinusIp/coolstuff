/**
 * "Code it" (README §7.6): an editable, runnable JavaScript snippet whose
 * emits update the lesson's visuals.
 *
 *   const path = signal<Vec2[]>([]);
 *   <CodeCell code={SNIPPETS.gd} inputs={{ eta, w0 }} helpers={{ grad: '(w) => 2 * (w - 3)' }}
 *     outputs={{ path: codeOutput(path, parsePoints, 'all') }} concepts={{ eta: 'rate' }} stream autorun />
 *
 * Code runs only in the sandbox Worker (runSandboxed); a malformed emit is
 * caught by its output's `parse`, shown to the learner, and never reaches the
 * signal. The editor is a textarea over a highlighted copy (syntax by weight
 * and italics; concept identifiers underlined in the concept's line style).
 * Tab indents; Esc, then Tab, leaves the editor (no keyboard trap).
 */
import { useSignal, useSignalEffect, type ReadonlySignal, type Signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useId, useMemo, useRef } from 'preact/hooks';
import { cloneIssue, type CodePrelude } from '../core/codecheck';
import { IconPlay, IconRefresh } from '../core/icons';
import { isSignalLike } from '../core/live';
import { indent, lineCount, newlineWithIndent, type Edit } from './editor';
import { tokenizeJs } from './highlight';
import { runSandboxed, type SandboxResult, type StreamOption } from './sandbox';

export interface CodeOutput<T> {
  signal: Signal<T>;
  /** Validate what learner code emitted: return the value, or null / throw an Error (its message is shown) to reject it. */
  parse: (v: unknown) => T | null;
  /** 'last' (default): the latest emit(name, v). 'all': the list of every value emitted under name. */
  from?: 'last' | 'all';
}

/** `outputs={{ path: codeOutput(path, parsePoints, 'all') }}` */
export function codeOutput<T>(signal: Signal<T>, parse: (v: unknown) => T | null, from: 'last' | 'all' = 'last'): CodeOutput<T> {
  return { signal, parse, from };
}

export interface CodeCellProps {
  /** Initial source (JavaScript). Keep it in problems.ts SNIPPETS so lesson tests run it. */
  code: string;
  /** Default "Code it". */
  label?: string;
  /** Default true. */
  editable?: boolean;
  /** Run on mount and after edits (debounced 400ms) and input changes. Default false (Run button). */
  autorun?: boolean;
  /** Read-only globals: signals are read for their current value; plain, structured-cloneable data only. */
  inputs?: Readonly<Record<string, ReadonlySignal<unknown> | unknown>>;
  /** Hidden named helpers (source strings, or self-contained functions). */
  helpers?: CodePrelude['helpers'];
  /** Hidden setup run first; error lines stay relative to the visible code. */
  prelude?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outputs?: Readonly<Record<string, CodeOutput<any>>>;
  /** Deliver emits during the run (throttled, default 50ms; the last always arrives). Default false: once, at the end. */
  stream?: StreamOption;
  /** Identifier → concept: underlined in the concept's line style. */
  concepts?: Readonly<Record<string, string>>;
  /** Default 2000. */
  timeoutMs?: number;
  onResult?: (r: SandboxResult) => void;
  /** Minimum visible rows. */
  lines?: number;
  class?: string;
}

interface OutState {
  status: 'idle' | 'running' | 'done';
  result?: SandboxResult;
  ms?: number;
  /** Rejected emits and refusals, learner-facing. */
  problems: string[];
}

const AUTORUN_MS = 400;

function readInputs(inputs: CodeCellProps['inputs'], track: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(inputs ?? {})) out[k] = isSignalLike(v) ? (track ? v.value : v.peek()) : v;
  return out;
}

function deliver(name: string, raw: unknown, out: CodeOutput<unknown>, problems: string[]): void {
  try {
    const v = out.parse(raw);
    if (v === null) throw new Error('that value can’t be drawn');
    out.signal.value = v;
  } catch (err) {
    problems.push(`emit("${name}", …): ${(err as Error)?.message ?? String(err)}`);
  }
}

export function CodeCell(props: CodeCellProps) {
  const { code, label = 'Code it', editable = true, autorun = false, concepts, lines } = props;
  const uid = useId();
  const src = useSignal(code);
  const out = useSignal<OutState>({ status: 'idle', problems: [] });
  const area = useRef<HTMLTextAreaElement>(null);
  const hl = useRef<HTMLPreElement>(null);
  const escaped = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(props);
  latest.current = props;

  const run = async (inputValues?: Record<string, unknown>) => {
    const p = latest.current;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    const values = inputValues ?? readInputs(p.inputs, false);
    const issue = cloneIssue(values, 'inputs');
    if (issue) {
      console.error(`CodeCell "${label}": ${issue}`);
      out.value = { status: 'done', problems: [`This cell can’t run: ${issue}`] };
      return;
    }
    out.value = { ...out.peek(), status: 'running' }; // keep the last output on screen until the new one arrives
    const problems: string[] = [];
    const sofar = new Map<string, unknown[]>();
    const t0 = performance.now();
    const outs = p.outputs ?? {};
    const r = await runSandboxed(
      { code: src.peek(), inputs: values, helpers: p.helpers, prelude: p.prelude, timeoutMs: p.timeoutMs ?? 2000, stream: p.stream },
      {
        signal: ctl.signal,
        onEmit: p.stream
          ? (name, value) => {
              const o = outs[name];
              if (!o) return;
              if ((o.from ?? 'last') === 'last') deliver(name, value, o, problems);
              else {
                const list = sofar.get(name) ?? [];
                list.push(value);
                sofar.set(name, list);
                deliver(name, list, o, problems);
              }
            }
          : undefined,
      },
    );
    if (ctl.signal.aborted) return;
    // The final values: the last emit, or every emit (the full list, not the throttled one).
    for (const [name, o] of Object.entries(outs)) {
      const from = o.from ?? 'last';
      if (from === 'last' && name in r.emits) deliver(name, r.emits[name], o, problems);
      if (from === 'all' && r.streams[name]) deliver(name, r.streams[name], o, problems);
    }
    out.value = { status: 'done', result: r, ms: performance.now() - t0, problems: [...new Set(problems)] };
    p.onResult?.(r);
  };

  // autorun: on mount, after edits (debounced) and whenever an input signal changes.
  useSignalEffect(() => {
    if (!autorun) return;
    const values = readInputs(latest.current.inputs, true);
    if (src.value === undefined) return; // reading src subscribes: re-run after edits
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(values), AUTORUN_MS);
  });
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      abort.current?.abort();
    },
    [],
  );

  const apply = (e: Edit) => {
    const ta = area.current;
    if (!ta) return;
    ta.value = e.text;
    ta.setSelectionRange(e.selStart, e.selEnd);
    src.value = e.text;
  };

  const insert = (ta: HTMLTextAreaElement, text: string) => {
    // execCommand keeps the browser's undo history; setRangeText is the fallback.
    ta.focus();
    const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
    if (!ok) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      src.value = ta.value;
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
        escaped.current = false; // let the browser move focus: Esc, then Tab, leaves
        return;
      }
      e.preventDefault();
      const multi = ta.value.slice(ta.selectionStart, ta.selectionEnd).includes('\n');
      if (!e.shiftKey && !multi) insert(ta, '  ');
      else apply(indent(ta.value, ta.selectionStart, ta.selectionEnd, e.shiftKey ? -1 : 1));
      return;
    }
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return; // Esc, then Shift+Tab
    escaped.current = false;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void run();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      insert(ta, newlineWithIndent(ta.value, ta.selectionStart));
    }
  };

  const reset = () => {
    src.value = code;
    if (area.current) area.current.value = code;
    out.value = { status: 'idle', problems: [] };
  };

  const onScroll = () => {
    const ta = area.current;
    if (ta && hl.current) hl.current.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
  };

  const text = src.value;
  const n = Math.max(lineCount(text), lines ?? 1);
  const state = out.value;
  const r = state.result;
  const errorLine = r?.error?.where === 'code' ? r.error.line : undefined;
  const tokens = useMemo(() => tokenizeJs(text), [text]);
  const highlighted = useMemo(
    () =>
      tokens.map((t, k) => {
        const ct = t.kind === 'id' ? concepts?.[t.text] : undefined;
        if (ct) return <span key={k} class={`tok-ct ct-${ct}`}>{t.text}</span>;
        if (t.kind === 'ws' || t.kind === 'punct' || t.kind === 'id') return t.text;
        return <span key={k} class={`tok-${t.kind}`}>{t.text}</span>;
      }),
    [tokens, concepts],
  );
  const changed = text !== code;

  return (
    <div class={['codecell', props.class].filter(Boolean).join(' ')} data-codecell>
      <div class="codecell__bar">
        <span class="label codecell__label" id={`${uid}-label`}>
          {label}
        </span>
        <span class="btn-row codecell__actions">
          {editable && (
            <button type="button" class="btn btn--sm btn--quiet" data-hit disabled={!changed} onClick={reset}>
              <IconRefresh /> Reset
            </button>
          )}
          <button type="button" class="btn btn--sm btn--primary" data-hit onClick={() => void run()} aria-describedby={`${uid}-out`}>
            <IconPlay /> {state.status === 'running' ? 'Running…' : 'Run'}
          </button>
        </span>
      </div>
      <div class="codecell__code" style={{ '--rows': String(n) }}>
        <div class="codecell__gutter" aria-hidden="true">
          {Array.from({ length: n }, (_, k) => (
            <span key={k} class={errorLine === k + 1 ? 'is-error' : undefined}>
              {k + 1}
            </span>
          ))}
        </div>
        <div class="codecell__area">
          <pre ref={hl} class="codecell__hl" aria-hidden={editable ? 'true' : undefined}>
            <code>
              {highlighted}
              {'\n'}
            </code>
          </pre>
          {editable && (
            <textarea
              ref={area}
              class="codecell__input"
              value={text}
              wrap="off"
              spellcheck={false}
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              aria-labelledby={`${uid}-label`}
              aria-describedby={`${uid}-keys`}
              onInput={(e) => (src.value = e.currentTarget.value)}
              onKeyDown={onKeyDown}
              onScroll={onScroll}
              onBlur={() => (escaped.current = false)}
            />
          )}
        </div>
      </div>
      {editable && (
        <p class="fig-keys codecell__keys" id={`${uid}-keys`}>
          <kbd>Tab</kbd> indents · <kbd>Esc</kbd>, then <kbd>Tab</kbd>, leaves the editor · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs
        </p>
      )}
      <div class={`codecell__out${r && !r.ok ? ' is-error' : ''}`} id={`${uid}-out`} aria-live="polite">
        <CellOutput state={state} />
      </div>
    </div>
  );
}

function CellOutput({ state }: { state: OutState }) {
  if (state.status === 'running' && !state.result) return <p class="codecell__status">Running…</p>;
  const r = state.result;
  const lines: JSX.Element[] = [];
  if (r) {
    r.logs.forEach((l, k) => lines.push(<p key={`l${k}`} class="codecell__log">{l}</p>));
    if (r.error) {
      const where = r.timedOut ? '' : r.error.where === 'prelude' ? 'In the hidden setup code: ' : r.error.line ? `Line ${r.error.line}: ` : '';
      lines.push(
        <p key="err" class="codecell__error">
          {where}
          {r.error.message}
        </p>,
      );
    }
    if (r.report) lines.push(<p key="rep" class="codecell__status">{`${r.report.passed} of ${r.report.total} tests pass.`}</p>);
  }
  state.problems.forEach((m, k) =>
    lines.push(
      <p key={`p${k}`} class="codecell__error">
        {m}
      </p>,
    ),
  );
  if (r?.ok && !state.problems.length) {
    const emitted = Object.entries(r.streams).map(([k, v]) => (v.length > 1 ? `${k} (${v.length} values)` : k));
    lines.push(
      <p key="ok" class="codecell__status">
        {`Ran in ${Math.max(1, Math.round(state.ms ?? 0))} ms${emitted.length ? ` · emitted ${emitted.join(', ')}` : ''}.`}
      </p>,
    );
  }
  if (!lines.length) return <p class="codecell__status">Press Run to see the output.</p>;
  return <>{lines}</>;
}
