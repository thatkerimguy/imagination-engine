// kinetic-prose: ordinary prose with one restrained motion effect. Reads as the page, not a card.
// The animated layer is aria-hidden; screen readers get the full text once via an sr-only copy.
import {
  propBool,
  propText,
  type EngineInstance,
  type GimmickEngine,
  type Unsubscribe,
} from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle, srOnly } from '../shared/dom-safe.ts';
import { cue, isStill, mountFrame, stagger, variantOf } from '../shared/kit.ts';
import { CSS } from './styles.ts';

const ID = 'kinetic-prose';
const EFFECTS = ['shiver', 'drop-cap', 'typewriter', 'echo', 'sink', 'pulse'] as const;
type Effect = (typeof EFFECTS)[number];

interface Layer {
  layer: HTMLElement;
  words: HTMLElement[];
  chars: HTMLElement[];
}

/** Word (and, for typewriter, char) spans built purely from text nodes / textContent. */
function buildLayer(text: string, effect: Effect, emph: string): Layer {
  const layer = el('p', { class: cls(ID, 'layer') });
  const words: HTMLElement[] = [];
  const chars: HTMLElement[] = [];
  let capDone = false;
  const addWords = (seg: string, parent: HTMLElement): void => {
    for (const part of seg.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        parent.append(part);
        continue;
      }
      const w = el('span', { class: cls(ID, 'w') });
      w.style.setProperty('--i', String(words.length));
      const glyphs = Array.from(part);
      if (effect === 'drop-cap' && !capDone) {
        capDone = true;
        w.append(el('span', { class: cls(ID, 'cap') }, glyphs.shift() ?? ''), glyphs.join(''));
      } else if (effect === 'typewriter') {
        for (const g of glyphs) {
          const c = el('span', { class: cls(ID, 'c') }, g);
          chars.push(c);
          w.append(c);
        }
      } else w.append(part);
      words.push(w);
      parent.append(w);
    }
  };
  const at = emph ? text.toLowerCase().indexOf(emph.toLowerCase()) : -1;
  const ok = at >= 0 && text.slice(at, at + emph.length).toLowerCase() === emph.toLowerCase();
  if (!ok) {
    addWords(text, layer);
    return { layer, words, chars };
  }
  addWords(text.slice(0, at), layer);
  const em = el('span', { class: `${cls(ID, 'em')} ${cls(ID, 'pt')}` });
  addWords(text.slice(at, at + emph.length), em);
  layer.append(em);
  addWords(text.slice(at + emph.length), layer);
  return { layer, words, chars };
}

export const kineticProseEngine: GimmickEngine = {
  id: ID,
  mount(host, blueprint, props, ctx): EngineInstance {
    injectEngineStyle(ID, CSS);
    const effect = variantOf(blueprint, props, 'effect', EFFECTS);
    const text = propText(props, 'text');
    const emph = propText(props, 'emphasisWord').trim();
    const { root, body } = mountFrame(host, blueprint, ctx, {
      surface: false,
      ornament: false,
      layout: effect,
      label: text,
    });
    const main = buildLayer(text, effect, emph);
    main.layer.setAttribute('aria-hidden', 'true');
    if (effect === 'pulse' && !emph) main.layer.classList.add(cls(ID, 'pt'));
    body.append(srOnly(text), main.layer);
    if (effect === 'echo') {
      const ghost = buildLayer(text, effect, emph).layer;
      ghost.classList.add(cls(ID, 'ghost'));
      ghost.setAttribute('aria-hidden', 'true');
      body.append(ghost);
    }
    const step = Math.min(60, 900 / Math.max(1, main.words.length));
    if (effect === 'sink') {
      main.words.forEach((w, i) => w.style.setProperty('--d', `${stagger(ctx, i, step)}ms`));
    }

    let destroyed = false;
    let stop: Unsubscribe | null = null;
    let run: Promise<void> | null = null;
    let settle: (() => void) | null = null;
    const finish = (): void => {
      stop?.();
      stop = null;
      root.classList.remove('is-typing');
      main.chars.forEach((c) => c.classList.add('on'));
      root.dataset.state = 'done';
      settle?.();
      settle = null;
    };
    const keySound = (): void => {
      const s = blueprint.sound;
      if (!s || !propBool(props, 'sound', true) || isStill(ctx)) return;
      ctx.audio.stinger(s.patch, { gain: s.gain, pitchShift: s.pitchShift });
    };
    const type = (): void => {
      const n = main.chars.length;
      if (n === 0) return finish();
      const per = Math.min(28 / ctx.dna.motion.tempo, 2400 / n);
      const tickMs = Math.max(16, Math.round(per));
      const batch = Math.max(1, Math.round(tickMs / per));
      let i = 0;
      let ticks = 0;
      keySound();
      stop = ctx.interval(() => {
        for (let k = 0; k < batch && i < n; k++) main.chars[i++]?.classList.add('on');
        if (++ticks % 6 === 0) keySound();
        if (i >= n) finish();
      }, tickMs);
    };
    const settleMs = (): number => {
      const t = ctx.dna.motion.tempo;
      if (effect === 'sink') return stagger(ctx, main.words.length, step) + 520;
      return (effect === 'echo' ? 900 : 600) / t;
    };
    const begin = (): void => {
      root.dataset.state = 'playing';
      if (effect === 'typewriter' && ctx.tier === 'high') return type();
      cue(ctx, blueprint, props);
      stop = ctx.timeout(finish, settleMs());
    };

    ctx.onPause(() => (root.dataset.paused = 'true'));
    ctx.onResume(() => delete root.dataset.paused);
    ctx.onTierChange(() => {
      if (isStill(ctx)) finish();
    });
    ctx.signal.addEventListener('abort', () => settle?.(), { once: true });
    if (isStill(ctx)) finish();
    else if (effect === 'typewriter' && ctx.tier === 'high') root.classList.add('is-typing');

    return {
      trigger(): Promise<void> {
        if (destroyed || isStill(ctx)) {
          if (!destroyed) finish();
          return Promise.resolve();
        }
        run ??= new Promise<void>((resolve) => {
          settle = resolve;
          begin();
        });
        return run;
      },
      destroy(): void {
        if (destroyed) return;
        destroyed = true;
        stop?.();
        stop = null;
        settle?.();
        settle = null;
        root.remove();
      },
    };
  },
};

export default kineticProseEngine;
