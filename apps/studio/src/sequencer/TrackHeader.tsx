import type { SequenceTrack } from '@ie/story';
import { Volume2, VolumeX, X } from 'lucide-react';
import { useT } from '../store.ts';
import { trackName } from './labels.ts';

/** A track's name with its mute and remove buttons, beside its lane. */
export function TrackHeader({
  track,
  onTrack,
}: {
  readonly track: SequenceTrack;
  readonly onTrack: (trackId: string, change: 'mute' | 'remove') => void;
}) {
  const t = useT();
  const name = t(trackName(track.kind));
  const Mute = track.muted ? VolumeX : Volume2;
  return (
    <div className="tl__head" data-muted={track.muted ? 'true' : undefined}>
      <span className="tl__head-name">{name}</span>
      <span className="tl__head-buttons">
        <button
          type="button"
          className="tl__head-button"
          aria-pressed={track.muted === true}
          aria-label={t(track.muted ? 'seq.unmute' : 'seq.mute', { track: name })}
          title={t(track.muted ? 'seq.unmute' : 'seq.mute', { track: name })}
          onClick={() => onTrack(track.id, 'mute')}
        >
          <Mute size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="tl__head-button"
          aria-label={t('seq.removeTrack', { track: name })}
          title={t('seq.removeTrack', { track: name })}
          onClick={() => onTrack(track.id, 'remove')}
        >
          <X size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
