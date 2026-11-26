// Read aloud: flatten a chapter into speakable segments and drive a tiny play/pause/skip state
// machine over a SpeechAdapter. Pure (no react-native): the adapter is the only platform seam.
import type { Block } from '@kn/core';
import { gimmickLines } from '../export/gimmick-text.ts';
import { stripInlineMarkup } from './inline-markup.ts';

export interface ReadSegment {
  blockIndex: number;
  blockId: string;
  text: string;
}

const clean = (s: string): string => stripInlineMarkup(s).replace(/\s+/g, ' ').trim();

/** Chapter blocks as plain speakable text, in order. Scene breaks and empty blocks are skipped. */
export function speakableSegments(blocks: readonly Block[]): ReadSegment[] {
  const out: ReadSegment[] = [];
  blocks.forEach((b, blockIndex) => {
    let text = '';
    if (b.kind === 'prose') text = clean(b.text);
    else if (b.kind === 'dialogue') {
      const line = clean(b.text);
      text = line ? `${clean(b.speaker)}: ${line}` : '';
    } else if (b.kind === 'module') {
      text = gimmickLines(b, 'transcript')
        .map((l) => clean(l.speaker ? `${l.speaker}: ${l.text}` : l.text))
        .filter(Boolean)
        .join(' ');
    }
    if (text) out.push({ blockIndex, blockId: b.id, text });
  });
  return out;
}

export const SPEEDS = [0.85, 1, 1.25, 1.5] as const;
export type ReadSpeed = (typeof SPEEDS)[number];

/** The next speed in the cycle (unknown values restart at 1×). */
export function nextSpeed(current: number): ReadSpeed {
  const i = SPEEDS.findIndex((s) => s === current);
  return i < 0 ? 1 : SPEEDS[(i + 1) % SPEEDS.length]!;
}

export const speedLabel = (speed: number): string => `${speed}×`;

export interface SpeakOptions {
  rate: number;
  onDone(): void;
  onError(): void;
}

export interface SpeechAdapter {
  speak(text: string, opts: SpeakOptions): void;
  stop(): void;
  pause?(): void;
  resume?(): void;
  available(): boolean;
}

export type ReadStatus = 'idle' | 'playing' | 'paused';
export interface ReadState {
  status: ReadStatus;
  index: number;
  speed: number;
}

export interface ReadAloud {
  play(from?: number): void;
  pause(): void;
  resume(): void;
  next(): void;
  prev(): void;
  stop(): void;
  setSpeed(speed: number): void;
  setSegments(segments: readonly ReadSegment[]): void;
  getState(): ReadState;
  onChange(listener: (state: ReadState) => void): () => void;
}

export function createReadAloud(
  adapter: SpeechAdapter,
  initial: readonly ReadSegment[],
  opts: { speed?: number } = {},
): ReadAloud {
  let segments = [...initial];
  let state: ReadState = { status: 'idle', index: 0, speed: opts.speed ?? 1 };
  // Bumped on every speak so a stale onDone from a stopped utterance is ignored.
  let token = 0;
  const listeners = new Set<(s: ReadState) => void>();

  const set = (patch: Partial<ReadState>): void => {
    state = { ...state, ...patch };
    for (const l of [...listeners]) l(state);
  };

  const speakCurrent = (): void => {
    const seg = segments[state.index];
    if (!seg) {
      set({ status: 'idle', index: 0 });
      return;
    }
    const mine = ++token;
    adapter.speak(seg.text, {
      rate: state.speed,
      onDone: () => {
        if (mine !== token || state.status !== 'playing') return;
        if (state.index + 1 >= segments.length) {
          set({ status: 'idle', index: 0 });
          return;
        }
        set({ index: state.index + 1 });
        speakCurrent();
      },
      onError: () => {
        if (mine !== token) return;
        token++;
        set({ status: 'idle' });
      },
    });
  };

  const halt = (): void => {
    token++;
    adapter.stop();
  };

  const jump = (index: number): void => {
    if (index < 0 || index >= segments.length) return;
    if (state.status === 'playing') {
      halt();
      set({ index });
      speakCurrent();
    } else set({ index });
  };

  return {
    play(from) {
      if (!segments.length) return;
      if (state.status === 'playing') halt();
      const index = Math.min(Math.max(0, from ?? state.index), segments.length - 1);
      set({ status: 'playing', index });
      speakCurrent();
    },
    pause() {
      if (state.status !== 'playing') return;
      halt();
      set({ status: 'paused' });
    },
    resume() {
      if (state.status !== 'paused') return;
      set({ status: 'playing' });
      speakCurrent();
    },
    next: () => jump(state.index + 1),
    prev: () => jump(state.index - 1),
    stop() {
      const wasIdle = state.status === 'idle' && state.index === 0;
      halt();
      if (!wasIdle) set({ status: 'idle', index: 0 });
    },
    setSpeed(speed) {
      set({ speed });
      if (state.status === 'playing') {
        halt();
        speakCurrent();
      }
    },
    setSegments(next) {
      const active = segments[state.index]?.blockId;
      segments = [...next];
      const kept = active ? segments.findIndex((s) => s.blockId === active) : -1;
      if (state.status === 'idle' || segments.length === 0) {
        halt();
        set({ status: 'idle', index: 0 });
      } else if (kept >= 0) state = { ...state, index: kept };
      else {
        halt();
        set({ status: 'idle', index: 0 });
      }
    },
    getState: () => state,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
