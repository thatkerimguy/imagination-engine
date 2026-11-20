import type { Route } from '../router.ts';
import type { AudioBus } from '../runtime/audio-bus.ts';
import type { Stage } from '../runtime/stage.ts';

export interface ViewContext {
  main: HTMLElement;
  stage: Stage;
  audio: AudioBus;
  setBar(title: string, back: Route | null): void;
  link(route: Route, ...children: (Node | string | null)[]): HTMLAnchorElement;
}

export type Cleanup = () => void;

export function errorView(main: HTMLElement, err: unknown): void {
  console.warn(err);
  const p = document.createElement('p');
  p.className = 'kn-empty';
  p.textContent = 'This page could not be loaded. Check your connection and try again.';
  main.replaceChildren(p);
}

export function applyTheme(el: HTMLElement, theme: Record<string, string>, accent?: string): void {
  for (const [k, v] of Object.entries(theme)) el.style.setProperty(k, v);
  if (accent) el.style.setProperty('--accent', accent);
}
