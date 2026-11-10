import type { Locale } from '@ie/i18n';
import type { MinigameGame, MinigameResult, MinigameTemplate } from '@ie/story';

/** A direction, for prompts and for sliding tiles. */
export const DIRECTIONS = ['up', 'right', 'down', 'left'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/**
 * What a reader can do in any minigame, whatever the device (ADR 0021). Views turn touches into
 * these; the keyboard reader does the same for keys.
 */
export type MinigameInput =
  | { readonly kind: 'press' }
  | { readonly kind: 'release' }
  | { readonly kind: 'dir'; readonly dir: Direction }
  | { readonly kind: 'pick'; readonly index: number }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'back' };

export interface SetupContext {
  /** Seeded: the same seed deals the same game. Returns a number from 0 up to, not including, 1. */
  readonly random: () => number;
  readonly locale: Locale;
  /** 1 normally; above 1, time limits and target zones grow (the reader's assist setting). */
  readonly ease: number;
}

/** One template's rules: pure, seeded and DOM-free. */
export interface MinigameDef<G extends MinigameGame, S> {
  readonly id: G['template'];
  setup(game: G, ctx: SetupContext): S;
  /** Moves time on by `dt` seconds. */
  update(state: S, dt: number): void;
  onInput(state: S, input: MinigameInput): void;
  /** The result once the game is over, else null. */
  result(state: S): MinigameResult | null;
  /** Share of the time limit left, from 1 down to 0, or null when the game has no clock. */
  timeLeft?(state: S): number | null;
}

export function defineMinigame<G extends MinigameGame, S>(
  def: MinigameDef<G, S>,
): MinigameDef<G, S> {
  return def;
}

/** A running game of any template, for the screen, tests and an auto-playtester. */
export interface MinigameSession {
  readonly template: MinigameTemplate;
  readonly state: unknown;
  update(dt: number): void;
  input(input: MinigameInput): void;
  result(): MinigameResult | null;
  timeLeft(): number | null;
}

/** A small seeded generator (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** A whole score from 0 to 100. */
export const score = (value: number): number => Math.round(clamp(value, 0, 100));

/** Shuffles in place and returns the array. */
export function shuffle<T>(list: T[], random: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = list[i] as T;
    list[i] = list[j] as T;
    list[j] = a;
  }
  return list;
}
