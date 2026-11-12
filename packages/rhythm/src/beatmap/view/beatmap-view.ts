import type { AudioEngine } from '@ie/audio';
import { createTranslator, type Locale } from '@ie/i18n';
import { pickLabel, type BeatmapDef, type RhythmResult } from '@ie/story';
import { EXCLUSIVE, MODS, playRules, type Mod, type PlayRules } from '../rules.ts';
import { BeatmapSession, type PlayEvent, type PlayResult } from '../session.ts';
import { BeatmapHud, type BeatmapText } from './beatmap-hud.ts';
import { BeatmapInput, type InputKey } from './beatmap-input.ts';
import { pauseCard, resultCard, startCard, type RhythmPrefs } from './beatmap-menus.ts';
import { FieldPainter, type DrawState } from './field-draw.ts';
import { fitField, readPalette, sizeCanvas, toField, type FieldLayout } from './field-layout.ts';
import { FieldOverlay } from './field-overlay.ts';
import { HitSounds } from './hit-sounds.ts';
import { beatmapMessages } from './messages.ts';
import { SongClock, type SongSource } from './song-clock.ts';

export interface BeatmapViewOptions {
  readonly host: HTMLElement;
  /** Covers `host` instead of the viewport (the Studio's Play view and editor). */
  readonly contained?: boolean;
  readonly beatmap: BeatmapDef;
  readonly song: SongSource;
  readonly engine: AudioEngine;
  readonly locale: Locale;
  readonly prefs: RhythmPrefs;
  readonly savePrefs: (prefs: RhythmPrefs) => void;
  /** Accuracy needed to win, 0–100. */
  readonly pass?: number;
  /** Plays from this song time (the editor's test play), skipping earlier notes. */
  readonly startAt?: number;
  /** Starts at once instead of showing the start card. */
  readonly autostart?: boolean;
  /** A test play: the results close instead of continuing a story. */
  readonly test?: boolean;
  /** The Studio's Play: any change settles the block, so the author can try both branches. */
  readonly author?: boolean;
  readonly haptics?: boolean;
  /** Changes always on, whatever the reader picks (the app's help setting). */
  readonly forceMods?: readonly Mod[];
  /** The reader is done: the result, or null when a test play was closed. */
  readonly onDone: (result: RhythmResult | null) => void;
}

type Phase = 'ready' | 'playing' | 'paused' | 'over';

const HUD_TOP = 56;
const HUD_BOTTOM = 40;

/**
 * A beatmap on screen (ADR 0033): the start card with its changes and settings, then the field
 * drawn from the song clock every frame, then the results. Pauses when the page is hidden.
 */
export class BeatmapView {
  private readonly text: BeatmapText;
  private readonly hud: BeatmapHud;
  private readonly input: BeatmapInput;
  private readonly painter: FieldPainter;
  private readonly overlay: FieldOverlay;
  private readonly sounds: HitSounds;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly name: string;
  private readonly resize: ResizeObserver;
  private readonly onVisibility = () => {
    if (document.hidden && this.phase === 'playing') this.pause();
  };
  private layout: FieldLayout;
  private prefs: RhythmPrefs;
  private clock: SongClock | null = null;
  private session: BeatmapSession | null = null;
  private rules: PlayRules;
  private phase: Phase = 'ready';
  private frame = 0;
  private mouseAim = false;
  private finishedAt = 0;
  private closed = false;

  constructor(private readonly options: BeatmapViewOptions) {
    this.text = createTranslator(beatmapMessages, options.locale);
    this.prefs = options.prefs;
    this.name = pickLabel(options.beatmap.name, options.locale, options.beatmap.id);
    this.rules = playRules(options.beatmap.difficulty, this.mods());
    this.hud = new BeatmapHud(options.host, this.text, {
      ...(options.contained ? { contained: true } : {}),
      onPause: () => this.togglePause(),
      onSkip: () => this.skip(),
    });
    this.hud.setDim(this.prefs.dim);
    const ctx = this.hud.canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D canvas.');
    this.ctx = ctx;
    const palette = readPalette(this.hud.root);
    this.painter = new FieldPainter(ctx, palette);
    this.overlay = new FieldOverlay(ctx, palette);
    this.sounds = new HitSounds(options.engine);
    this.layout = this.measure();
    this.input = new BeatmapInput({
      target: this.hud.canvas,
      toField: (cx, cy) => {
        const box = this.hud.canvas.getBoundingClientRect();
        return toField(this.layout, cx - box.left, cy - box.top);
      },
      live: () => this.phase === 'playing',
      press: (key, stamp, x, y) => this.press(key, stamp, x, y),
      release: (key) => {
        this.hud.key(key, false);
        this.session?.release();
      },
      move: (x, y, mouse) => {
        this.mouseAim = mouse;
        this.session?.move(x, y);
      },
      action: (action) => (action === 'pause' ? this.togglePause() : this.skip()),
    });
    this.resize = new ResizeObserver(() => this.render());
    this.resize.observe(this.hud.root);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (options.autostart) this.begin();
    else this.showStart();
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.frame);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.resize.disconnect();
    this.input.dispose();
    this.clock?.dispose();
    this.hud.dispose();
  }

  private save(prefs: RhythmPrefs): void {
    this.prefs = prefs;
    this.hud.setDim(prefs.dim);
    if (this.clock) this.clock.offset = prefs.offset;
    this.sounds.volume = prefs.hitSounds ? 0.8 : 0;
    // Watch is for a look at one chart; remembered, it would quietly play every later one.
    this.options.savePrefs({ ...prefs, mods: prefs.mods.filter((m) => m !== 'auto') });
  }

  /** Changes that still count as a pass: the help setting's, or all when nothing rides on it. */
  private settles(): readonly Mod[] {
    return this.options.test || this.options.author ? MODS : (this.options.forceMods ?? []);
  }

  private measure(): FieldLayout {
    sizeCanvas(this.hud.canvas);
    const box = this.hud.canvas;
    const dpr = box.clientWidth > 0 ? box.width / box.clientWidth : 1;
    return fitField(box.clientWidth, box.clientHeight, dpr, {
      top: HUD_TOP,
      bottom: HUD_BOTTOM,
      pad: this.rules.radius * 1.2,
      allowRotate: true,
    });
  }

  private showStart(): void {
    const objects = this.options.beatmap.objects;
    const last = objects.reduce((m, o) => Math.max(m, o.kind === 'circle' ? o.t : o.end), 0);
    this.hud.showPanel(
      startCard(this.text, {
        beatmap: this.options.beatmap,
        name: this.name,
        hasSong: this.options.song.kind !== 'none',
        length: last - (objects[0]?.t ?? 0),
        forced: this.options.forceMods ?? [],
        prefs: () => this.prefs,
        save: (p) => this.save(p),
        start: () => this.begin(),
        ...(this.options.test ? { close: () => this.finish(null) } : {}),
      }),
    );
    this.render();
  }

  private mods(): readonly Mod[] {
    const forced = this.options.forceMods ?? [];
    return [...this.prefs.mods.filter((m) => !forced.some((f) => EXCLUSIVE[f] === m)), ...forced];
  }

  private begin(): void {
    const o = this.options;
    void o.engine.resume();
    this.sounds.volume = this.prefs.hitSounds ? 0.8 : 0;
    this.rules = playRules(o.beatmap.difficulty, this.mods());
    const startAt = o.startAt;
    const map =
      startAt === undefined
        ? o.beatmap
        : { ...o.beatmap, objects: o.beatmap.objects.filter((n) => n.t >= startAt) };
    this.session = new BeatmapSession(map, this.rules);
    this.clock?.dispose();
    this.clock = new SongClock(o.engine, o.song, this.rules.rate, o.beatmap.timing, this.sounds, {
      offset: this.prefs.offset,
    });
    const first = this.session.firstTime;
    const from =
      startAt !== undefined
        ? Math.max(-2000, startAt - this.rules.preempt - 800)
        : Math.min(-(o.beatmap.lead ?? 0), first - this.rules.preempt - 1200);
    this.finishedAt = 0;
    this.overlay.clear();
    this.hud.resetKeys();
    this.hud.showPanel(null);
    this.layout = this.measure();
    this.clock.start(from);
    this.phase = 'playing';
    this.hud.root.dataset.phase = 'playing';
    this.loop();
  }

  private loop(): void {
    cancelAnimationFrame(this.frame);
    const tick = () => {
      if (this.closed) return;
      if (this.phase === 'playing') this.frame = requestAnimationFrame(tick);
      this.render();
    };
    this.frame = requestAnimationFrame(tick);
  }

  private press(key: InputKey, stamp: number, x?: number, y?: number): void {
    const { session, clock } = this;
    if (!session || !clock || this.phase !== 'playing') return;
    this.hud.key(key, true);
    // The event happened a little before this frame; judge it when it happened.
    const lag = Math.max(0, Math.min(50, performance.now() - stamp));
    session.press(clock.now() - lag * this.rules.rate, x, y);
    this.handle(session.takeEvents());
  }

  private handle(events: readonly PlayEvent[]): void {
    const now = performance.now();
    for (const e of events) {
      switch (e.kind) {
        case 'judged': {
          const label = e.judgement === 'perfect' ? '' : this.text(`bm.${e.judgement}`);
          this.overlay.judged(e.x, e.y, e.judgement, label, now);
          if (e.offset !== null) this.overlay.tapped(e.offset, now);
          if (e.judgement === 'miss') {
            if (this.options.haptics) navigator.vibrate?.(25);
          } else if (this.session?.objects[e.index]?.kind !== 'slider') {
            this.sounds.play('hit');
          }
          break;
        }
        case 'part':
          if (e.offset !== undefined) this.overlay.tapped(e.offset, now);
          if (e.ok) this.sounds.play(e.part === 'tick' ? 'tick' : 'hit');
          else if (e.part !== 'end') this.overlay.judged(e.x, e.y, 'miss', this.text('bm.miss'), now);
          break;
        case 'comboBreak':
          this.sounds.play('break');
          break;
        case 'failed':
          this.over();
          break;
        case 'finished':
          this.finishedAt = now;
          break;
      }
    }
  }

  private render(): void {
    if (this.closed) return;
    if (sizeCanvas(this.hud.canvas) || this.layout.width !== this.hud.canvas.clientWidth)
      this.layout = this.measure();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.hud.canvas.width, this.hud.canvas.height);
    const { session, clock } = this;
    if (!session || !clock) return;
    const t = clock.now();
    if (this.phase === 'playing') {
      session.update(t);
      this.handle(session.takeEvents());
    }
    const state: DrawState = {
      t,
      rules: this.rules,
      isDone: (i) => session.isDone(i),
      isHeadDone: (i) => session.isHeadDone(i),
      tracking: (i) => session.isTracking(i),
      spin: (i) => session.spinProgress(i),
    };
    this.painter.draw(this.layout, session.objects, state);
    const now = performance.now();
    this.overlay.drawPopups(this.layout, this.rules.radius, now);
    this.overlay.drawErrorBar(this.layout, this.rules, now, HUD_BOTTOM / 2);
    if (this.mouseAim || this.rules.auto)
      this.overlay.drawCursor(this.layout, session.cursor.x, session.cursor.y);
    const length = Math.max(1, session.endTime - session.firstTime);
    const skipTo = session.firstTime - this.rules.preempt - 1000;
    this.hud.update({
      score: session.stats.score,
      accuracy: session.accuracy,
      combo: session.stats.combo,
      health: session.stats.health,
      progress: Math.max(0, Math.min(1, (t - session.firstTime) / length)),
      resting: session.inBreak(t),
      canSkip: this.phase === 'playing' && t < skipTo - 1000,
    });
    if (this.phase === 'playing' && this.finishedAt && now - this.finishedAt > 700) this.over();
  }

  private skip(): void {
    const { session, clock } = this;
    if (!session || !clock || this.phase !== 'playing') return;
    const skipTo = session.firstTime - this.rules.preempt - 1000;
    if (clock.now() < skipTo - 1000) clock.start(skipTo);
  }

  private togglePause(): void {
    if (this.phase === 'playing') this.pause();
    else if (this.phase === 'paused') this.resume();
    // A test play can be left from its start card; a story's Rhythm block must be played.
    else if (this.phase === 'ready' && this.options.test) this.finish(null);
  }

  private pause(): void {
    if (!this.clock) return;
    this.clock.pause();
    this.phase = 'paused';
    this.hud.root.dataset.phase = 'paused';
    this.input.releaseAll();
    this.hud.showPanel(
      pauseCard(this.text, {
        test: !!this.options.test,
        offset: () => this.prefs.offset,
        changeOffset: (d) =>
          this.save({ ...this.prefs, offset: Math.max(-300, Math.min(300, this.prefs.offset + d)) }),
        resume: () => this.resume(),
        retry: () => this.begin(),
        quit: () => this.quit(),
      }),
    );
    this.render();
  }

  private resume(): void {
    const clock = this.clock;
    if (!clock) return;
    this.hud.showPanel(null);
    // A short run-up: the last second plays again before the notes carry on.
    clock.start(clock.now() - 1000 * this.rules.rate);
    this.phase = 'playing';
    this.hud.root.dataset.phase = 'playing';
    this.loop();
  }

  private quit(): void {
    const result = this.session?.result(100);
    this.finish(result ? { ...result, won: false } : null);
  }

  private over(): void {
    const session = this.session;
    if (!session || this.phase === 'over') return;
    this.phase = 'over';
    this.hud.root.dataset.phase = 'over';
    this.input.releaseAll();
    if (session.failed) this.clock?.pause();
    const result = session.result(this.options.pass ?? 0, this.settles());
    this.hud.showPanel(
      resultCard(this.text, {
        result,
        pass: this.options.pass ?? 0,
        test: !!this.options.test,
        retry: () => this.begin(),
        playYourself: () => {
          this.save({ ...this.prefs, mods: this.prefs.mods.filter((m) => m !== 'auto') });
          this.begin();
        },
        done: () => this.finish(result),
        useOffset:
          this.rules.auto || session.offsets.length < 10
            ? null
            : (ms) => this.save({ ...this.prefs, offset: this.prefs.offset + ms }),
      }),
    );
    this.render();
  }

  private finish(result: PlayResult | null): void {
    if (this.closed) return;
    const done = this.options.onDone;
    this.dispose();
    if (this.options.test || !result) done(null);
    else done({ won: result.won, score: Math.round(result.accuracy * 100) });
  }
}
