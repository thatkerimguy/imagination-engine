// Safe DOM construction for engines. Author text only ever enters the DOM as text nodes;
// there is no path to innerHTML/outerHTML, and `on*` / `href` / `src` attributes are refused.
import type { AccentRole } from '@kn/core/gimmicks';

export type Attrs = Record<string, string | number | boolean | null | undefined>;
export type Child = Node | string | number | null | undefined | false;

const BLOCKED_ATTR = /^(on|innerhtml$|outerhtml$|srcdoc$|href$|xlink:href$|src$|formaction$)/i;
const SVG_NS = 'http://www.w3.org/2000/svg';

function setAttrs(node: Element, attrs: Attrs): void {
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (BLOCKED_ATTR.test(name)) throw new Error(`[dom-safe] attribute "${name}" is not allowed`);
    if (name === 'class' || name === 'className') node.setAttribute('class', String(value));
    else node.setAttribute(name, value === true ? '' : String(value));
  }
}

function append(node: Node, children: readonly Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

/** `el('p', { class: 'x', 'aria-live': 'polite' }, 'text', child)` — text via text nodes only. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  setAttrs(node, attrs);
  append(node, children);
  return node;
}

/** Pure vector nodes via createElementNS (ornaments, meters); never innerHTML. */
export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  setAttrs(node, attrs);
  append(node, children);
  return node;
}

/** Replaces an element's content with plain text (the only way engines change text). */
export function setText(node: Node, text: string): void {
  node.textContent = text;
}

/** Appends `<style data-kn-engine="<id>">` once per document; engine CSS costs 0 B up front. */
export function injectEngineStyle(engineId: string, css: string): void {
  if (typeof document === 'undefined') return;
  if (document.head.querySelector(`style[data-kn-engine="${engineId}"]`)) return;
  const style = document.createElement('style');
  style.dataset.knEngine = engineId;
  style.textContent = css;
  document.head.append(style);
}

/** Scoped class name: `cls('frame-hud', 'title')` → `kn-e-frame-hud__title`. */
export const cls = (engineId: string, part?: string): string =>
  part ? `kn-e-${engineId}__${part}` : `kn-e-${engineId}`;

/** CSS colour for a blueprint accent role, read from the book's Visual DNA tokens. */
export function accentVar(role: AccentRole): string {
  switch (role) {
    case 'primary':
      return 'var(--dna-accent, #4fd1c5)';
    case 'secondary':
      return 'var(--dna-accent-2, #b794f4)';
    case 'warning':
      return 'var(--dna-warn, #f6ad55)';
    case 'success':
      return 'var(--dna-ok, #68d391)';
    case 'neutral':
      return 'var(--dna-muted, #a0aec0)';
  }
}

/** Visually hidden but announced (status lines, reveal results). */
export function srOnly(text: string): HTMLSpanElement {
  const s = el('span', { class: 'kn-e-sr' }, text);
  s.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
  return s;
}

/** Polite live region for engine status changes. */
export const liveRegion = (): HTMLParagraphElement =>
  el('p', { class: 'kn-e-live', 'aria-live': 'polite', role: 'status' });

/**
 * Native `<button type="button">` with an aria-label: Enter / Space / click all activate it, so
 * keyboard support is structural. The listener is removed when `signal` aborts.
 */
export function actionButton(
  label: string,
  onActivate: (e: Event) => void,
  signal: AbortSignal,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLButtonElement {
  const b = el('button', { type: 'button', 'aria-label': label, ...attrs }, ...children);
  b.addEventListener('click', onActivate, { signal });
  return b;
}
