import { timingAt } from '@ie/rhythm';
import { BEATMAP_LIMITS, type BeatmapDef, type TimingPoint, type Track } from '@ie/story';
import { AudioLines, Plus, Trash2 } from 'lucide-react';
import { useT } from '../store.ts';
import { putTiming, removeTiming, shiftMap, timingFromTrack } from './beatmap-edit.ts';
import type { EditorTime } from './editor-time.ts';
import { NumberField } from './NumberField.tsx';

interface Props {
  readonly map: BeatmapDef;
  readonly track: Track | undefined;
  readonly time: EditorTime;
  readonly onCommit: (change: (map: BeatmapDef) => BeatmapDef, mergeKey?: string) => void;
}

const SHIFTS = [-10, -1, 1, 10] as const;

/** Tempo changes the grid snaps to, and moving the whole chart against its song. */
export function TimingEditor({ map, track, time, onCommit }: Props) {
  const t = useT();
  const fromSong = timingFromTrack(track);
  const replace = (old: TimingPoint, next: TimingPoint) =>
    onCommit((m) => putTiming(old.t === next.t ? m : removeTiming(m, old.t), next));

  return (
    <div className="stack" data-testid="bmed-timing">
      <p className="hint">{t('bmed.timingHint')}</p>
      <div className="stack bmed__timing">
        {map.timing.map((p) => (
          <div className="row row--wrap bmed__tempo" key={p.t} data-testid="bmed-tempo">
            <NumberField
              label={t('bmed.time')}
              value={p.t}
              min={-10000}
              max={BEATMAP_LIMITS.ms}
              testId="bmed-tempo-time"
              onCommit={(value) => replace(p, { ...p, t: Math.round(value) })}
            />
            <NumberField
              label={t('bmed.bpm')}
              value={p.bpm}
              min={10}
              max={1000}
              testId="bmed-tempo-bpm"
              onCommit={(bpm) => replace(p, { ...p, bpm: Math.round(bpm * 1000) / 1000 })}
            />
            <NumberField
              label={t('bmed.meter')}
              value={p.meter ?? 4}
              min={1}
              max={16}
              onCommit={(value) => {
                const meter = Math.round(value);
                const { meter: _old, ...rest } = p;
                replace(p, meter === 4 ? rest : { ...rest, meter });
              }}
            />
            <button
              type="button"
              className="ie-button ie-button--quiet icon-button"
              aria-label={t('bmed.removeTiming')}
              title={t('bmed.removeTiming')}
              disabled={map.timing.length <= 1}
              onClick={() => onCommit((m) => removeTiming(m, p.t))}
            >
              <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <div className="row row--wrap">
        <button
          type="button"
          className="ie-button"
          data-testid="bmed-add-tempo"
          onClick={() => {
            const at = Math.round(time.t);
            const { t: _t, ...here } = timingAt(map.timing, at);
            onCommit((m) => putTiming(m, { ...here, t: at }));
          }}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('bmed.addTiming')}
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="bmed-tempo-from-song"
          disabled={!fromSong}
          title={fromSong ? undefined : t('bmed.timingHint')}
          onClick={() => fromSong && onCommit((m) => ({ ...m, timing: [fromSong] }))}
        >
          <AudioLines size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('bmed.fromSong')}
        </button>
      </div>
      <div className="row row--wrap bmed__shift">
        <span className="ie-label">{t('bmed.shift')}</span>
        {SHIFTS.map((ms) => (
          <button
            key={ms}
            type="button"
            className="ie-button ie-button--quiet"
            data-testid={`bmed-shift-${ms}`}
            onClick={() => onCommit((m) => shiftMap(m, ms), `shift:${map.id}`)}
          >
            {t('bmed.shiftBy', { n: ms > 0 ? `+${ms}` : `${ms}` })}
          </button>
        ))}
      </div>
    </div>
  );
}
