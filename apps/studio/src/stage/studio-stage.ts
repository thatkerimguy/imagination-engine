import { createStageHost } from '@ie/stage';
import type { Locale } from '@ie/i18n';
import { director as audio } from '../audio/studio-audio.ts';
import { useProject } from '../project/store.ts';

/*
 * The Studio's stage: one director, moved between the panels that show it (Play and the Stage
 * view), so its GPU context is made once (ADR 0015).
 */

let mount: HTMLElement | null = null;
let root: HTMLElement | null = null;
let locale: Locale = 'en';

export const stage = createStageHost({
  mount: () => mount,
  contained: true,
  root: () => root,
  locale: () => locale,
  beatPhase: () => audio.beatPhase(),
  beat: () => audio.beatInfo(),
  materials: () => useProject.getState().history?.present.materials,
});

/**
 * Shows the stage in `panel` (positioned), moving `text` with the camera. Returns a function that
 * takes it away again and clears what was on it.
 */
export function attachStage(
  panel: HTMLElement,
  text: HTMLElement | null,
  language: Locale,
): () => void {
  mount = panel;
  root = text;
  locale = language;
  stage.attach(panel);
  return () => {
    stage.applyScene({});
    stage.attach(null);
    if (mount === panel) mount = null;
    if (root === text) root = null;
  };
}

export function setStageLocale(language: Locale): void {
  locale = language;
}
