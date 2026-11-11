import { setMotionPreference } from '@ie/core';
import { SPACING_SCALE, TEXT_SCALE, type PlayerSettings } from './settings.ts';

/** Puts the reader's size and accessibility settings on the page (ADR 0022). */
export function applyAccess(root: HTMLElement, s: PlayerSettings): void {
  root.style.setProperty('--reader-scale', String(TEXT_SCALE[s.textSize]));
  root.style.setProperty('--reader-leading', String(SPACING_SCALE[s.spacing]));
  if (s.contrast === 'high') root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
  if (s.letters === 'plain') root.dataset.letters = 'plain';
  else delete root.dataset.letters;
  setMotionPreference(s.motion);
}
