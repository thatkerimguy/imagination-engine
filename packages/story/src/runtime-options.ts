import type { Value } from '@ie/core';
import type { StoryState } from './state.ts';

export interface StoryHost {
  /** Runs a module action from an Action block (through the kernel's action bus). */
  runAction?(id: string, params: unknown): void;
  /** Persistent variables or unlocked endings changed; store them outside the save slots. */
  onPersistentChange?(values: Readonly<Record<string, Value>>): void;
}

export interface RuntimeOptions {
  readonly state?: StoryState;
  readonly persistent?: Readonly<Record<string, Value>>;
  readonly seed?: number;
  /** Passage to begin a new playthrough at (the Studio's "Play from here"); the story start if unset. */
  readonly start?: string;
  readonly host?: StoryHost;
}

/** Persistent key that lists the endings reached in any playthrough. */
export const ENDINGS_KEY = '__endings';
