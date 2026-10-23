/**
 * A timeline for stepping through algorithms and simulations frame by frame
 * (README §7.4): play/pause, step back/forward, a scrubber with notable
 * frames marked, a frame counter, and the frame's narration in a polite live
 * region.
 *
 *   const frame = signal(0);
 *   const state = computed(() => TRACE[frame.value].state);
 *   <PlayScrub frame={frame} count={TRACE.length} notes={TRACE.map((f) => f.note ?? '')} marks={[4, 9]} />
 *
 * Never autoplays; pauses when scrolled off-screen or when the tab is hidden;
 * under reduced motion "play" still steps (frames are discrete) at most 2 fps.
 * Keyboard (anywhere inside): Space play/pause, ← → step, Home/End.
 */
import { useSignal, type Signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { useInView, useReducedMotion } from '../core/hooks';
import { IconNext, IconPause, IconPlay, IconPrev } from '../core/icons';
import { RichText } from '../core/RichText';
import type { Rich } from '../types';
import { clampIndex, frameCounter, frameInterval, playStart, playTick, stepIndex } from './timeline';

export interface PlayScrubProps {
  /** 0-based frame. */
  frame: Signal<number>;
  count: number;
  /** Optional shared play state (e.g. to pause from elsewhere); default internal. */
  playing?: Signal<boolean>;
  /** Frames per second when playing; default 2 (at most 2 under reduced motion). */
  fps?: number;
  loop?: boolean;
  /** Short label per frame shown beside the counter: "Pass 2 · compare 7 and 4". */
  label?: (i: number) => string;
  /** Per-frame narration (a Trace's notes), read out politely as frames change. */
  notes?: readonly Rich[];
  /** Notable frames, ticked on the scrubber. */
  marks?: readonly number[];
  /** Accessible name of the timeline; default "Timeline". */
  name?: string;
  class?: string;
}

export function PlayScrub({ frame, count, playing: playingProp, fps = 2, loop = false, label, notes, marks, name = 'Timeline', class: cls }: PlayScrubProps) {
  const own = useSignal(false);
  const playing = playingProp ?? own;
  const reduced = useReducedMotion();
  const [el, setEl] = useState<HTMLElement | null>(null);
  const inView = useInView(el, '0px');
  const uid = useId();
  const spaceDown = useRef(false);

  const i = clampIndex(frame.value, count);
  const isPlaying = playing.value && count > 1;

  // The play loop: one frame per interval; stops at the end unless looping.
  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => {
      const next = playTick(frame.peek(), count, loop);
      frame.value = next.frame;
      if (next.stop) playing.value = false;
    }, frameInterval(fps, reduced));
    return () => clearInterval(t);
  }, [isPlaying, fps, reduced, loop, count, frame, playing]);

  // Pause off-screen and in hidden tabs.
  useEffect(() => {
    if (!inView && playing.peek()) playing.value = false;
  }, [inView, playing]);
  useEffect(() => {
    const onVis = () => document.hidden && (playing.value = false);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [playing]);

  const toggle = () => {
    if (count <= 1) return;
    if (!playing.peek()) frame.value = loop ? clampIndex(frame.peek(), count) : playStart(frame.peek(), count);
    playing.value = !playing.peek();
  };
  const step = (dir: 1 | -1) => {
    const hadFocus = !!el && el.contains(document.activeElement);
    playing.value = false;
    frame.value = stepIndex(frame.peek(), dir, count);
    // A step button that disables itself (first/last frame) drops focus to <body>: hand it to the scrubber.
    if (hadFocus)
      requestAnimationFrame(() => {
        const a = document.activeElement as HTMLButtonElement | null;
        if (el && !(a && el.contains(a) && !a.disabled)) el.querySelector<HTMLInputElement>('.playscrub__scrub')?.focus();
      });
  };
  const jump = (to: number) => {
    playing.value = false;
    frame.value = clampIndex(to, count);
  };

  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (!spaceDown.current) toggle();
      spaceDown.current = true;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      jump(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      jump(count - 1);
    }
  };
  // Space activates buttons on key-up: swallow it so the focused button doesn't fire too.
  const onKeyUp = (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      spaceDown.current = false;
    }
  };

  const text = label?.(i);
  const note = notes?.[i];
  const pct = count > 1 ? (i / (count - 1)) * 100 : 0;
  return (
    <div ref={setEl} class={['playscrub', cls].filter(Boolean).join(' ')} role="group" aria-label={name} onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
      <div class="playscrub__bar">
        <button type="button" class="icon-btn playscrub__play" aria-label={isPlaying ? 'Pause' : 'Play'} disabled={count <= 1} onClick={toggle}>
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>
        <button type="button" class="icon-btn playscrub__back" aria-label="Previous frame" disabled={i <= 0} onClick={() => step(-1)}>
          <IconPrev />
        </button>
        <div class="playscrub__track">
          <input
            type="range"
            class="playscrub__scrub"
            min={0}
            max={Math.max(0, count - 1)}
            step={1}
            value={i}
            style={{ '--fill': `${pct.toFixed(2)}%` }}
            aria-label={`${name}: frame`}
            aria-valuetext={`Frame ${i + 1} of ${count}${text ? `: ${text}` : ''}`}
            aria-describedby={note ? `${uid}-note` : undefined}
            disabled={count <= 1}
            onInput={(e) => jump(Number(e.currentTarget.value))}
          />
          {marks?.length ? (
            <div class="playscrub__marks" aria-hidden="true">
              {marks
                .filter((m) => m >= 0 && m < count)
                .map((m) => (
                  <span key={m} class={`playscrub__mark${m === i ? ' is-on' : ''}`} style={{ left: `${count > 1 ? (m / (count - 1)) * 100 : 0}%` }} />
                ))}
            </div>
          ) : null}
        </div>
        <button type="button" class="icon-btn playscrub__fwd" aria-label="Next frame" disabled={i >= count - 1} onClick={() => step(1)}>
          <IconNext />
        </button>
        <span class="playscrub__count" aria-hidden="true">
          {frameCounter(i, count)}
        </span>
      </div>
      {(text || note !== undefined) && (
        <div class="playscrub__text">
          {text && <p class="playscrub__label">{text}</p>}
          {note !== undefined && (
            <div class="playscrub__note" id={`${uid}-note`} aria-live="polite" aria-atomic="true">
              {note ? <RichText inline text={note} /> : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
