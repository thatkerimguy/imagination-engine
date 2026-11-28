// audio-bed: 100% procedural ambience (no files) on the host's `bed` graph. One bed at a time:
// a new bed crossfades the previous out. Calm pill always shows; reduced/calm hard-stops all nodes.
import {
  propBool,
  propNumber,
  propText,
  type EngineAudioGraph,
  type EngineInstance,
  type GimmickEngine,
  type Unsubscribe,
} from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle, setText } from '../shared/dom-safe.ts';
import { rt } from '../shared/i18n-reader.ts';
import { isStill, mountFrame, variantOf } from '../shared/kit.ts';
import { iconFor } from './icons.ts';
import { buildBed, ramp, SCENE_IDS, SCENES, type BuiltBed } from './scenes.ts';
import { CSS } from './styles.ts';

const ID = 'audio-bed';
const PAUSE_MS = 250;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
let active: { release(ms: number): void } | null = null;

export const audioBedEngine: GimmickEngine = {
  id: ID,
  mount(host, blueprint, props, ctx): EngineInstance {
    injectEngineStyle(ID, CSS);
    const scene = variantOf(blueprint, props, 'scene', SCENE_IDS);
    const def = SCENES[scene];
    const label = propText(props, 'label', scene);
    const volume = clamp(propNumber(props, 'volume', 0.5), 0, 1);
    const fadeMs = clamp(propNumber(props, 'fadeMs', 4000), 500, 12000);
    const stopMode = propBool(props, 'stop');
    const secs = fadeMs / 1000;
    const { root, body } = mountFrame(host, blueprint, ctx, {
      layout: scene,
      surface: false,
      ornament: false,
      label: `${rt('ambientSound')}: ${label}`,
    });
    root.setAttribute('role', 'group');
    const text = el('span', { class: cls(ID, 'text') });
    const ico = el('span', { class: cls(ID, 'ico'), 'aria-hidden': 'true' }, iconFor(scene));
    body.append(el('span', { class: cls(ID, 'dot'), 'aria-hidden': 'true' }), ico, text);

    const show = (state: 'idle' | 'playing' | 'muted' | 'stopped'): void => {
      root.dataset.state = state;
      const tail =
        state === 'muted'
          ? rt('soundOff')
          : state === 'stopped' || stopMode
            ? rt('fadingOut')
            : `crossfade ${Number.isInteger(secs) ? secs : secs.toFixed(1)} s`;
      setText(text, `${label} · ${tail}`);
    };

    let graph: EngineAudioGraph | null = null;
    let bed: BuiltBed | null = null;
    let killTimer: Unsubscribe | null = null;
    let wanted = false;
    let destroyed = false;
    const me = {
      release(ms: number): void {
        if (!bed || !graph) return;
        ramp(graph.context, bed.level.gain, 0, ms);
        killTimer?.();
        killTimer = ctx.timeout(kill, ms + 80);
        show('stopped');
      },
    };
    function kill(): void {
      killTimer?.();
      killTimer = null;
      bed?.stop();
      bed = null;
      graph = null;
      if (active === me) active = null;
    }
    const target = (): number => volume * def.level * 0.6;
    const start = (): void => {
      if (destroyed || bed || isStill(ctx)) return;
      if (stopMode) {
        active?.release(fadeMs);
        active = null;
        show('stopped');
        return;
      }
      const g = ctx.audio.graph('bed');
      if (!g) return show('muted');
      active?.release(fadeMs);
      graph = g;
      bed = buildBed(g.context, g.out, def);
      ramp(g.context, bed.level.gain, target(), fadeMs);
      active = me;
      show('playing');
    };

    ctx.onPause(() => bed && graph && ramp(graph.context, bed.level.gain, 0, PAUSE_MS));
    ctx.onResume(() => {
      if (!bed || !graph) return;
      if (graph.closed) {
        kill();
        show('muted');
      } else ramp(graph.context, bed.level.gain, target(), PAUSE_MS);
    });
    ctx.onTierChange(() => {
      if (isStill(ctx)) {
        kill();
        show('muted');
      } else if (wanted && !ctx.paused) start();
      else show('idle');
    });
    ctx.signal.addEventListener('abort', kill, { once: true });
    show(isStill(ctx) ? 'muted' : 'idle');

    return {
      trigger(): Promise<void> {
        wanted = true;
        start();
        return Promise.resolve();
      },
      destroy(): void {
        if (destroyed) return;
        destroyed = true;
        kill();
        root.remove();
      },
    };
  },
};

export default audioBedEngine;
