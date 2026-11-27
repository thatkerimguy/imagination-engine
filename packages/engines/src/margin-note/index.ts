// margin-note: an inline underlined anchor that opens a DNA-styled callout (footnote, lore card,
// scratch-out, POV whisper). Native buttons give Enter / Space; Escape closes and refocuses.
import {
  propText,
  type EngineInstance,
  type GimmickEngine,
  type Unsubscribe,
} from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle } from '../shared/dom-safe.ts';
import { rt } from '../shared/i18n-reader.ts';
import { cue, isStill, mountFrame, variantOf } from '../shared/kit.ts';
import { CSS } from './styles.ts';

const ID = 'margin-note';
const STYLES = ['footnote', 'lore-card', 'scratch-out', 'pov-whisper'] as const;
const NUDGE_MS = 600;
let seq = 0;

export const marginNoteEngine: GimmickEngine = {
  id: ID,
  mount(host, blueprint, props, ctx): EngineInstance {
    injectEngineStyle(ID, CSS);
    const style = variantOf(blueprint, props, 'style', STYLES);
    const anchorText = propText(props, 'anchorText', 'note');
    const title = propText(props, 'noteTitle');
    const author = propText(props, 'authorLabel');
    const { root, body } = mountFrame(host, blueprint, ctx, {
      layout: style,
      surface: false,
      ornament: false,
    });

    const id = `kn-mn-${++seq}`;
    const anchor = el(
      'button',
      {
        type: 'button',
        class: cls(ID, 'anchor'),
        'aria-expanded': 'false',
        'aria-controls': id,
        title: rt('openNote'),
      },
      anchorText,
    );
    const close = el(
      'button',
      { type: 'button', class: cls(ID, 'close'), 'aria-label': rt('closeNote') },
      '×',
    );
    const callout = el(
      'div',
      {
        id,
        class: cls(ID, 'callout'),
        role: 'region',
        'aria-label': title || anchorText,
        hidden: true,
      },
      el('strong', { class: cls(ID, 'title') }, title),
      el('p', { class: cls(ID, 'text') }, propText(props, 'noteBody')),
      author ? el('small', { class: cls(ID, 'by') }, `— ${author}`) : null,
      close,
    );
    body.append(el('p', { class: cls(ID, 'line') }, anchor), callout);

    const setOpen = (open: boolean, refocus = false): void => {
      callout.hidden = !open;
      anchor.setAttribute('aria-expanded', String(open));
      root.dataset.state = open ? 'open' : 'idle';
      if (open) cue(ctx, blueprint, props);
      else if (refocus) anchor.focus();
    };
    const { signal } = ctx;
    anchor.addEventListener('click', () => setOpen(callout.hasAttribute('hidden')), { signal });
    close.addEventListener('click', () => setOpen(false, true), { signal });
    root.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape' || callout.hasAttribute('hidden')) return;
        e.preventDefault();
        setOpen(false, true);
      },
      { signal },
    );

    let destroyed = false;
    let settle: (() => void) | null = null;
    let stopNudge: Unsubscribe | null = null;
    const endNudge = (): void => {
      stopNudge?.();
      stopNudge = null;
      root.classList.remove('is-nudge');
      settle?.();
      settle = null;
    };
    ctx.onTierChange(() => isStill(ctx) && endNudge());
    ctx.onPause(() => root.setAttribute('data-paused', ''));
    ctx.onResume(() => root.removeAttribute('data-paused'));
    signal.addEventListener('abort', endNudge, { once: true });

    return {
      trigger(): Promise<void> {
        if (
          destroyed ||
          settle ||
          ctx.tier !== 'high' ||
          ctx.calm ||
          !callout.hasAttribute('hidden')
        ) {
          return Promise.resolve();
        }
        root.classList.add('is-nudge');
        return new Promise<void>((resolve) => {
          settle = resolve;
          stopNudge = ctx.timeout(endNudge, NUDGE_MS);
        });
      },
      destroy(): void {
        if (destroyed) return;
        destroyed = true;
        endNudge();
        root.remove();
      },
    };
  },
};

export default marginNoteEngine;
