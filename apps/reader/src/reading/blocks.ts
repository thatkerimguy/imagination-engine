import type { Block } from '@kn/core/guard';
import { h } from '../dom.ts';
import { renderInline } from './inline.ts';

function rich<E extends HTMLElement>(el: E, text: string): E {
  renderInline(el, text);
  return el;
}

/** DOM for the core text blocks. Module blocks get an empty slot their renderer fills. */
export function renderBlock(block: Block): HTMLElement {
  const base = { id: `b-${block.id}`, 'data-block': block.id, 'data-kind': block.kind };
  switch (block.kind) {
    case 'prose':
      return rich(
        h('p', { ...base, class: `kn-block kn-prose kn-prose--${block.style ?? 'body'}` }),
        block.text,
      );
    case 'dialogue': {
      const el = h(
        'div',
        { ...base, class: 'kn-block kn-dialogue' },
        h('span', { class: 'kn-speaker' }, block.speaker),
        rich(h('p', { class: 'kn-line' }), block.text),
      );
      if (block.accentColor) el.style.setProperty('--speaker', block.accentColor);
      return el;
    }
    case 'scene-break':
      return h(
        'div',
        { ...base, class: 'kn-block kn-break', role: 'separator' },
        h('span', { class: 'kn-break-mark', 'aria-hidden': 'true' }, '◇'),
        block.label ? h('span', { class: 'kn-break-label' }, block.label) : null,
        block.timestamp ? h('span', { class: 'kn-break-time' }, block.timestamp) : null,
      );
    case 'module':
      return h('div', { ...base, class: 'kn-block kn-module', 'data-module': block.moduleId });
  }
}
