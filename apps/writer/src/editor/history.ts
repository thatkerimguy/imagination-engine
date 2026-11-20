// Generic undo/redo history. Typing in one block within a short window coalesces into a single
// undo step; every structural change (add / delete / move / format / gimmick / replace) is a
// boundary that always pushes.
export const MAX_PAST = 100;
export const COALESCE_MS = 800;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastEdit?: { blockId: string; ts: number };
}

export type HistoryEdit = { kind: 'typing'; blockId: string; now: number } | { kind: 'boundary' };

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

export function pushHistory<T>(h: History<T>, next: T, edit: HistoryEdit): History<T> {
  if (next === h.present) return h;
  if (edit.kind === 'typing') {
    const last = h.lastEdit;
    const lastEdit = { blockId: edit.blockId, ts: edit.now };
    if (
      last &&
      last.blockId === edit.blockId &&
      edit.now - last.ts <= COALESCE_MS &&
      h.past.length
    ) {
      return { past: h.past, present: next, future: [], lastEdit };
    }
    return { past: [...h.past, h.present].slice(-MAX_PAST), present: next, future: [], lastEdit };
  }
  return { past: [...h.past, h.present].slice(-MAX_PAST), present: next, future: [] };
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0;

export function undo<T>(h: History<T>): History<T> {
  if (!canUndo(h)) return h;
  const present = h.past[h.past.length - 1]!;
  return { past: h.past.slice(0, -1), present, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!canRedo(h)) return h;
  const [present, ...future] = h.future as [T, ...T[]];
  return { past: [...h.past, h.present], present, future };
}
