import { writeOsu } from '@ie/rhythm';
import type { BeatmapCredit, BeatmapDef, BeatmapDifficulty, StoryProject } from '@ie/story';
import { Download } from 'lucide-react';
import { useMemo } from 'react';
import { DeleteButton } from '../data/DeleteButton.tsx';
import { LabelFields } from '../data/LabelFields.tsx';
import { countUsages } from '../project/usages.ts';
import { useT } from '../store.ts';
import { NumberField } from './NumberField.tsx';

interface Props {
  readonly doc: StoryProject;
  readonly map: BeatmapDef;
  readonly onCommit: (change: (map: BeatmapDef) => BeatmapDef, mergeKey?: string) => void;
  readonly onDelete: () => void;
}

const DIALS = ['size', 'approach', 'accuracy', 'drain'] as const;
const TICKS = [0, 1, 2, 4, 8] as const;
const CREDITS = ['title', 'artist', 'mapper'] as const;

function download(map: BeatmapDef, doc: StoryProject): void {
  const track = doc.audio?.tracks.find((t) => t.id === map.track);
  const file = track?.source.kind === 'file' ? (track.source.path.split('/').pop() ?? '') : '';
  const blob = new Blob([writeOsu(map, file || 'audio.mp3')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const name = (map.name.en || map.name.tr || 'beatmap').replace(/[^\p{L}\p{N}]+/gu, '-');
  link.download = `${name}.osu`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function withCredit(map: BeatmapDef, key: keyof BeatmapCredit, value: string): BeatmapDef {
  const credit: BeatmapCredit = { ...map.credit, [key]: value };
  const kept = Object.fromEntries(Object.entries(credit).filter(([, v]) => v)) as BeatmapCredit;
  const { credit: _old, ...rest } = map;
  return Object.keys(kept).length > 0 ? { ...rest, credit: kept } : rest;
}

/** The beatmap's name, song, dials and credits; download as .osu; delete. */
export function BeatmapSettings({ doc, map, onCommit, onDelete }: Props) {
  const t = useT();
  const uses = useMemo(() => countUsages(doc).beatmaps.get(map.id) ?? 0, [doc, map.id]);
  const tracks = doc.audio?.tracks ?? [];
  const dial = (key: keyof BeatmapDifficulty, value: number) =>
    onCommit((m) => ({ ...m, difficulty: { ...m.difficulty, [key]: value } }), `dial:${map.id}:${key}`);

  return (
    <div className="stack bmed__settings" data-testid="bmed-settings">
      <div className="row row--wrap">
        <LabelFields
          prefix={t('bmed.name')}
          value={map.name}
          testId="bmed-name"
          onChange={(name) => onCommit((m) => ({ ...m, name }), `name:${map.id}`)}
        />
      </div>
      <div className="row row--wrap">
        <label className="labelled">
          <span className="ie-label">{t('bmed.song')}</span>
          <select
            className="picker"
            value={map.track ?? ''}
            data-testid="bmed-song"
            onChange={(e) => {
              const track = e.target.value;
              onCommit((m) => {
                const { track: _old, ...rest } = m;
                return track ? { ...rest, track } : rest;
              });
            }}
          >
            <option value="">{t('bmed.noTrack')}</option>
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.artist ? `${track.title} · ${track.artist}` : track.title}
              </option>
            ))}
          </select>
        </label>
        <NumberField
          label={t('bmed.lead')}
          value={map.lead ?? 0}
          min={0}
          max={10000}
          onCommit={(value) => {
            const lead = Math.round(value);
            onCommit((m) => {
              const { lead: _old, ...rest } = m;
              return lead > 0 ? { ...rest, lead } : rest;
            });
          }}
        />
        <label className="labelled">
          <span className="ie-label">{t('bmed.ticks')}</span>
          <select
            className="picker"
            value={map.ticks ?? 1}
            onChange={(e) => {
              const ticks = Number(e.target.value);
              onCommit((m) => {
                const { ticks: _old, ...rest } = m;
                return ticks === 1 ? rest : { ...rest, ticks };
              });
            }}
          >
            {TICKS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t('bmed.ticksNone') : String(n)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="bmed__dials">
        {DIALS.map((key) => (
          <label className="labelled" key={key}>
            <span className="ie-label">
              {t(`bmed.${key}`)} · {map.difficulty[key].toFixed(1)}
            </span>
            <input
              className="ie-range"
              type="range"
              min={0}
              max={10}
              step={0.1}
              value={map.difficulty[key]}
              data-testid={`bmed-dial-${key}`}
              onChange={(e) => dial(key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
      <fieldset className="stack bmed__credit">
        <legend className="ie-label">{t('bmed.credit')}</legend>
        <div className="row row--wrap">
          {CREDITS.map((key) => (
            <label className="labelled" key={key}>
              <span className="ie-label">{t(`bmed.credit.${key}`)}</span>
              <input
                className="field"
                maxLength={200}
                value={map.credit?.[key] ?? ''}
                onChange={(e) =>
                  onCommit((m) => withCredit(m, key, e.target.value), `credit:${map.id}:${key}`)
                }
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="row row--wrap">
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="bmed-export"
          onClick={() => download(map, doc)}
        >
          <Download size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('bmed.export')}
        </button>
        <span className="hint">{t('data.uses', { count: uses })}</span>
        <DeleteButton uses={uses} onDelete={onDelete} />
      </div>
    </div>
  );
}
