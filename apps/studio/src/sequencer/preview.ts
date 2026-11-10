import { Conductor, trackTempo, type TempoMap } from '@ie/audio';
import {
  compileSequence,
  sceneAt,
  SequencePlayer,
  steadyTempo,
  wallClock,
  type SequenceCue,
} from '@ie/sequencer';
import { sceneKey, sequenceNotes, type SequenceDef, type StoryProject } from '@ie/story';
import { director, engine } from '../audio/studio-audio.ts';
import { runAction } from '../kernel.ts';
import { stage } from '../stage/studio-stage.ts';

/** The beat grid a sequence follows in the Studio: its song's, or its own steady tempo. */
export function sequenceTempo(
  doc: StoryProject,
  sequence: SequenceDef,
): { tempo: TempoMap; song: boolean } {
  const track = sequence.track ? doc.audio?.tracks.find((t) => t.id === sequence.track) : undefined;
  const songTempo = trackTempo(track);
  return songTempo
    ? { tempo: songTempo, song: true }
    : { tempo: steadyTempo(sequence), song: false };
}

/** A preview-only cue: a note ticks, so the author hears the rhythm they placed. */
const NOTE_CUE = 'preview.note';
const NOTE_PITCH: Readonly<Record<string, number>> = { parry: 1320, dodge: 880, strike: 1760 };
const ticks = new Map<string, AudioBuffer>();

function tick(kind: string): AudioBuffer {
  const cached = ticks.get(kind);
  if (cached) return cached;
  const rate = 44100;
  const hz = NOTE_PITCH[kind] ?? 1320;
  const samples = new Float32Array(Math.round(rate * 0.05));
  for (let i = 0; i < samples.length; i++)
    samples[i] = Math.sin((2 * Math.PI * hz * i) / rate) * Math.exp(-i / (rate * 0.01)) * 0.5;
  const buffer = engine.buffer(samples, rate);
  ticks.set(kind, buffer);
  return buffer;
}

export interface PreviewCallbacks {
  /** Every frame while playing. */
  readonly frame: (beat: number) => void;
  /** Playback stopped (the end, or Pause), at this beat. */
  readonly stopped: (beat: number) => void;
}

/**
 * Plays a sequence in the Studio: the song from the playhead, cues through the action bus onto the
 * Studio's stage, and a tick per note. Paused, it shows the scene in force at the playhead.
 */
export class SequencePreview {
  private player: SequencePlayer | null = null;
  private song = false;
  private beat = 0;
  private shown = '';
  private generation = 0;

  constructor(private readonly callbacks: PreviewCallbacks) {}

  get playing(): boolean {
    return this.player?.playing ?? false;
  }

  async play(doc: StoryProject, sequence: SequenceDef, from: number): Promise<void> {
    this.halt();
    const generation = ++this.generation;
    const { tempo, song } = sequenceTempo(doc, sequence);
    const compiled = compileSequence(sequence, (b) => tempo.timeAt(b) - tempo.timeAt(0));
    const notes = sequenceNotes(sequence).map((n): SequenceCue => ({
      beat: n.at,
      action: NOTE_CUE,
      params: { kind: n.kind },
    }));
    const cues = [...compiled.cues, ...notes].sort((a, b) => a.beat - b.beat);
    let now: () => number | null;
    if (song && sequence.track) {
      await engine.resume();
      await director.musicSet({ track: sequence.track, fade: 0 });
      if (generation !== this.generation) return;
      director.music.seek(tempo.timeAt(from));
      const conductor = new Conductor(tempo, director.music.clock, {
        latency: engine.outputLatency,
      });
      // Until the song reports the new position, its clock still reads the old one.
      now = () => {
        if (!director.music.clock.playing) return null;
        const beat = conductor.beat();
        return beat < from - 0.5 ? null : beat;
      };
    } else {
      const conductor = new Conductor(tempo, wallClock());
      now = () => from + conductor.beat();
    }
    this.song = song;
    this.showScene(sequence, doc, from, true);
    this.player = new SequencePlayer({
      sequence: { ...compiled, cues },
      now,
      dispatch: (action, params) => this.dispatch(action, params),
      onFrame: (beat) => {
        this.beat = beat;
        this.callbacks.frame(beat);
      },
      onEnd: () => this.stop(),
    });
    this.beat = from;
    this.player.start(from);
  }

  /** Pauses where it is and reports that beat. */
  stop(): void {
    const was = this.player !== null;
    this.halt();
    if (was) this.callbacks.stopped(this.beat);
  }

  /** While paused: the background and look in force at `beat`, without the moments before it. */
  showScene(sequence: SequenceDef, doc: StoryProject, beat: number, force = false): void {
    const { tempo } = sequenceTempo(doc, sequence);
    const compiled = compileSequence(sequence, (b) => tempo.timeAt(b) - tempo.timeAt(0));
    const scene: Record<string, unknown> = {};
    for (const cue of sceneAt(compiled, beat))
      if (cue.action.startsWith('stage.')) scene[sceneKey(cue.action, cue.params)] = cue.params;
    const key = JSON.stringify(scene);
    if (!force && key === this.shown) return;
    this.shown = key;
    stage.applyScene(scene);
  }

  dispose(): void {
    this.halt();
    this.shown = '';
  }

  private halt(): void {
    this.generation++;
    this.player?.stop();
    this.player = null;
    if (this.song) director.music.stop(0.2);
    this.song = false;
  }

  private dispatch(action: string, params: unknown): void {
    if (action === NOTE_CUE) {
      const kind = (params as { kind?: string }).kind ?? 'parry';
      engine.play(tick(kind), 'ui', 0.6);
      return;
    }
    runAction(action, params);
  }
}
