import { Conductor, type AudioDirector } from '@ie/audio';
import type { Beat, StoryProject, StoryRuntime } from '@ie/story';
import { compileSequence, sceneAt, type CompiledSequence } from './compile.ts';
import { prepareSequenceClock, startBeat } from './music.ts';
import { SequencePlayer, type Dispatch, type FrameScheduler } from './player.ts';

type SequenceBeat = Extract<Beat, { kind: 'sequence' }>;

export interface SequenceRunnerOptions {
  readonly audio: AudioDirector;
  readonly dispatch: Dispatch;
  /** The sequence the story waits on ended: move the story on. */
  readonly done: () => void;
  /** Frame timing for the players; `requestAnimationFrame` by default. */
  readonly frames?: FrameScheduler;
}

/** The story beat a waiting sequence belongs to, to notice when the story has left it. */
interface Owner {
  readonly runtime: StoryRuntime;
  readonly at: number;
  readonly blockId: string;
}

interface Active {
  readonly key: string;
  readonly owner: Owner | null;
  player: SequencePlayer | null;
}

/** True while the story still waits on the beat that started the sequence. */
function stillWaiting(owner: Owner): boolean {
  const beat = owner.runtime.waiting;
  return (
    beat?.kind === 'sequence' &&
    beat.blockId === owner.blockId &&
    owner.runtime.log.length === owner.at
  );
}

/**
 * Plays sequences for a story (ADR 0019): the one a waiting beat names, mounted like a fight and
 * taken down when the story moves elsewhere, and ones the story fires without waiting.
 */
export class SequenceRunner {
  private active: Active | null = null;
  private free = 0;

  constructor(private readonly options: SequenceRunnerOptions) {}

  /** True while a sequence the story waits on plays. */
  get running(): boolean {
    return this.active?.owner != null;
  }

  /** Plays the sequence a waiting beat names. A redraw of the same beat keeps it playing. */
  start(runtime: StoryRuntime, beat: SequenceBeat): void {
    const key = `${runtime.log.length}:${beat.blockId}`;
    if (this.active?.key === key) return;
    const block = runtime.story.blocks.get(beat.blockId)?.block;
    const id = block?.type === 'sequence' ? block.sequence : '';
    const owner: Owner = { runtime, at: runtime.log.length, blockId: beat.blockId };
    this.launch(runtime.story.project, id, key, owner);
  }

  /** Plays a sequence without the story waiting (the `sequence.play` action). */
  play(project: StoryProject, sequenceId: string): void {
    this.launch(project, sequenceId, `free:${++this.free}`, null);
  }

  /** Stops a waiting sequence the story has left (a rewind, a load, a restart). */
  sync(runtime: StoryRuntime): void {
    if (!this.active?.owner) return;
    const beat = runtime.waiting;
    const key = beat?.kind === 'sequence' ? `${runtime.log.length}:${beat.blockId}` : null;
    if (this.active.key !== key) this.stop();
  }

  stop(): void {
    this.active?.player?.stop();
    this.active = null;
  }

  private launch(project: StoryProject, id: string, key: string, owner: Owner | null): void {
    this.stop();
    const token: Active = { key, owner, player: null };
    this.active = token;
    void this.mount(project, id, token);
  }

  private async mount(project: StoryProject, id: string, token: Active): Promise<void> {
    const { owner } = token;
    const finish = () => {
      if (this.active !== token) return;
      this.active = null;
      // A sequence the reader tapped past has already moved the story on.
      if (owner && stillWaiting(owner)) this.options.done();
    };
    const sequence = project.sequences?.find((s) => s.id === id);
    if (!sequence) return finish(); // the analyzer reports it; the story still moves on
    const { audio } = this.options;
    const clock = await prepareSequenceClock(audio, project.audio, sequence);
    if (this.active !== token) return;
    const tempo = clock.tempo;
    const conductor = new Conductor(tempo, clock.source, { latency: audio.engine.outputLatency });
    let origin: number | null = null;
    let heard = Number.NEGATIVE_INFINITY;
    const compiled = compileSequence(sequence, (b) => tempo.timeAt(b) - tempo.timeAt(0));
    token.player = new SequencePlayer({
      sequence: compiled,
      now: () => {
        if (owner && !stillWaiting(owner)) {
          this.skipped(token, compiled, heard);
          return null;
        }
        if (!clock.source.playing) return null;
        const beat = conductor.beat();
        origin ??= startBeat(beat, tempo.beatsPerBar, clock.song);
        heard = beat - origin;
        return heard;
      },
      dispatch: this.options.dispatch,
      onEnd: finish,
      ...(this.options.frames ? { frames: this.options.frames } : {}),
    });
    token.player.start();
  }

  /**
   * The reader tapped past a waiting sequence. It stops, and the background and look it ends on
   * take over, so the picture matches the scene state the story already holds for it.
   */
  private skipped(token: Active, compiled: CompiledSequence, heard: number): void {
    token.player?.stop();
    if (this.active === token) this.active = null;
    const shown = new Set(sceneAt(compiled, heard));
    for (const cue of sceneAt(compiled, compiled.length))
      if (!shown.has(cue)) this.options.dispatch(cue.action, cue.params);
  }
}
