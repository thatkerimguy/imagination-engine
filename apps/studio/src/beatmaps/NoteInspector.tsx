import {
  BEATMAP_LIMITS,
  SLIDER_CURVES,
  type BeatmapDef,
  type HitObject,
  type SliderCurve,
} from '@ie/story';
import { Trash2 } from 'lucide-react';
import { useT } from '../store.ts';
import { removeObjects, setObject, toggleCombo } from './beatmap-edit.ts';
import { lengthInBeats, withLength } from './note-tools.ts';
import { NumberField } from './NumberField.tsx';

interface Props {
  readonly map: BeatmapDef;
  readonly selected: ReadonlySet<string>;
  readonly onCommit: (change: (map: BeatmapDef) => BeatmapDef, mergeKey?: string) => void;
  readonly onSelect: (ids: ReadonlySet<string>) => void;
}

/** The selected notes: when, how long, what shape, and whether a new combo starts there. */
export function NoteInspector({ map, selected, onCommit, onSelect }: Props) {
  const t = useT();
  const picked = map.objects.filter((o) => selected.has(o.id));
  const only = picked.length === 1 ? (picked[0] as HitObject) : null;
  if (picked.length === 0) return <p className="hint">{t('bmed.keys')}</p>;
  const set = (id: string, change: (o: HitObject) => HitObject, key: string) =>
    onCommit((m) => setObject(m, id, change), `note:${id}:${key}`);

  return (
    <div className="stack bmed__inspector" data-testid="bmed-inspector">
      <p className="ie-label">
        {only ? t(`bmed.kind.${only.kind}`) : t('bmed.selected', { count: picked.length })}
      </p>
      {only && (
        <NumberField
          label={t('bmed.noteTime')}
          value={Math.round(only.t)}
          min={0}
          max={BEATMAP_LIMITS.ms}
          testId="bmed-note-time"
          onCommit={(value) => {
            const time = Math.round(value);
            set(only.id, (o) => (o.kind === 'circle' ? { ...o, t: time } : { ...o, t: time, end: o.end + time - o.t }), 'time');
          }}
        />
      )}
      {only && only.kind !== 'circle' && (
        <NumberField
          label={t('bmed.beats')}
          value={lengthInBeats(only, map.timing)}
          min={0.0625}
          max={512}
          testId="bmed-note-beats"
          onCommit={(beats) =>
            set(only.id, (o) => (o.kind === 'circle' ? o : withLength(o, beats, map.timing)), 'beats')
          }
        />
      )}
      {only?.kind === 'slider' && (
        <>
          <label className="labelled">
            <span className="ie-label">{t('bmed.curve')}</span>
            <select
              className="picker"
              value={only.curve}
              data-testid="bmed-note-curve"
              onChange={(e) =>
                set(only.id, (o) => (o.kind === 'slider' ? { ...o, curve: e.target.value as SliderCurve } : o), 'curve')
              }
            >
              {SLIDER_CURVES.map((c) => (
                <option key={c} value={c}>
                  {t(`bmed.curve.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label={t('bmed.slides')}
            value={only.slides}
            min={1}
            max={32}
            testId="bmed-note-slides"
            onCommit={(value) => {
              const slides = Math.round(value);
              set(only.id, (o) => (o.kind === 'slider' ? { ...o, slides } : o), 'slides');
            }}
          />
        </>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={picked.every((o) => o.combo)}
          data-testid="bmed-note-combo"
          onChange={() => onCommit((m) => toggleCombo(m, selected))}
        />
        <span>{t('bmed.combo')}</span>
      </label>
      <button
        type="button"
        className="ie-button ie-button--quiet"
        data-danger
        data-testid="bmed-delete-notes"
        onClick={() => {
          onCommit((m) => removeObjects(m, selected));
          onSelect(new Set());
        }}
      >
        <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('bmed.deleteNotes')}
      </button>
    </div>
  );
}
