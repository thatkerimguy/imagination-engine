// Tier orchestration for the Zippo. Ignition happens in trigger(), never mount(): mount runs
// early, while the block is merely near the viewport.
import type { ModuleRenderer, RendererContext } from '@kn/core/renderer';
import { extinguishActive, extinguishFlame, register, unregister } from './controller.ts';
import { Flame } from './lighter.ts';
import { retainStyles } from './styles.ts';
import type { LighterProps } from './schema.ts';

const IGNITE_MS = 750;
const REDUCED_IGNITE_MS = 150;

/** Resolves when the reader taps the cue button, or when the signal aborts. */
function waitForFlick(host: HTMLElement, signal: AbortSignal): Promise<HTMLElement> {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kn-lighter-cue';
  button.textContent = '🔥 Flick lighter';
  host.append(button);
  return new Promise((resolve) => {
    const done = (): void => {
      button.remove();
      resolve(button);
    };
    button.addEventListener('click', done, { once: true, signal });
    signal.addEventListener('abort', done, { once: true });
  });
}

export default function createRenderer(): ModuleRenderer<LighterProps> {
  let ctx: RendererContext<LighterProps> | null = null;
  let releaseStyles: (() => void) | null = null;
  let flame: Flame | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const wakers = new Set<() => void>();

  const begin = (c: RendererContext<LighterProps>): void => {
    ctx = c;
    releaseStyles = retainStyles();
  };

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const wake = (): void => {
        clearTimeout(id);
        timers.delete(id);
        wakers.delete(wake);
        resolve();
      };
      const id = setTimeout(wake, ms);
      timers.add(id);
      wakers.add(wake);
    });

  return {
    mount: begin,
    reducedMotionFallback: begin,
    async trigger() {
      const c = ctx;
      if (!c) return;
      const audio = c.props.sfx ? c.audio : null;
      if (c.props.action === 'extinguish') return extinguishActive(audio);
      if (c.props.trigger === 'tap') await waitForFlick(c.host, c.signal);
      if (c.signal.aborted || ctx !== c) return;
      flame?.remove();
      const lit = new Flame(c.stage.overlay, c.props, c.tier, audio);
      flame = lit;
      register(lit);
      lit.ignite();
      if (c.props.autoExtinguishMs > 0) {
        const id = setTimeout(() => {
          timers.delete(id);
          void extinguishFlame(lit, audio);
        }, c.props.autoExtinguishMs);
        timers.add(id);
      }
      await sleep(c.tier === 'reduced' ? REDUCED_IGNITE_MS : IGNITE_MS);
    },
    dispose() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const wake of [...wakers]) wake();
      wakers.clear();
      if (flame) {
        unregister(flame);
        flame.remove();
        flame = null;
      }
      ctx?.host.replaceChildren();
      releaseStyles?.();
      releaseStyles = null;
      ctx = null;
    },
  };
}
