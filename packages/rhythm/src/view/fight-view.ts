import { Conductor, type AudioEngine } from '@ie/audio';
import { stageColor, themePalette, type Rgb, type StageDirector } from '@ie/stage';
import { createTranslator, type Locale } from '@ie/i18n';
import { compileSequence, CueQueue, steadyTime, type SequenceCue } from '@ie/sequencer';
import type { Difficulty, EnemyDef, FightMode, FightResult, SequenceDef } from '@ie/story';
import { FightSession, type Assist, type FightClock, type FightEvent } from '../fight.ts';
import { WINDOWS } from '../judge.ts';
import { FightHud, type FightText } from './fight-hud.ts';
import { fightMessages } from './messages.ts';
import { FightInput, type FightAction } from './fight-input.ts';
import { FightLayer, NOTE_GLYPHS, type FightColors } from './fight-layer.ts';
import type { FightMusic } from './fight-music.ts';
import { FightSounds } from './fight-sounds.ts';

export interface FightViewOptions {
  /** Where the fight screen goes; it covers the viewport, or `host` when `contained`. */
  readonly host: HTMLElement;
  readonly contained?: boolean;
  readonly enemy: EnemyDef;
  readonly enemyName: string;
  readonly presence: readonly string[];
  readonly mode: FightMode;
  readonly difficulty: Difficulty;
  readonly bars: number;
  readonly seed: number;
  readonly music: FightMusic;
  /** Seconds between scheduling audio and hearing it (the engine's output latency). */
  readonly outputLatency: number;
  /** How late this device registers a tap after the sound is heard (the tap-timing test). */
  readonly tapLatency: number;
  readonly stage: StageDirector | null;
  readonly engine: AudioEngine | null;
  readonly assist: Assist;
  readonly haptics: boolean;
  readonly locale: Locale;
  /** Move sequences and charts (ADR 0019). */
  readonly sequences?: readonly SequenceDef[];
  readonly chart?: SequenceDef;
  /** Runs a choreography cue the way a block would (the app's action bus). */
  readonly dispatch?: (action: string, params: unknown) => void;
  readonly onDone: (result: FightResult) => void;
}

/**
 * A rhythm fight on screen (ADR 0016): waits for the music, counts in on a downbeat, then runs the
 * session from the conductor's clock each frame. The stage draws notes when it can; otherwise a
 * DOM cue stands in. Calls `onDone` once the reader closes the result.
 */
export class FightView {
  private readonly hud: FightHud;
  private readonly input: FightInput;
  private readonly conductor: Conductor;
  private readonly layer: FightLayer;
  private readonly sounds: FightSounds | null;
  private readonly colors: FightColors;
  private readonly text: FightText;
  private session: FightSession | null = null;
  private clock: FightClock | null = null;
  /** Choreography of the moves and chart being played, at fight beats. */
  private readonly cues = new CueQueue();
  private readonly fire: (cue: SequenceCue) => void;
  private frame = 0;
  private onStage = false;
  private closed = false;
  private readonly approach: number;
  /** Heard time until which an announcement keeps the cue instead of the turn. */
  private announceUntil = 0;

  constructor(private readonly options: FightViewOptions) {
    const { music } = options;
    this.fire = (cue) => options.dispatch?.(cue.action, cue.params);
    this.conductor = new Conductor(music.tempo, music.source, { latency: options.outputLatency });
    this.text = createTranslator(fightMessages, options.locale);
    this.hud = new FightHud(options.host, this.text, options.enemyName, options.presence);
    if (options.contained) this.hud.root.classList.add('ie-fight--contained');
    this.hud.setTurn('count');
    this.hud.setHp(1, 1);
    const palette = themePalette();
    const mix = (a: Rgb, b: Rgb): Rgb => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    this.colors = {
      strike: palette.accent,
      parry: stageColor(options.enemy.color ?? 'red', palette),
      dodge: stageColor('blue', palette),
      miss: mix(palette.ink, palette.background),
    };
    const approach = Math.min(1.6, Math.max(0.7, (2 * 60) / music.tempo.bpm));
    this.approach = approach;
    this.layer = new FightLayer({
      now: () => this.conductor.time(),
      notes: () => this.session?.notes ?? [],
      approach,
      colors: () => this.colors,
      onFrame: () => this.tick(),
    });
    this.input = new FightInput({
      target: this.hud.root,
      onAction: (a) => this.act(a),
      expectsSwipe: () => this.dodgeDue(),
    });
    this.sounds = options.engine ? new FightSounds(options.engine) : null;
    this.onStage = options.stage?.setLayer(this.layer) ?? false;
    if (!this.onStage) {
      this.hud.fallback.hidden = false;
      const loop = () => {
        this.frame = requestAnimationFrame(loop);
        this.tick();
        this.drawFallback();
      };
      this.frame = requestAnimationFrame(loop);
    }
  }

  /** Leaves the fight at once, without a result (closing the novel, leaving Play). */
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.frame);
    this.layer.finish();
    this.options.stage?.setLayer(null);
    this.input.dispose();
    this.hud.dispose();
    this.options.music.release();
  }

  private get width(): number {
    return this.options.host.clientWidth;
  }

  private get height(): number {
    return this.options.host.clientHeight;
  }

  private start(): void {
    const { music, enemy, mode, difficulty, bars, seed, assist, sequences, chart } = this.options;
    const tempo = music.tempo;
    const bpb = tempo.beatsPerBar;
    // Count in from the next downbeat at least a beat away.
    const origin = Math.ceil((this.conductor.beat() + 1) / bpb) * bpb;
    const clock: FightClock = {
      timeAt: (beat) => tempo.timeAt(origin + beat),
      beatAt: (time) => tempo.beatAt(time) - origin,
    };
    this.clock = clock;
    const sectionBars = music.sections
      .map((s) => Math.round((tempo.beatAt(s) - origin) / bpb) - 1)
      .filter((b) => b > 0);
    this.session = new FightSession({
      enemy,
      mode,
      difficulty,
      bars,
      seed,
      bpm: tempo.bpm,
      beatsPerBar: bpb,
      sectionBars,
      clock,
      assist,
      ...(sequences ? { sequences } : {}),
      ...(chart ? { chart } : {}),
    });
  }

  private tick(): void {
    if (this.closed) return;
    this.input.poll();
    if (!this.session) {
      if (this.options.music.source.playing) this.start();
      return;
    }
    const s = this.session;
    if (s.done) return;
    const now = this.conductor.time();
    this.handle(s.update(now));
    if (this.clock && this.cues.size > 0) this.cues.advance(this.clock.beatAt(now), this.fire);
    // Bars are planned ahead, so the cue follows the music: the turn whose notes are arriving.
    if (!s.done && now >= this.announceUntil) this.hud.setTurn(s.turnAt(now + this.approach / 2));
  }

  private act(action: FightAction): void {
    const s = this.session;
    if (!s || s.done) return;
    const heard =
      this.conductor.time() - (performance.now() - action.at) / 1000 - this.options.tapLatency;
    this.handle(s.input(action.action, heard));
  }

  private dodgeDue(): boolean {
    const s = this.session;
    if (!s) return false;
    const now = this.conductor.time();
    const reach = WINDOWS.good * 1.6 + 0.05;
    const next = s.notes.find((n) => !n.grade && n.time > now - reach);
    return next !== undefined && next.kind === 'dodge' && next.time - now < reach;
  }

  private handle(events: readonly FightEvent[]): void {
    const s = this.session;
    if (!s || events.length === 0) return;
    const stage = this.options.stage;
    const now = this.conductor.time();
    for (const e of events) {
      if (e.type === 'bar') {
        this.queueCues(e.plan.cues);
        continue;
      }
      if (e.type === 'phase') {
        this.hud.announce(this.text('fight.phase', { name: this.options.enemyName }));
        this.announceUntil = now + 1.5;
        stage?.flash({ color: 'red' });
      } else if (e.type === 'end') this.end(e.result.won, e.result.score);
      else {
        this.hud.judge(e.grade);
        if (e.note) this.layer.judged(e.note, now, this.width, this.height);
        else if (e.grade !== 'miss') this.layer.freeStrike(now, this.width, this.height);
        if (e.playerDamage > 0) {
          stage?.shake(0.45);
          this.sounds?.play('hurt');
          this.vibrate(30);
        } else if (e.grade !== 'miss') {
          this.sounds?.play(e.kind === 'strike' ? 'strike' : 'parry');
          if (e.kind !== 'strike' && e.grade === 'perfect') stage?.hitStop(0.05);
          if (s.combo > 0 && s.combo % 16 === 0) stage?.burst({ preset: 'sparks', color: 'gold' });
          this.vibrate(e.kind === 'strike' ? 8 : 14);
        }
      }
    }
    this.hud.setHp(s.enemyHp / s.enemyMax, s.playerHp / 100);
    this.hud.setCombo(s.combo);
    this.options.music.setIntensity(Math.min(1, s.combo / 24 + (s.phase === 2 ? 0.35 : 0)));
  }

  /** Queues the choreography of the moves (or the chart) a bar starts. */
  private queueCues(cues: readonly { beat: number; sequence: string }[] | undefined): void {
    if (!cues || !this.options.dispatch) return;
    const time = steadyTime(this.options.music.tempo.bpm);
    for (const cue of cues) {
      const sequence =
        this.options.chart?.id === cue.sequence
          ? this.options.chart
          : this.options.sequences?.find((q) => q.id === cue.sequence);
      if (sequence) this.cues.add(compileSequence(sequence, time).cues, cue.beat);
    }
  }

  private end(won: boolean, score: number): void {
    this.cues.clear();
    const name = this.options.enemyName;
    if (won)
      this.options.stage?.title({ text: { en: name, tr: name }, seconds: 0.6, exit: 'shatter' });
    this.layer.finish();
    const go = this.hud.showResult(won, score);
    go.focus({ preventScroll: true });
    go.addEventListener('click', () => {
      const result = { won, score };
      this.dispose();
      this.options.onDone(result);
    });
  }

  private vibrate(ms: number): void {
    if (this.options.haptics) navigator.vibrate?.(ms);
  }

  /** Without a stage: the next note's glyph, scaled down as it lands. */
  private drawFallback(): void {
    const s = this.session;
    const cue = this.hud.fallback;
    if (!s || s.done) {
      cue.textContent = '';
      return;
    }
    const now = this.conductor.time();
    const next = s.notes.find((n) => !n.grade && n.time > now - 0.05);
    if (!next || next.time - now > 1.2) {
      cue.textContent = '';
      return;
    }
    cue.textContent = NOTE_GLYPHS[next.kind];
    cue.dataset.kind = next.kind;
    cue.style.transform = `scale(${1 + Math.max(0, next.time - now) * 2})`;
  }
}
