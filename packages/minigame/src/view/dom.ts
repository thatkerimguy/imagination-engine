import type { Locale, Translator } from '@ie/i18n';
import type { MinigameInput } from '../types.ts';
import type { MiniKey } from './messages.ts';

/** What a template's view gets from the screen around it. */
export interface ViewContext {
  readonly t: Translator<MiniKey>;
  readonly locale: Locale;
  /** Sends a reader action to the game. */
  emit(input: MinigameInput): void;
  /** The line under the title: what is happening and how far along. */
  status(text: string): void;
}

/** A mounted template: `draw` runs every frame and must skip writes when nothing changed. */
export interface MountedView {
  draw(): void;
  /** A key the screen didn't use itself (letters, in a cipher). Returns true when it was used. */
  key?(event: KeyboardEvent): boolean;
  /** Puts the keyboard where the game needs it (the typing field). */
  focus?(): void;
  dispose?(): void;
}

export type TemplateView<S> = (field: HTMLElement, state: S, ctx: ViewContext) => MountedView;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  parent?.append(node);
  return node;
}

/**
 * A button that acts the moment a finger lands (a click arrives ~100 ms later on phones) and
 * still works from the keyboard, where a click has no pointer before it.
 */
export function pressButton(
  className: string,
  parent: HTMLElement,
  onPress: () => void,
): HTMLButtonElement {
  const button = el('button', className, parent);
  button.type = 'button';
  button.addEventListener('pointerdown', (event) => {
    if (event.button > 0) return;
    event.preventDefault();
    onPress();
  });
  button.addEventListener('click', (event) => {
    if (event.detail === 0) onPress();
  });
  return button;
}

/** Writes text, a data attribute or a transform only when it changed, so idle frames cost nothing. */
export class Painter {
  private readonly seen = new Map<string, string>();

  private changed(key: string, value: string): boolean {
    if (this.seen.get(key) === value) return false;
    this.seen.set(key, value);
    return true;
  }

  text(key: string, node: HTMLElement, value: string): void {
    if (this.changed(key, value)) node.textContent = value;
  }

  data(key: string, node: HTMLElement, name: string, value: string): void {
    if (this.changed(key, value)) node.dataset[name] = value;
  }

  /** Moves a node along its own width or height, in percent. */
  shift(key: string, node: HTMLElement, percent: number, axis: 'X' | 'Y' = 'X'): void {
    const value = `translate${axis}(${percent.toFixed(2)}%)`;
    if (this.changed(key, value)) node.style.transform = value;
  }

  scale(key: string, node: HTMLElement, share: number): void {
    const value = `scaleX(${Math.max(0, Math.min(1, share)).toFixed(3)})`;
    if (this.changed(key, value)) node.style.transform = value;
  }

  /** Runs `build` only when `value` changed (a new word, a new board). */
  when(key: string, value: string, build: () => void): void {
    if (this.changed(key, value)) build();
  }
}
