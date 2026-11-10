import type { SequenceClip, SequenceDef, SequenceNote, SequenceTrack } from '@ie/story';
import { type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import { useT } from '../store.ts';
import { clipIcon, clipName, NOTE_ICON, noteName, trackName } from './labels.ts';
import { TrackHeader } from './TrackHeader.tsx';

/** Width of a moment (a clip without a length) and the smallest a clip is drawn, in pixels. */
const MOMENT_PX = 28;
/** Movement that turns a press into a drag, in pixels (a tap selects). */
const DRAG_PX = 5;
/** Room after the end, so the last beat can be tapped. */
const TAIL_PX = 48;

export interface TimelineProps {
  readonly sequence: SequenceDef;
  readonly beatsPerBar: number;
  /** Pixels per beat. */
  readonly zoom: number;
  /** Snaps a beat to the current grid. */
  readonly snap: (beat: number) => number;
  /** The grid step in beats. */
  readonly step: number;
  readonly selected: string | null;
  readonly playhead: number;
  readonly playheadRef: Ref<HTMLDivElement>;
  readonly scrollRef: Ref<HTMLDivElement>;
  readonly onSelect: (id: string | null) => void;
  readonly onAdd: (track: SequenceTrack, beat: number) => void;
  /** A drag in progress: `id` should start at `beat`. */
  readonly onMove: (id: string, beat: number) => void;
  readonly onTrim: (id: string, length: number) => void;
  readonly onScrub: (beat: number) => void;
  readonly onTrack: (trackId: string, change: 'mute' | 'remove') => void;
}

/**
 * Follows one pointer from a press: calls `move` with the horizontal travel in pixels once it is a
 * drag, or `tap` when it lets go without moving. The pointer is captured, so the drag keeps going
 * outside the element, and nothing scrolls underneath (touch-action: none on the target).
 */
function follow(
  event: ReactPointerEvent<HTMLElement>,
  move: (dx: number) => void,
  tap?: () => void,
): void {
  event.stopPropagation();
  const el = event.currentTarget;
  const x0 = event.clientX;
  let dragging = false;
  el.setPointerCapture(event.pointerId);
  const onMove = (e: PointerEvent) => {
    const dx = e.clientX - x0;
    if (!dragging && Math.abs(dx) < DRAG_PX) return;
    dragging = true;
    move(dx);
  };
  const onUp = () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    if (!dragging) tap?.();
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
}

/** The timeline: a ruler in bars and beats, one lane per track, and the playhead (ADR 0019). */
export function Timeline({ playheadRef, scrollRef, ...props }: TimelineProps) {
  const t = useT();
  const { sequence, beatsPerBar, zoom, snap, step, selected } = props;
  const width = sequence.length * zoom;
  const bars = Math.ceil(sequence.length / beatsPerBar);
  const beatAt = (clientX: number, el: HTMLElement) =>
    (clientX - el.getBoundingClientRect().left) / zoom;

  const scrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    props.onScrub(snap(beatAt(event.clientX, el)));
    el.setPointerCapture(event.pointerId);
    const onMove = (e: PointerEvent) => props.onScrub(snap(beatAt(e.clientX, el)));
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };

  const grid = [];
  for (let beat = 0; beat <= sequence.length; beat++) {
    const bar = beat % beatsPerBar === 0;
    // Beat lines only once they are far enough apart to read.
    if (!bar && zoom < 16) continue;
    grid.push(
      <span
        key={beat}
        className={bar ? 'tl__line tl__line--bar' : 'tl__line'}
        style={{ left: beat * zoom }}
      />,
    );
  }

  const clip = (track: SequenceTrack, c: SequenceClip) => {
    const Icon = clipIcon(c);
    const w = c.length ? Math.max(MOMENT_PX, c.length * zoom) : MOMENT_PX;
    return (
      <button
        key={c.id}
        type="button"
        className="tl__clip"
        data-testid="seq-clip"
        data-track={track.kind}
        data-moment={c.length ? undefined : 'true'}
        aria-pressed={selected === c.id}
        aria-label={t('seq.clipLabel', { kind: t(clipName(c)), beat: c.at + 1 })}
        style={{ left: c.at * zoom, width: w }}
        onPointerDown={(e) =>
          follow(
            e,
            (dx) => props.onMove(c.id, snap(c.at + dx / zoom)),
            () => props.onSelect(c.id),
          )
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') props.onSelect(c.id);
        }}
      >
        <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
        {c.length ? <span className="tl__clip-name">{t(clipName(c))}</span> : null}
        {c.length ? (
          <span
            className="tl__trim"
            role="separator"
            aria-label={t('seq.trim')}
            data-testid="seq-trim"
            onPointerDown={(e) => {
              const length = c.length ?? 1;
              follow(e, (dx) => {
                const next = Math.round((length + dx / zoom) / step) * step;
                props.onTrim(c.id, Math.max(step, Math.min(next, sequence.length - c.at)));
              });
            }}
          />
        ) : null}
      </button>
    );
  };

  const note = (n: SequenceNote) => {
    const Icon = NOTE_ICON[n.kind];
    return (
      <button
        key={n.id}
        type="button"
        className="tl__note"
        data-testid="seq-note"
        data-kind={n.kind}
        aria-pressed={selected === n.id}
        aria-label={t('seq.clipLabel', { kind: t(noteName(n.kind)), beat: n.at + 1 })}
        style={{ left: n.at * zoom }}
        onPointerDown={(e) =>
          follow(
            e,
            (dx) => props.onMove(n.id, snap(n.at + dx / zoom)),
            () => props.onSelect(n.id),
          )
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') props.onSelect(n.id);
        }}
      >
        <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="tl" data-testid="timeline">
      <div className="tl__heads">
        <div className="tl__corner" />
        {sequence.tracks.map((track) => (
          <TrackHeader key={track.id} track={track} onTrack={props.onTrack} />
        ))}
      </div>
      <div className="tl__scroll" ref={scrollRef}>
        <div className="tl__content" style={{ width: width + TAIL_PX }}>
          <div
            className="tl__ruler"
            role="slider"
            tabIndex={-1}
            aria-label={t('seq.ruler')}
            aria-valuemin={0}
            aria-valuemax={sequence.length}
            aria-valuenow={props.playhead}
            data-testid="seq-ruler"
            style={{ width }}
            onPointerDown={scrub}
          >
            {Array.from({ length: bars }, (_, i) => (
              <span key={i} className="tl__bar" style={{ left: i * beatsPerBar * zoom }}>
                {i + 1}
              </span>
            ))}
          </div>
          <div className="tl__lanes" style={{ width }}>
            <div className="tl__grid" aria-hidden="true">
              {grid}
            </div>
            {sequence.tracks.map((track) => (
              <div
                key={track.id}
                className="tl__lane"
                data-testid="seq-lane"
                data-track={track.kind}
                data-muted={track.muted ? 'true' : undefined}
                aria-label={t('seq.lane', { track: t(trackName(track.kind)) })}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  props.onAdd(track, snap(beatAt(e.clientX, e.currentTarget)));
                }}
              >
                {track.kind === 'notes'
                  ? track.notes.map(note)
                  : track.clips.map((c) => clip(track, c))}
              </div>
            ))}
          </div>
          <div
            className="tl__playhead"
            ref={playheadRef}
            aria-hidden="true"
            style={{ transform: `translateX(${props.playhead * zoom}px)` }}
          />
        </div>
      </div>
    </div>
  );
}
