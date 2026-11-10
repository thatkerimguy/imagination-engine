import { trackTempo } from '@ie/audio';
import { beatsPerBarOf, SEQUENCE_LIMITS, type SequenceDef } from '@ie/story';
import { useDoc } from '../project/store.ts';
import { useT } from '../store.ts';
import { setLength } from './edit.ts';

/** A whole-number field that only reports values inside its range. */
function NumberField({
  label,
  value,
  min,
  max,
  testId,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly testId?: string;
  readonly onChange: (n: number) => void;
}) {
  return (
    <label className="inline-field">
      <span>{label}</span>
      <input
        className="field field--number"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        data-testid={testId}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
      />
    </label>
  );
}

/** A sequence's names, song, tempo and length. */
export function Settings({
  sequence,
  change,
}: {
  readonly sequence: SequenceDef;
  readonly change: (change: (s: SequenceDef) => SequenceDef, mergeKey?: string) => void;
}) {
  const t = useT();
  const doc = useDoc();
  const tracks = doc.audio?.tracks ?? [];
  const song = sequence.track ? tracks.find((tr) => tr.id === sequence.track) : undefined;
  const songTempo = trackTempo(song);
  const bpb = songTempo?.beatsPerBar ?? beatsPerBarOf(sequence);
  const scene = sequence.kind === 'scene';
  const { bars, moveBeats, bpm, beatsPerBar } = SEQUENCE_LIMITS;

  return (
    <fieldset className="seq-settings" data-testid="seq-settings">
      <legend>{t('seq.settings')}</legend>
      <div className="row row--wrap">
        {doc.languages.map((language) => (
          <label key={language} className="labelled">
            <span className="ie-label">
              {t('seq.name', { language: t(`language.${language}`) })}
            </span>
            <input
              className="field"
              lang={language}
              value={sequence.name[language] ?? ''}
              data-testid={`seq-name-${language}`}
              onChange={(e) =>
                change(
                  (s) => ({ ...s, name: { ...s.name, [language]: e.target.value } }),
                  `seq-name:${sequence.id}:${language}`,
                )
              }
            />
          </label>
        ))}
      </div>
      <div className="row row--wrap">
        {scene && (
          <label className="inline-field">
            <span>{t('seq.song')}</span>
            <select
              className="picker"
              value={sequence.track ?? ''}
              data-testid="seq-song"
              onChange={(e) =>
                change((s) => {
                  const { track: _old, ...rest } = s;
                  return e.target.value ? { ...rest, track: e.target.value } : rest;
                })
              }
            >
              <option value="">{t('seq.noSong')}</option>
              {tracks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.title || tr.id}
                </option>
              ))}
            </select>
          </label>
        )}
        {!songTempo && (
          <>
            <NumberField
              label={t('seq.bpm')}
              value={Math.round(sequence.bpm ?? bpm.default)}
              min={bpm.min}
              max={bpm.max}
              testId="seq-bpm"
              onChange={(n) => change((s) => ({ ...s, bpm: n }), `seq-bpm:${sequence.id}`)}
            />
            {scene && (
              <NumberField
                label={t('seq.beatsPerBar')}
                value={bpb}
                min={beatsPerBar.min}
                max={beatsPerBar.max}
                onChange={(n) => change((s) => ({ ...s, beatsPerBar: n }))}
              />
            )}
          </>
        )}
        {scene ? (
          <NumberField
            label={t('seq.lengthBars')}
            value={Math.ceil(sequence.length / bpb)}
            min={bars.min}
            max={bars.max}
            testId="seq-length-bars"
            onChange={(n) => change((s) => setLength(s, n * bpb), `seq-len:${sequence.id}`)}
          />
        ) : (
          <NumberField
            label={t('seq.lengthBeats')}
            value={Math.ceil(sequence.length)}
            min={moveBeats.min}
            max={moveBeats.max}
            testId="seq-length-beats"
            onChange={(n) => change((s) => setLength(s, n), `seq-len:${sequence.id}`)}
          />
        )}
      </div>
      {song && !songTempo && <p className="hint">{t('seq.songNoGrid')}</p>}
      {songTempo && (
        <p className="hint">
          {t('seq.songGrid', { bpm: Math.round(songTempo.bpm), beats: songTempo.beatsPerBar })}
        </p>
      )}
      {!scene && <p className="hint">{t('seq.moveHint')}</p>}
    </fieldset>
  );
}
