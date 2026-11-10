import { TRACK_KINDS, type SequenceDef, type TrackKind } from '@ie/story';
import { Pause, Play, SkipBack, ZoomIn, ZoomOut } from 'lucide-react';
import type { Ref } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { useT } from '../store.ts';
import { SNAPS } from './edit.ts';
import { NOTE_CHOICES, noteName, snapName, trackName, type NoteKindChoice } from './labels.ts';
import { useSequencerUi, ZOOMS } from './ui.ts';

/** Every track kind, so a new kind (materials, ADR 0020) shows up here by itself. */
const TRACK_CHOICES: readonly TrackKind[] = TRACK_KINDS;

/** Play, back to start, where the playhead is, snap, zoom, the kind of new notes, add a track. */
export function Transport({
  sequence,
  playing,
  positionRef,
  position,
  onPlay,
  onStart,
  onAddTrack,
}: {
  readonly sequence: SequenceDef;
  readonly playing: boolean;
  readonly positionRef: Ref<HTMLSpanElement>;
  readonly position: string;
  readonly onPlay: () => void;
  readonly onStart: () => void;
  readonly onAddTrack: (kind: TrackKind) => void;
}) {
  const t = useT();
  const ui = useSequencerUi();
  const zoomIndex = ZOOMS.findIndex((z) => z >= ui.zoom);
  const zoomBy = (delta: number) => {
    const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, zoomIndex + delta))];
    if (next) ui.setZoom(next);
  };
  const hasNotes = sequence.tracks.some((tr) => tr.kind === 'notes');
  const noteKinds: readonly NoteKindChoice[] =
    sequence.kind === 'move' ? NOTE_CHOICES.filter((k) => k !== 'strike') : NOTE_CHOICES;

  return (
    <div className="seq-transport">
      <div className="row row--wrap">
        <button
          type="button"
          className="ie-button"
          data-testid="seq-play"
          aria-pressed={playing}
          onClick={onPlay}
        >
          {playing ? (
            <Pause size={16} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Play size={16} strokeWidth={1.5} aria-hidden="true" />
          )}
          {t(playing ? 'seq.pause' : 'seq.play')}
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          aria-label={t('seq.toStart')}
          title={t('seq.toStart')}
          onClick={onStart}
        >
          <SkipBack size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <span className="seq-transport__position" ref={positionRef} data-testid="seq-position">
          {position}
        </span>
      </div>
      <div className="row row--wrap">
        <label className="inline-field">
          <span>{t('seq.snap')}</span>
          <select
            className="picker"
            value={String(ui.snap)}
            data-testid="seq-snap"
            onChange={(e) => {
              const snap = SNAPS.find((s) => String(s) === e.target.value);
              if (snap !== undefined) ui.setSnap(snap);
            }}
          >
            {SNAPS.map((s) => (
              <option key={String(s)} value={String(s)}>
                {t(snapName(s))}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          aria-label={t('seq.zoomOut')}
          title={t('seq.zoomOut')}
          disabled={zoomIndex <= 0}
          onClick={() => zoomBy(-1)}
        >
          <ZoomOut size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          aria-label={t('seq.zoomIn')}
          title={t('seq.zoomIn')}
          data-testid="seq-zoom-in"
          disabled={zoomIndex >= ZOOMS.length - 1}
          onClick={() => zoomBy(1)}
        >
          <ZoomIn size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <select
          className="picker"
          aria-label={t('seq.addTrack')}
          value=""
          data-testid="seq-add-track"
          onChange={(e) => {
            const kind = TRACK_CHOICES.find((k) => k === e.target.value);
            if (kind) onAddTrack(kind);
          }}
        >
          <option value="">{t('seq.addTrack')}</option>
          {TRACK_CHOICES.map((k) => (
            <option key={k} value={k}>
              {t(trackName(k))}
            </option>
          ))}
        </select>
      </div>
      {hasNotes && (
        <Segmented
          label={t('seq.noteKind')}
          value={noteKinds.includes(ui.noteKind) ? ui.noteKind : 'parry'}
          options={noteKinds.map((k) => ({ value: k, label: t(noteName(k)) }))}
          onChange={ui.setNoteKind}
        />
      )}
    </div>
  );
}
