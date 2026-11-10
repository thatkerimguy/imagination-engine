import type { IconName, ScreenAction } from '@ie/story';
import type { ViewNode } from './screen-model.ts';
import { buildText } from './text-dom.ts';

/*
 * Screens to DOM (ADR 0018). Builds a screen's view model into plain elements: no state of its
 * own except which tab is showing, which the caller keeps so a HUD rebuild doesn't reset it.
 */

const SVG = 'http://www.w3.org/2000/svg';

/** Stroke paths on a 24-unit grid. A closed set, so screens stay valid data. */
export const ICON_PATHS: Readonly<Record<IconName, readonly string[]>> = {
  heart: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
  coin: ['M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0', 'M12 8v8', 'M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3'],
  star: ['M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z'],
  key: ['M3 15a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M10 12l10-10', 'M16 6l3 3', 'M13.5 8.5l2 2'],
  clock: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 7v5l3 2'],
  book: [
    'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z',
    'M5 19.5A1.5 1.5 0 0 0 6.5 21H19',
  ],
  search: ['M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'M16.2 16.2L21 21'],
  message: ['M4 5h16v11H9.5L5 19.5V16H4z'],
  map: ['M3 6.5l6-3 6 3 6-3v14l-6 3-6-3-6 3z', 'M9 3.5v14', 'M15 6.5v14'],
  bolt: ['M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z'],
};

export function iconElement(icon: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('screen__icon');
  for (const d of ICON_PATHS[icon]) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export interface RenderOptions {
  /** A button was pressed. */
  readonly onAction: (actions: readonly ScreenAction[]) => void;
  /** Which tab each Tabs component shows, by component id; kept by the caller. */
  readonly tabs: Map<string, string>;
  /** Re-render after a tab switch. */
  readonly onTab: () => void;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderNode(node: ViewNode, options: RenderOptions): HTMLElement | SVGSVGElement {
  switch (node.kind) {
    case 'stack': {
      const box = el('div', 'screen__stack');
      box.dataset.direction = node.direction;
      box.dataset.gap = node.gap;
      box.dataset.align = node.align;
      box.append(...renderNodes(node.children, options));
      return box;
    }
    case 'grid': {
      const box = el('div', 'screen__grid');
      box.style.setProperty('--columns', String(node.columns));
      box.append(...renderNodes(node.children, options));
      return box;
    }
    case 'text': {
      const box = el(
        node.style === 'title' ? 'h2' : node.style === 'heading' ? 'h3' : 'p',
        'screen__text',
      );
      box.dataset.style = node.style;
      box.append(buildText(node.pieces, { typed: false, animate: false }).fragment);
      return box;
    }
    case 'bar': {
      const box = el('div', 'screen__bar');
      const head = el('div', 'screen__bar-head');
      head.append(
        el('span', 'screen__bar-label', node.label),
        el('span', 'screen__bar-value', node.text),
      );
      const track = el('div', 'screen__bar-track');
      track.setAttribute('role', 'meter');
      track.setAttribute('aria-label', node.label);
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', String(node.max));
      track.setAttribute('aria-valuenow', String(node.value));
      const fill = el('div', 'screen__bar-fill');
      fill.style.setProperty('--fill', String(node.fill));
      track.append(fill);
      box.append(head, track);
      return box;
    }
    case 'icon':
      return iconElement(node.icon);
    case 'list': {
      if (!node.rows.length) return el('p', 'screen__empty', node.empty);
      const list = el('ul', 'screen__list');
      for (const row of node.rows) {
        const item = el('li', 'screen__row');
        if (row.status) item.dataset.status = row.status;
        item.append(el('span', 'screen__row-label', row.label));
        if (row.value !== undefined) item.append(el('span', 'screen__row-value', row.value));
        if (row.note) item.append(el('span', 'screen__row-note', row.note));
        list.append(item);
      }
      return list;
    }
    case 'button': {
      const button = el('button', 'screen__button', node.label) as HTMLButtonElement;
      button.type = 'button';
      button.dataset.testid = 'screen-button';
      button.addEventListener('click', () => options.onAction(node.actions));
      return button;
    }
    case 'tabs': {
      const box = el('div', 'screen__tabs');
      const current = options.tabs.get(node.id) ?? node.tabs[0]?.id;
      const bar = el('div', 'screen__tab-bar');
      bar.setAttribute('role', 'tablist');
      for (const tab of node.tabs) {
        const button = el('button', 'screen__tab', tab.label) as HTMLButtonElement;
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(tab.id === current));
        button.dataset.tab = tab.id;
        button.addEventListener('click', () => {
          options.tabs.set(node.id, tab.id);
          options.onTab();
        });
        bar.append(button);
      }
      const panel = el('div', 'screen__tab-panel');
      panel.setAttribute('role', 'tabpanel');
      const shown = node.tabs.find((tab) => tab.id === current);
      if (shown) panel.append(...renderNodes(shown.children, options));
      box.append(bar, panel);
      return box;
    }
  }
}

/** Builds view nodes into elements. */
export function renderNodes(
  nodes: readonly ViewNode[],
  options: RenderOptions,
): (HTMLElement | SVGSVGElement)[] {
  return nodes.map((node) => renderNode(node, options));
}
