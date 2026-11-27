// audio-stinger: a short procedural foley hit (<= 0.9 s) on the host's `oneshot` graph, with an
// optional sonic-pulse hairline. Reduced / Calm Mode: a quiet static caption, no sound.
import {
  propNumber,
  propText,
  type EngineInstance,
  type GimmickEngine,
  type Unsubscribe,
} from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle } from '../shared/dom-safe.ts';
import { rt } from '../shared/i18n-reader.ts';
import { isStill, mountFrame, variantOf } from '../shared/kit.ts';
import { CSS } from './styles.ts';
import { FOLEYS, MAX_S, play, type Shot } from './synth.ts';

const ID = 'audio-stinger';
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export const audioStingerEngine: GimmickEngine = {
  id: ID,
  mount(host, blueprint, props, ctx): EngineInstance {
    injectEngineStyle(ID, CSS);
    const foley = variantOf(blueprint, props, 'foley', FOLEYS);
    const label = propText(props, 'label', foley);
    const gain = clamp(propNumber(props, 'gain', 0.6), 0, 1);
    const pitch = clamp(propNumber(props, 'pitchShift', 0), -12, 12);
    const { root, body } = mountFrame(host, blueprint, ctx, {
      layout: foley,
      surface: false,
      ornament: false,
      label: `${rt('soundCue')}: ${label}`,
    });
    root.setAttribute('role', 'group');
    body.append(
      el(
        'div',
        { class: cls(ID, 'cap') },
        el('span', { class: cls(ID, 'ico'), 'aria-hidden': 'true' }, '♪'),
        el('span', {}, label),
      ),
      el('div', { class: cls(ID, 'hair'), 'aria-hidden': 'true' }, el('i')),
    );

    let destroyed = false;
    let shots: Shot[] = [];
    let timer: Unsubscribe | null = null;
    let settle: (() => void) | null = null;
    const end = (): void => {
      timer?.();
      timer = null;
      root.classList.remove('is-pulse');
      root.dataset.state = 'idle';
      settle?.();
      settle = null;
    };
    const silence = (): void => {
      shots.forEach((s) => s.sweep());
      shots = [];
      end();
    };
    ctx.onTierChange(() => isStill(ctx) && silence());
    ctx.onPause(silence);
    ctx.signal.addEventListener('abort', silence, { once: true });

    return {
      trigger(): Promise<void> {
        if (destroyed || isStill(ctx) || !ctx.audio.enabled || ctx.paused) return Promise.resolve();
        silence();
        const g = ctx.audio.graph('oneshot');
        if (g) shots.push(play(g.context, g.out, foley, gain, pitch));
        if (ctx.tier !== 'reduced') {
          root.classList.add('is-pulse');
          root.dataset.state = 'playing';
        }
        return new Promise<void>((resolve) => {
          settle = resolve;
          timer = ctx.timeout(() => {
            shots = [];
            end();
          }, MAX_S * 1000);
        });
      },
      destroy(): void {
        if (destroyed) return;
        destroyed = true;
        silence();
        root.remove();
      },
    };
  },
};

export default audioStingerEngine;
