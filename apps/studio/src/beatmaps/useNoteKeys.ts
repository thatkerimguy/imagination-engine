import { snapTime, timingAt } from '@ie/rhythm';
import { objectEnd, type BeatmapDef } from '@ie/story';
import { useEffect, useRef, type RefObject } from 'react';
import { addObject, newObjectId, removeObjects, toggleCombo } from './beatmap-edit.ts';
import type { EditorTime } from './editor-time.ts';
import { copyObjects, pasteObjects, stepTime, TOOLS, type Clip, type SliderDraft, type Tool } from './note-tools.ts';

export interface NoteKeys {
  /** Off while a test play has the keyboard. */
  readonly active: boolean;
  readonly map: BeatmapDef;
  readonly time: EditorTime;
  readonly divisor: number;
  readonly selected: ReadonlySet<string>;
  readonly draft: SliderDraft | null;
  readonly clip: RefObject<Clip | null>;
  readonly setTool: (tool: Tool) => void;
  readonly setSelected: (ids: ReadonlySet<string>) => void;
  readonly setDraft: (draft: SliderDraft | null) => void;
  readonly commit: (change: (m: BeatmapDef) => BeatmapDef) => void;
  readonly togglePlay: () => void;
  readonly seek: (t: number) => void;
  readonly finishSlider: () => void;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

/**
 * The note editor's keys: 1–4 pick a tool, Q a new combo, Delete removes, Space plays, arrows step
 * along the grid (Page Up/Down a bar, Home/End the ends), Enter and Escape finish or drop a slider,
 * Ctrl+A/C/X/V select, copy, cut, paste.
 */
export function useNoteKeys(keys: NoteKeys): void {
  const latest = useRef(keys);
  useEffect(() => {
    latest.current = keys;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = latest.current;
      if (!k.active || e.altKey || isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const handled = mod ? withMod(k, key) : plain(k, e.key, key, e.shiftKey);
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function withMod(k: NoteKeys, key: string): boolean {
  if (key === 'a') {
    k.setSelected(new Set(k.map.objects.map((o) => o.id)));
    return true;
  }
  if (key === 'c' || key === 'x') {
    const clip = copyObjects(k.map.objects, k.selected);
    if (!clip) return false;
    k.clip.current = clip;
    if (key === 'x') {
      k.commit((m) => removeObjects(m, k.selected));
      k.setSelected(new Set());
    }
    return true;
  }
  if (key === 'v' && k.clip.current) {
    const pasted = pasteObjects(k.clip.current, snapTime(k.map.timing, k.time.t, k.divisor), newObjectId);
    k.commit((m) => pasted.reduce(addObject, m));
    k.setSelected(new Set(pasted.map((o) => o.id)));
    return true;
  }
  return false;
}

function plain(k: NoteKeys, raw: string, key: string, shift: boolean): boolean {
  const tool = TOOLS[Number(raw) - 1];
  if (tool) {
    k.setTool(tool);
    return true;
  }
  switch (raw) {
    case ' ':
      k.togglePlay();
      return true;
    case 'ArrowRight':
    case 'ArrowLeft': {
      // Shift steps a whole beat.
      const divisor = shift ? 1 : k.divisor;
      k.seek(stepTime(k.map.timing, k.time.t, divisor, raw === 'ArrowRight' ? 1 : -1));
      return true;
    }
    case 'Home':
      k.seek(0);
      return true;
    case 'End':
      k.seek(k.map.objects.reduce((m, o) => Math.max(m, objectEnd(o)), 0));
      return true;
    case 'PageDown':
    case 'PageUp': {
      // A whole bar, beat by beat so tempo changes on the way are kept.
      let t = k.time.t;
      const beats = timingAt(k.map.timing, t).meter ?? 4;
      for (let i = 0; i < beats; i++) t = stepTime(k.map.timing, t, 1, raw === 'PageDown' ? 1 : -1);
      k.seek(t);
      return true;
    }
    case 'Delete':
    case 'Backspace':
      if (k.selected.size === 0) return false;
      k.commit((m) => removeObjects(m, k.selected));
      k.setSelected(new Set());
      return true;
    case 'Enter':
      if (!k.draft) return false;
      k.finishSlider();
      return true;
    case 'Escape':
      if (k.draft) k.setDraft(null);
      else k.setSelected(new Set());
      return true;
  }
  if (key === 'q' && k.selected.size > 0) {
    k.commit((m) => toggleCombo(m, k.selected));
    return true;
  }
  return false;
}
