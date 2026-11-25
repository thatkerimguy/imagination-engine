// Lite tier: a crisp 2D canvas throw for older phones. No three.js, no physics engine: a tiny
// kinematic tumble with wall bounces that snaps to the target faces once the dice slow down.
// Scripted values are fixed before the throw, so the landed faces are always the Author's.
import type { AudioBusAccess } from '@kn/core/renderer';
import { PIPS, mulberry32, pickOutcome } from './faces.ts';
import { FINISHES } from './palette.ts';
import { FADE_SECONDS, fadeProgress, holdOrTap } from './handoff.ts';
import { createPauseGate } from './pause-gate.ts';
import { scheduleClatter } from './sfx.ts';
import type { DiceProps } from './schema.ts';

interface Die2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  roll: number;
  face: number;
  flipIn: number;
  settled: boolean;
}

const STEP = 1 / 60;

export class LiteDice {
  private readonly canvas = document.createElement('canvas');
  private readonly g: CanvasRenderingContext2D;
  private raf = 0;
  private disposed = false;
  private finish: (() => void) | null = null;

  constructor(
    private readonly overlay: HTMLElement,
    private readonly props: DiceProps,
    private readonly audio: AudioBusAccess,
  ) {
    this.canvas.className = 'kn-dice-lite';
    this.g = this.canvas.getContext('2d')!;
    overlay.append(this.canvas);
  }

  /** Same lifecycle as the high tier: roll → hold (tap skips) → cross-fade → resolve. */
  play(signal: AbortSignal, onHandoff: (values: number[]) => void): Promise<void> {
    const { props } = this;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.overlay.clientWidth || window.innerWidth;
    const h = this.overlay.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const size = Math.max(44, Math.min(84, Math.min(w, h) * 0.14));
    const rand = mulberry32(Math.floor(Math.random() * 1e9));
    const values =
      props.outcomeMode === 'scripted'
        ? pickOutcome('scripted', props.scriptedNumbers, props.count)
        : pickOutcome('random', [], props.count, rand);
    const dice: Die2D[] = values.map((_, i) => this.spawn(i, w, h, size, rand));
    const margin = size * 0.6 + 12;
    let t = 0;
    let acc = 0;
    let last = performance.now();
    let phase: 'roll' | 'hold' | 'fade' = 'roll';
    let fadeStart = 0;

    return new Promise<void>((resolve) => {
      this.finish = resolve;
      const gate = createPauseGate(signal, (paused) => {
        if (paused || this.disposed || this.raf) return;
        last = performance.now();
        this.raf = requestAnimationFrame(frame);
      });
      const frame = (now: number): void => {
        if (this.disposed) return;
        if (gate.paused) {
          this.raf = 0;
          return;
        }
        acc += Math.min(0.05, (now - last) / 1000);
        last = now;
        while (acc >= STEP) {
          acc -= STEP;
          t += STEP;
          for (const [i, d] of dice.entries()) this.stepDie(d, values[i]!, w, h, margin, rand);
        }
        if (phase === 'roll' && dice.every((d) => d.settled)) {
          phase = 'hold';
          void holdOrTap(props.holdSeconds, signal).then(() => {
            if (this.disposed) return;
            phase = 'fade';
            fadeStart = t;
            onHandoff(values);
          });
        }
        const k = phase === 'fade' ? fadeProgress(t, fadeStart) : 0;
        this.draw(dice, size, w, h, 1 - k);
        if (phase === 'fade' && t - fadeStart >= FADE_SECONDS) this.dispose();
        else this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  private spawn(i: number, w: number, h: number, size: number, rand: () => number): Die2D {
    const from = this.props.throwFrom;
    const spread = (i - (this.props.count - 1) / 2) * size * 1.4;
    const speed = Math.max(w, h) * (1.5 + rand() * 0.5);
    const base = {
      angle: rand() * 6.28,
      spin: (rand() - 0.5) * 24,
      roll: 0,
      face: 1,
      flipIn: 0,
      settled: false,
    };
    if (from === 'bottom')
      return { ...base, x: w / 2 + spread, y: h + size, vx: (rand() - 0.5) * 200, vy: -speed };
    const dir = from === 'left' ? 1 : -1;
    return {
      ...base,
      x: from === 'left' ? -size : w + size,
      y: h * 0.45 + spread,
      vx: dir * speed,
      vy: (rand() - 0.5) * 300,
    };
  }

  private stepDie(
    d: Die2D,
    target: number,
    w: number,
    h: number,
    m: number,
    rand: () => number,
  ): void {
    if (d.settled) return;
    d.x += d.vx * STEP;
    d.y += d.vy * STEP;
    d.angle += d.spin * STEP;
    const speed = Math.hypot(d.vx, d.vy);
    d.roll += speed * STEP * 0.035;
    const drag = Math.pow(0.18, STEP);
    d.vx *= drag;
    d.vy *= drag;
    d.spin *= drag;
    let hit = false;
    if ((d.x < m && d.vx < 0) || (d.x > w - m && d.vx > 0)) {
      d.vx *= -0.62;
      hit = true;
    }
    if ((d.y < m && d.vy < 0) || (d.y > h - m && d.vy > 0)) {
      d.vy *= -0.62;
      hit = true;
    }
    if (hit && this.props.sound) {
      const strength = Math.min(1, speed / (Math.max(w, h) * 1.6));
      scheduleClatter(
        this.audio,
        [{ time: 0, die: 0, x: (d.x / w) * 2 - 1, strength }],
        this.props.material,
      );
    }
    d.flipIn -= STEP;
    if (d.flipIn <= 0 && speed > 120) {
      d.face = 1 + Math.floor(rand() * 6);
      d.flipIn = 0.07 + rand() * 0.05;
    }
    if (speed < 120) {
      d.face = target;
      d.angle += (Math.round(d.angle / (Math.PI / 2)) * (Math.PI / 2) + 0.08 - d.angle) * 0.15;
      d.roll = 0;
    }
    if (speed < 18) d.settled = true;
  }

  private draw(dice: readonly Die2D[], size: number, w: number, h: number, alpha: number): void {
    const g = this.g;
    const f = FINISHES[this.props.material];
    g.clearRect(0, 0, w, h);
    g.globalAlpha = alpha;
    for (const d of dice) {
      const squash = 0.55 + 0.45 * Math.abs(Math.cos(d.roll));
      g.save();
      g.translate(d.x + size * 0.08, d.y + size * 0.12);
      g.rotate(d.angle);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      roundRect(g, -size / 2, -size / 2, size, size * squash, size * 0.18);
      g.fill();
      g.restore();
      g.save();
      g.translate(d.x, d.y);
      g.rotate(d.angle);
      g.scale(1, squash);
      g.fillStyle = f.body;
      roundRect(g, -size / 2, -size / 2, size, size, size * 0.18);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = f.pip;
      for (const [px, py] of PIPS[d.face]!) {
        g.beginPath();
        g.arc(
          px * size * 0.29,
          py * size * 0.29,
          size * (d.face === 1 ? 0.11 : 0.085),
          0,
          Math.PI * 2,
        );
        g.fill();
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.width = this.canvas.height = 0;
    this.canvas.remove();
    this.finish?.();
    this.finish = null;
  }
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
