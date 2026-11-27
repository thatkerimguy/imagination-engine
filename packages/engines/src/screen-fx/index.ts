// screen-fx: a quiet inline marker plus, on trigger (high / lite only), a fixed pointer-events-none
// overlay made of CSS gradients that fades out on its own, on pause, on reduced and on destroy.
import {
  propNumber,
  propText,
  type EngineInstance,
  type GimmickEngine,
  type Unsubscribe,
} from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle } from '../shared/dom-safe.ts';
import { rt } from '../shared/i18n-reader.ts';
import { cue, isStill, mountFrame, variantOf } from '../shared/kit.ts';
import { CSS } from './styles.ts';

const ID = 'screen-fx';
const EFFECTS = [
  'frost-creep',
  'blood-pulse',
  'crt-scanlines',
  'spotlight',
  'sepia-flash',
  'rain-streaks',
] as const;
const NAMES: Record<(typeof EFFECTS)[number], string> = {
  'frost-creep': 'Frost creep',
  'blood-pulse': 'Blood pulse',
  'crt-scanlines': 'CRT scanlines',
  spotlight: 'Spotlight',
  'sepia-flash': 'Sepia fade',
  'rain-streaks': 'Rain streaks',
};
const INHERIT = ['--dna-accent', '--dna-accent-2', '--dna-warn', '--dna-ink', '--dna-bg'];
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export const screenFxEngine: GimmickEngine = {
  id: ID,
  mount(host, blueprint, props, ctx): EngineInstance {
    injectEngineStyle(ID, CSS);
    const effect = variantOf(blueprint, props, 'effect', EFFECTS);
    const intensity = clamp(propNumber(props, 'intensity', 0.4), 0.1, 0.85);
    const duration = clamp(propNumber(props, 'durationMs', 3000), 1500, 9000);
    const caption = propText(props, 'caption');
    const { root, body } = mountFrame(host, blueprint, ctx, {
      layout: effect,
      label: `${rt('visualEffect')}: ${NAMES[effect]}`,
    });

    const replay = el(
      'button',
      { type: 'button', class: cls(ID, 'replay'), 'aria-label': rt('replayEffect') },
      '↻',
    );
    body.append(
      el(
        'div',
        { class: cls(ID, 'row') },
        el('span', { class: cls(ID, 'name') }, NAMES[effect]),
        replay,
      ),
      el('p', { class: cls(ID, 'cap'), hidden: !caption }, caption),
    );
    const syncReplay = (): void => void (replay.hidden = isStill(ctx));
    syncReplay();

    let destroyed = false;
    let overlay: HTMLElement | null = null;
    let timers: Unsubscribe[] = [];
    let settle: (() => void) | null = null;
    const clear = (): void => {
      timers.forEach((u) => u());
      timers = [];
      overlay?.remove();
      overlay = null;
      root.dataset.state = 'idle';
      settle?.();
      settle = null;
    };
    const fire = (): void => {
      clear();
      const ov = el(
        'div',
        { class: cls(ID, 'ov'), 'data-fx': effect, 'data-tier': ctx.tier, 'aria-hidden': 'true' },
        el('div', { class: cls(ID, 'fx') }),
      );
      const cs = getComputedStyle(root);
      for (const name of INHERIT) {
        const v = cs.getPropertyValue(name);
        if (v) ov.style.setProperty(name, v);
      }
      ov.style.setProperty('--fx-i', String(intensity));
      ov.style.setProperty('--fx-dur', `${duration}ms`);
      document.body.append(ov);
      overlay = ov;
      root.dataset.state = 'playing';
      timers.push(ctx.timeout(clear, duration));
    };

    ctx.onTierChange((t) => {
      syncReplay();
      if (isStill(ctx)) clear();
      else if (overlay) overlay.dataset.tier = t;
    });
    ctx.onPause(clear);
    ctx.signal.addEventListener('abort', clear, { once: true });
    const play = (): Promise<void> => {
      if (destroyed || isStill(ctx) || ctx.paused) return Promise.resolve();
      cue(ctx, blueprint, props);
      fire();
      return new Promise<void>((resolve) => {
        settle = resolve;
        timers.push(ctx.timeout(() => ((settle = null), resolve()), Math.min(500, duration)));
      });
    };
    replay.addEventListener('click', () => void play(), { signal: ctx.signal });

    return {
      trigger: play,
      destroy(): void {
        if (destroyed) return;
        destroyed = true;
        clear();
        root.remove();
      },
    };
  },
};

export default screenFxEngine;
