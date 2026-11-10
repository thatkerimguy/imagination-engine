import type { StageBackground, StageLook } from '@ie/story';
import { AMBIENTS, TitleActor, type Rgb } from './actors.ts';
import { GlyphAtlas, BASE_CHARS } from './atlas.ts';
import { ScreenFx, type FxState } from './fx.ts';
import { PARTICLE_PRESETS, ParticleSystem, type ParticlePreset } from './particles.ts';
import { createPen, type StageLayer, type StagePen } from './layer.ts';
import { COVER, LOOKS, overlayUniforms, type Cover } from './looks.ts';
import { SpriteBatch } from './batch.ts';
import { Renderer, SHAPE } from './renderer.ts';
import { FrameGovernor, TIERS, type TierName } from './tiers.ts';

export interface StagePalette {
  readonly ink: Rgb;
  readonly accent: Rgb;
  readonly background: Rgb;
}

export interface StageOptions {
  /** A CSS font family the page has loaded, for titles and glyph particles. */
  readonly family: string;
  readonly tier: TierName;
  readonly reducedMotion?: boolean;
  /** Theme colours, read again on `refreshPalette()`. */
  readonly palette: () => StagePalette;
  /** Called each moving frame so the host can move DOM text with the camera. */
  readonly onFx?: (fx: FxState) => void;
  /** Where the current song's beat is, 0..1 (0 = on the beat), or null without music. */
  readonly beatPhase?: () => number | null;
}

export interface StageStats {
  readonly tier: TierName;
  readonly sprites: number;
  readonly particles: number;
  readonly drawCalls: number;
  /** CPU time of the last frame (update and draw), in ms. */
  readonly frameMs: number;
}

/**
 * The GPU stage over the reader (ADR 0015): glyph particles, titles, screen effects, looks and
 * transitions on one WebGL2 canvas. It renders only while something moves, and at half rate when
 * only an ambient background is moving, so reading a still page costs nothing.
 */
export class Stage {
  readonly atlas: GlyphAtlas;
  private readonly renderer: Renderer;
  private readonly fx: ScreenFx;
  private particles: ParticleSystem;
  private governor: FrameGovernor;
  private tierName: TierName;
  private readonly autoTier: TierName;
  private pinned = false;
  private readonly batch: SpriteBatch;
  private readonly pen: StagePen;
  private layer: StageLayer | null = null;
  private titles: TitleActor[] = [];
  private background: { preset: StageBackground; amount: number } = { preset: 'none', amount: 1 };
  private emitDebt = 0;
  private look: StageLook = 'none';
  private cover: Cover | null = null;
  /** Reused for each particle's colour, so drawing allocates nothing per frame. */
  private readonly tinted: [number, number, number] = [0, 0, 0];
  private palette: StagePalette;
  private frame = 0;
  private last = 0;
  private time = 0;
  private skip = false;
  private lost = false;
  private fxWasActive = false;
  private lastFrameMs = 0;
  private view = { w: 1, h: 1, dpr: 1 };
  private readonly observer: ResizeObserver;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly options: StageOptions,
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    if (!gl) throw new Error('WebGL2 is not available.');
    this.renderer = new Renderer(gl);
    this.tierName = options.tier;
    this.autoTier = options.tier;
    this.governor = new FrameGovernor(options.tier);
    this.fx = new ScreenFx({ reducedMotion: options.reducedMotion ?? false });
    this.particles = new ParticleSystem(TIERS[options.tier].maxParticles);
    this.palette = options.palette();
    this.atlas = new GlyphAtlas({ family: options.family, size: 48 });
    this.batch = new SpriteBatch(this.atlas);
    this.pen = createPen(
      this.batch,
      () => this.view,
      () => this.palette,
    );
    this.atlas.ensure(BASE_CHARS);
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }

  get tier(): TierName {
    return this.tierName;
  }

  /** Fixes the tier (the Studio's preview), or hands it back to the frame governor with null. */
  setTier(tier: TierName | null): void {
    this.pinned = tier !== null;
    const next = tier ?? this.autoTier;
    this.governor = new FrameGovernor(next);
    if (next !== this.tierName) this.applyTier(next);
  }

  setReducedMotion(on: boolean): void {
    this.fx.reducedMotion = on;
  }

  refreshPalette(): void {
    this.palette = this.options.palette();
    this.wake();
  }

  setBackground(preset: StageBackground, amount = 1): void {
    this.background = { preset, amount };
    if (preset === 'none') this.particles.clear();
    this.wake();
  }

  setLook(look: StageLook): void {
    this.look = look;
    this.wake();
  }

  shake(strength: number): void {
    this.fx.shake(strength);
    this.fx.zoomPunch(strength * 0.05);
    this.wake();
  }

  flash(color?: Rgb): boolean {
    const shown = this.fx.flash(color ?? [1, 1, 1]);
    this.wake();
    return shown;
  }

  hitStop(seconds: number): void {
    this.fx.hitStop(seconds);
    this.wake();
  }

  burst(preset: ParticlePreset, options: { glyphs?: string; color?: Rgb } = {}): void {
    const base = PARTICLE_PRESETS[preset];
    const spec = {
      ...base,
      ...(options.glyphs ? { glyphs: options.glyphs } : {}),
      color: options.color ?? base.color,
    };
    this.atlas.ensure(spec.glyphs);
    const reduced = this.fx.reducedMotion;
    const at =
      preset === 'sparks'
        ? { x: this.view.w / 2, y: this.view.h * 0.6 }
        : { x: this.view.w / 2, y: this.view.h * 0.42 };
    this.particles.emit(
      reduced ? { ...spec, speed: [10, 40], gravity: 0 } : spec,
      at,
      reduced ? Math.ceil(spec.count / 3) : spec.count,
    );
    this.wake();
  }

  title(
    text: string,
    options: { seconds?: number; exit?: 'fade' | 'shatter'; color?: Rgb } = {},
  ): void {
    for (const t of this.titles) t.leave(this.particles, this.fx.reducedMotion);
    if (text.trim())
      this.titles.push(
        new TitleActor(
          text,
          this.atlas,
          this.view,
          options.color ?? this.palette.ink,
          options.seconds ?? 3,
          options.exit ?? 'fade',
        ),
      );
    this.wake();
  }

  /** Covers the screen and uncovers it; `covered` runs at the midpoint, when nothing shows. */
  transition(kind: keyof typeof COVER, seconds = 1.2, covered?: () => void): void {
    const reduced = this.fx.reducedMotion;
    this.cover = {
      kind: reduced ? COVER.dissolve : COVER[kind],
      seconds,
      t: 0,
      color: this.palette.background,
      ...(covered ? { covered } : {}),
    };
    this.wake();
  }

  /** Drops moments in flight (titles, bursts, covers), keeping background and look. */
  /** Draws `layer` every frame until it is replaced, cleared or reports it is finished. */
  setLayer(layer: StageLayer | null): void {
    this.layer = layer;
    if (layer?.glyphs) this.atlas.ensure(layer.glyphs);
    this.wake();
  }

  clearMoments(): void {
    this.titles = [];
    this.cover = null;
    this.particles.clear();
    this.wake();
  }

  stats(): StageStats {
    return {
      tier: this.tierName,
      sprites: this.batch.count,
      particles: this.particles.count,
      drawCalls: this.renderer.drawCalls,
      frameMs: this.lastFrameMs,
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.observer.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.options.onFx?.(this.fx.update(0));
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(globalThis.devicePixelRatio || 1, TIERS[this.tierName].maxPixelRatio);
    this.view = { w: Math.max(1, rect.width), h: Math.max(1, rect.height), dpr };
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.wake();
  }

  private get moving(): boolean {
    return (
      this.particles.count > 0 ||
      this.titles.length > 0 ||
      this.cover !== null ||
      this.fx.active ||
      this.layer !== null
    );
  }

  private get ambient(): boolean {
    return this.background.preset !== 'none' || LOOKS[this.look].grain > 0;
  }

  /** Starts the frame loop if it isn't running. */
  private wake(): void {
    if (this.frame || this.lost) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number) => {
    this.frame = 0;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    // Ambient-only scenes draw every other frame: half the battery for drifting rain.
    const ambientOnly = !this.moving && this.ambient;
    this.skip = ambientOnly ? !this.skip : false;
    if (!this.skip) {
      this.last = now;
      const start = performance.now();
      this.step(dt);
      this.draw();
      this.lastFrameMs = performance.now() - start;
      const changed = this.pinned ? null : this.governor.frame(dt * 1000 * (ambientOnly ? 0.5 : 1));
      if (changed) this.applyTier(changed);
    }
    if (this.moving || this.ambient) this.frame = requestAnimationFrame(this.tick);
    else this.draw(); // one last clean frame
  };

  private applyTier(tier: TierName): void {
    this.tierName = tier;
    // A fresh pool at the new size; the few particles in flight are not worth carrying over.
    this.particles = new ParticleSystem(TIERS[tier].maxParticles);
    this.resize();
  }

  private step(dt: number): void {
    this.time += dt;
    const fx = this.fx.update(dt);
    if (this.fx.active || this.fxWasActive) this.options.onFx?.(fx);
    this.fxWasActive = this.fx.active;
    const storyDt = dt * fx.timeScale;
    const ambient = AMBIENTS[this.background.preset];
    if (ambient) {
      this.emitDebt +=
        ambient.rate * this.background.amount * storyDt * (this.fx.reducedMotion ? 0.4 : 1);
      const n = Math.floor(this.emitDebt);
      this.emitDebt -= n;
      if (n > 0) {
        const [ax, ay, aw, ah] = ambient.area;
        this.atlas.ensure(ambient.spec.glyphs);
        this.particles.emit(
          ambient.spec,
          { x: ax * this.view.w, y: ay * this.view.h, w: aw * this.view.w, h: ah * this.view.h },
          n,
        );
      }
    }
    this.particles.update(storyDt);
    for (const t of this.titles) t.update(storyDt, this.particles, this.fx.reducedMotion);
    this.titles = this.titles.filter((t) => !t.done);
    if (this.cover) {
      const c = this.cover;
      const before = c.t;
      c.t += dt / c.seconds;
      if (before < 0.5 && c.t >= 0.5) c.covered?.();
      if (c.t >= 1) this.cover = null;
    }
  }

  private draw(): void {
    if (this.lost) return;
    this.batch.count = 0;
    const p = this.particles;
    const ink = this.palette.ink;
    const tinted = this.tinted;
    for (let i = 0; i < p.count; i++) {
      tinted[0] = (p.r[i] ?? 1) * 0.5 + ink[0] * 0.5;
      tinted[1] = (p.g[i] ?? 1) * 0.5 + ink[1] * 0.5;
      tinted[2] = (p.b[i] ?? 1) * 0.5 + ink[2] * 0.5;
      this.batch.glyph(
        p.glyph[i] ?? '·',
        p.x[i] ?? 0,
        p.y[i] ?? 0,
        p.size[i] ?? 0,
        p.angle[i] ?? 0,
        tinted,
        (p.alpha[i] ?? 0) * 0.85,
      );
    }
    if (this.layer && !this.layer.draw(this.pen, this.time)) this.layer = null;
    const phase = this.options.beatPhase?.() ?? null;
    const pulse = phase === null || this.fx.reducedMotion ? 0 : (1 - phase) ** 3;
    const look = LOOKS[this.look];
    const glow = look.glow;
    for (const title of this.titles)
      title.each(this.fx.reducedMotion, pulse, (g, alpha, lift, scale) => {
        const { width, height } = this.atlas;
        this.batch.push(
          g.x,
          g.y + lift,
          g.hw * scale,
          g.hh * scale,
          0,
          g.glyph.x / width,
          g.glyph.y / height,
          (g.glyph.x + g.glyph.w) / width,
          (g.glyph.y + g.glyph.h) / height,
          title.color,
          alpha,
          SHAPE.glyph,
          0,
          glow,
        );
      });

    this.renderer.syncAtlas(this.atlas);
    this.renderer.begin(this.canvas.width, this.canvas.height);
    const fx = this.fx.update(0);
    const tier = TIERS[this.tierName];
    const rich = tier.richPost;
    this.renderer.sprites(
      this.batch.data,
      this.batch.count,
      this.view,
      { x: fx.offsetX, y: fx.offsetY, angle: fx.angle, zoom: fx.zoom },
      rich ? look.aberration : 0,
    );
    const overlay = overlayUniforms(this.look, fx, this.cover, this.palette.accent, rich);
    this.renderer.overlayPass(overlay, { w: this.canvas.width, h: this.canvas.height }, this.time);
  }

  private readonly onLost = (event: Event) => {
    event.preventDefault();
    this.lost = true;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  };

  private readonly onRestored = () => {
    this.lost = false;
    this.renderer.init();
    this.wake();
  };
}
