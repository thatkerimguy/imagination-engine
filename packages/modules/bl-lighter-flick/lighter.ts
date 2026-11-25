// One lit flame: builds the overlay nodes for the tier and owns its loop, listeners and timers.
import type { AudioBusAccess, QualityTier } from '@kn/core/renderer';
import { clampDt, drawFlame, breeze, gammaToAngle, stepSway, type Sway } from './flame.ts';
import { playClack, playIgnite } from './sfx.ts';
import type { LighterProps } from './schema.ts';
import type { LiveFlame } from './controller.ts';

export const FADE_OUT_MS = 220;
const FADE_IN_DELAY_MS = 300;
const SVG = 'http://www.w3.org/2000/svg';
const FLAME_W = 60;
const FLAME_H = 110;

function emblem(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 60 110');
  svg.setAttribute('aria-hidden', 'true');
  const layers: [string, number, number, number][] = [
    ['#ff8a1e', 0.6, 24, 96],
    ['#ffc94a', 0.9, 16, 72],
    ['#dff0ff', 0.95, 7, 32],
  ];
  for (const [fill, opacity, hw, h] of layers) {
    const p = document.createElementNS(SVG, 'path');
    const b = 104;
    p.setAttribute(
      'd',
      `M30 ${b}C${30 - hw * 1.3} ${b - h * 0.1} ${30 - hw * 0.7} ${b - h * 0.6} 30 ${b - h}C${30 + hw * 0.7} ${b - h * 0.6} ${30 + hw * 1.3} ${b - h * 0.1} 30 ${b}Z`,
    );
    p.setAttribute('fill', fill);
    p.setAttribute('opacity', String(opacity));
    svg.append(p);
  }
  return svg;
}

export class Flame implements LiveFlame {
  private readonly root = document.createElement('div');
  private readonly glow = document.createElement('div');
  private readonly listeners = new AbortController();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private canvas: HTMLCanvasElement | null = null;
  private raf = 0;
  private sway: Sway = { angle: 0, velocity: 0 };
  private tilt: number | null = null;
  private time = 0;
  private last = 0;
  private stopSound: () => void = () => undefined;
  private fading: Promise<void> | null = null;
  private wake: (() => void) | null = null;
  private removed = false;

  constructor(
    private readonly overlay: HTMLElement,
    props: LighterProps,
    private readonly tier: QualityTier,
    private readonly audio: AudioBusAccess | null,
  ) {
    const { root, glow } = this;
    const left = props.corner === 'bottom-left';
    root.className = `kn-lighter kn-lighter--${tier === 'reduced' ? 'still' : tier}`;
    root.setAttribute('data-kn-lighter', 'lit');
    root.setAttribute('data-tier', tier);
    root.style.setProperty('--kn-warm', String(props.warmth));
    root.style.setProperty('--kn-lx', left ? '0%' : '100%');
    glow.className = 'kn-lighter-glow';
    const holder = document.createElement('div');
    holder.className = 'kn-lighter-flame';
    holder.style.setProperty(
      left ? 'left' : 'right',
      'calc(env(safe-area-inset-' + (left ? 'left' : 'right') + ',0px) + 14px)',
    );
    if (tier === 'high') {
      const canvas = document.createElement('canvas');
      this.canvas = canvas;
      holder.append(canvas);
    } else {
      holder.append(emblem());
    }
    root.append(glow, holder);
  }

  ignite(): void {
    this.overlay.append(this.root);
    if (this.audio) this.stopSound = playIgnite(this.audio);
    if (this.tier === 'reduced') return;
    this.later(FADE_IN_DELAY_MS, () => this.root.classList.add('kn-lighter--on'));
    if (this.tier === 'high' && this.canvas) this.startLoop(this.canvas);
  }

  extinguish(audio: AudioBusAccess | null): Promise<void> {
    if (this.removed) return Promise.resolve();
    if (this.fading) return this.fading;
    this.stopSound();
    if (audio) playClack(audio);
    this.root.setAttribute('data-kn-lighter', 'out');
    if (this.tier === 'reduced') {
      this.remove();
      return Promise.resolve();
    }
    this.fading = new Promise<void>((resolve) => {
      this.wake = resolve;
      this.later(FADE_OUT_MS, () => this.remove());
    });
    return this.fading;
  }

  remove(): void {
    if (this.removed) return;
    this.removed = true;
    cancelAnimationFrameSafe(this.raf);
    this.listeners.abort();
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.stopSound();
    this.root.remove();
    this.wake?.();
    this.wake = null;
  }

  private later(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  private startLoop(canvas: HTMLCanvasElement): void {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(FLAME_W * dpr);
    canvas.height = Math.round(FLAME_H * dpr);
    const g = canvas.getContext('2d');
    const DOE = globalThis.DeviceOrientationEvent as
      (typeof DeviceOrientationEvent & { requestPermission?: unknown }) | undefined;
    // iOS gates orientation behind a permission prompt we never show; the breeze covers it.
    if (DOE && typeof DOE.requestPermission !== 'function') {
      window.addEventListener(
        'deviceorientation',
        (e) => {
          const ev = e as DeviceOrientationEvent;
          if (typeof ev.gamma === 'number') this.tilt = gammaToAngle(ev.gamma);
        },
        { signal: this.listeners.signal },
      );
    }
    const frame = (now: number): void => {
      this.raf = requestAnimationFrame(frame);
      const dt = clampDt((now - this.last) / 1000);
      this.last = now;
      if (document.hidden) return;
      this.time += dt;
      const lean = breeze(this.time);
      const target = this.tilt === null ? lean : this.tilt + lean * 0.25;
      this.sway = stepSway(this.sway, target, dt);
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFlame(g, FLAME_W, FLAME_H, this.sway.angle, this.time, 1);
      this.glow.style.opacity = String(0.9 + 0.1 * Math.sin(this.time * 9));
    };
    this.last = performance.now();
    this.raf = requestAnimationFrame(frame);
  }
}

function cancelAnimationFrameSafe(id: number): void {
  if (id) cancelAnimationFrame(id);
}
