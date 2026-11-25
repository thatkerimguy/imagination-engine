import type { ModuleRenderer, RendererContext } from '@kn/core/renderer';
import type { GhostWhisperProps } from './schema.ts';
import { retainStyles } from './styles.ts';
import { playWhisper } from './chime.ts';
import {
  initialReveal,
  initialTilt,
  isRevealed,
  reduceReveal,
  stepTilt,
  type RevealEvent,
} from './whisper-state.ts';

interface OrientationCtor {
  requestPermission?: unknown;
}

/** Tilt is used only where it needs no permission prompt (never request one). */
function tiltAvailable(): boolean {
  const ctor = (window as unknown as { DeviceOrientationEvent?: OrientationCtor })
    .DeviceOrientationEvent;
  return !!ctor && typeof ctor.requestPermission !== 'function';
}

export default function createRenderer(): ModuleRenderer<GhostWhisperProps> {
  let root: HTMLElement | null = null;
  let releaseStyles: (() => void) | null = null;
  let own: AbortController | null = null;
  const timers = new Set<number>();
  const stops = new Set<() => void>();

  const build = (ctx: RendererContext<GhostWhisperProps>): void => {
    releaseStyles = retainStyles();
    own = new AbortController();
    const { props: p, tier } = ctx;
    const ac = own;
    const opts = { signal: ac.signal };
    if (ctx.signal.aborted) ac.abort();
    else ctx.signal.addEventListener('abort', () => ac.abort(), opts);
    const el = document.createElement('div');
    el.className = `kn-gw kn-gw--${p.accent} kn-gw--${tier}`;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-pressed', 'false');
    el.setAttribute('aria-label', `${p.surfaceLine}. Hidden line: ${p.ghostLine}`);
    el.setAttribute('aria-description', 'Activate to reveal the hidden line');
    el.dataset.knRevealed = 'false';
    const surface = document.createElement('p');
    surface.className = 's';
    surface.textContent = p.surfaceLine;
    const ghost = document.createElement('p');
    ghost.className = 'g';
    ghost.textContent = p.ghostLine;
    surface.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('aria-hidden', 'true');
    el.append(surface, ghost);
    ctx.host.append(el);
    root = el;

    let state = initialReveal();
    let tilt = initialTilt();
    const send = (e: RevealEvent): void => {
      const was = isRevealed(state);
      state = reduceReveal(state, e);
      const now = isRevealed(state);
      if (now === was) return;
      el.dataset.knRevealed = String(now);
      el.setAttribute('aria-pressed', String(now));
      if (now && tier === 'high' && p.audioCue) {
        const stop = playWhisper(ctx.audio);
        if (stop) {
          stops.add(stop);
          const t = window.setTimeout(() => {
            timers.delete(t);
            if (stops.delete(stop)) stop();
          }, 1500);
          timers.add(t);
        }
      }
    };

    el.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
    if (tier === 'reduced') {
      el.addEventListener('click', () => send({ type: 'toggle' }), opts);
    } else {
      const press = (on: boolean) => (): void => send({ type: 'hold', on });
      el.addEventListener('pointerdown', press(true), opts);
      for (const name of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
        el.addEventListener(name, press(false), opts);
      }
    }
    el.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.key === ' ') e.preventDefault();
        send({ type: 'toggle' });
      },
      opts,
    );

    if (p.revealMode === 'hold-or-tilt' && tier !== 'reduced' && tiltAvailable()) {
      window.addEventListener(
        'deviceorientation',
        (e: DeviceOrientationEvent) => {
          if (e.beta === null || e.gamma === null) return;
          tilt = stepTilt(tilt, e.beta, e.gamma, p.tiltThresholdDeg);
          send({ type: 'tilt', on: tilt.active });
        },
        { ...opts, passive: true },
      );
    }
  };

  return {
    mount: build,
    reducedMotionFallback: build,
    async trigger() {
      // The whisper is user-driven; never block reading pacing.
    },
    dispose() {
      own?.abort();
      own = null;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      for (const stop of stops) stop();
      stops.clear();
      root?.remove();
      root = null;
      releaseStyles?.();
      releaseStyles = null;
    },
  };
}
