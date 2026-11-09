import { z } from 'zod';
import type { Unsubscribe } from './events.ts';

/** A JSON-safe value that can live in the state store and in save files. */
export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };

export const valueSchema: z.ZodType<Value> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().refine(Number.isFinite, 'Numbers must be finite.'),
    z.boolean(),
    z.null(),
    z.array(valueSchema),
    z.record(z.string(), valueSchema),
  ]),
);

export const stateSnapshotSchema = z.record(z.string(), valueSchema);
export type StateSnapshot = z.output<typeof stateSnapshotSchema>;

export type StateListener = (
  key: string,
  value: Value | undefined,
  previous: Value | undefined,
) => void;

const KEY = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const ALL = '*';

function sameValue(a: Value | undefined, b: Value | undefined): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Engine-wide variables (`game.gold`, `chapter.met_mira`). Values are copied on the way in and out,
 * so callers can't mutate stored state by accident.
 */
export class StateStore {
  private readonly values = new Map<string, Value>();
  private readonly listeners = new Map<string, Set<StateListener>>();

  get(key: string): Value | undefined {
    const value = this.values.get(key);
    return value === undefined ? undefined : structuredClone(value);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  keys(prefix = ''): string[] {
    return [...this.values.keys()].filter((key) => key.startsWith(prefix));
  }

  set(key: string, value: Value): void {
    if (!KEY.test(key)) {
      throw new Error(`State key "${key}" must be dot-separated words (letters, digits, _).`);
    }
    const parsed = valueSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error(
        `State value for "${key}" is not JSON-safe: ${z.prettifyError(parsed.error)}`,
      );
    }
    const previous = this.values.get(key);
    if (sameValue(previous, parsed.data)) return;
    this.values.set(key, structuredClone(parsed.data));
    this.notify(key, parsed.data, previous);
  }

  delete(key: string): void {
    const previous = this.values.get(key);
    if (previous === undefined) return;
    this.values.delete(key);
    this.notify(key, undefined, previous);
  }

  /** Listen to one key, or to every key with `'*'`. */
  subscribe(key: string, listener: StateListener): Unsubscribe {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  snapshot(): StateSnapshot {
    const out: StateSnapshot = {};
    for (const [key, value] of this.values) out[key] = structuredClone(value);
    return out;
  }

  /** Replaces all values, notifying listeners only for keys that actually changed. */
  restore(snapshot: StateSnapshot): void {
    const next = stateSnapshotSchema.parse(snapshot);
    const changed = new Set([...this.values.keys(), ...Object.keys(next)]);
    const previous = new Map(this.values);
    this.values.clear();
    for (const [key, value] of Object.entries(next)) this.values.set(key, structuredClone(value));
    for (const key of changed) {
      const before = previous.get(key);
      const after = this.values.get(key);
      if (!sameValue(before, after)) this.notify(key, after, before);
    }
  }

  private notify(key: string, value: Value | undefined, previous: Value | undefined): void {
    for (const target of [key, ALL]) {
      const set = this.listeners.get(target);
      if (!set) continue;
      for (const listener of [...set]) {
        try {
          listener(key, value === undefined ? undefined : structuredClone(value), previous);
        } catch (error) {
          console.error(`[engine] state listener for "${key}" threw`, error);
        }
      }
    }
  }
}
