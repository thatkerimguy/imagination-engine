// Book Visual DNA persistence model (pure). A book stores either an archetype id (unmodified
// preset) or a full BookVisualDna object in `NovelManifest.visualDna`.
import {
  DNA_ARCHETYPES,
  DNA_ARCHETYPE_IDS,
  isDnaArchetypeId,
  parseVisualDna,
  resolveVisualDna,
  type BookVisualDna,
  type DnaArchetypeId,
  type DnaTheme,
  type ResolvedVisualDna,
} from '@kn/core/dna';
import type { NovelManifest } from '@kn/core';

export const DEFAULT_DNA_ID: DnaArchetypeId = 'editorial-minimal';
export type DnaValue = string | BookVisualDna;
type NovelDna = Pick<NovelManifest, 'id' | 'visualDna'>;

export const cloneDna = (d: BookVisualDna): BookVisualDna =>
  JSON.parse(JSON.stringify(d)) as BookVisualDna;

/** The book's DNA: stored archetype/object, else the default (Chrome Tide keeps noir-rain). */
export function dnaFromNovel(novel: NovelDna): BookVisualDna {
  const raw = novel.visualDna;
  if (isDnaArchetypeId(raw)) return cloneDna(DNA_ARCHETYPES[raw]);
  if (raw !== undefined && raw !== null) {
    const parsed = parseVisualDna(raw);
    if (parsed.ok) return cloneDna(parsed.dna);
  }
  return cloneDna(DNA_ARCHETYPES[novel.id === 'vertical-slice' ? 'noir-rain' : DEFAULT_DNA_ID]);
}

const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  return (
    ka.length === Object.keys(b).length &&
    ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
};
export const sameDna = (a: BookVisualDna, b: BookVisualDna): boolean => same(a, b);

/** The archetype this DNA equals exactly, or null when it has been fine-tuned. */
export function matchingArchetype(dna: BookVisualDna): DnaArchetypeId | null {
  return DNA_ARCHETYPE_IDS.find((id) => sameDna(DNA_ARCHETYPES[id], dna)) ?? null;
}

/** What to persist: the archetype id when unmodified, else the full object. */
export const serializeDna = (dna: BookVisualDna): DnaValue =>
  matchingArchetype(dna) ?? cloneDna(dna);

export const resolveNovelDna = (novel: NovelDna, theme: DnaTheme): ResolvedVisualDna =>
  resolveVisualDna(dnaFromNovel(novel), theme);

/** Immutable one-axis patch: `patchDna(d, 'palette', { hue: 10 })`. */
export function patchDna<K extends keyof BookVisualDna>(
  dna: BookVisualDna,
  axis: K,
  patch: Partial<BookVisualDna[K]>,
): BookVisualDna {
  return { ...dna, [axis]: { ...dna[axis], ...patch } };
}

export const clampTo = (v: number, lo: number, hi: number): number =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
