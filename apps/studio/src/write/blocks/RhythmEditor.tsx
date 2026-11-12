import { listKey, type RhythmBlock } from '@ie/story';
import { CircleDot } from 'lucide-react';
import { useBeatmapPick } from '../../beatmaps/selection.ts';
import { useStudio, useT } from '../../store.ts';
import { BlockList } from '../BlockList.tsx';
import { useWrite } from '../context.ts';
import { labelText } from '../edit.ts';
import { Sentence } from '../Sentence.tsx';

const PASS_CHOICES = [0, 50, 60, 70, 80, 90, 95] as const;

/** Play {beatmap}; what it takes to win; where the accuracy goes; pass and fail branches. */
export function RhythmEditor({ block }: { readonly block: RhythmBlock }) {
  const t = useT();
  const { doc, editor } = useWrite();
  const locale = useStudio((s) => s.locale);
  const setView = useStudio((s) => s.setView);
  const pick = useBeatmapPick((s) => s.pick);
  const set = (change: (b: RhythmBlock) => RhythmBlock) =>
    editor.block(block.id, (b) => change(b as RhythmBlock));
  const maps = doc.beatmaps ?? [];
  const numbers = doc.variables.filter((v) => v.type === 'number');
  const pass = block.pass ?? 0;
  const passes = (PASS_CHOICES as readonly number[]).includes(pass)
    ? PASS_CHOICES
    : [...PASS_CHOICES, pass].sort((a, b) => a - b);

  return (
    <div className="branches">
      <div className="row row--wrap">
        <Sentence
          template={t('rhythmBlock.sentence')}
          slots={{
            beatmap: (
              <select
                className="picker"
                aria-label={t('rhythmBlock.beatmap')}
                value={block.beatmap}
                data-testid="rhythm-beatmap"
                onChange={(e) => set((b) => ({ ...b, beatmap: e.target.value }))}
              >
                {!maps.some((m) => m.id === block.beatmap) && (
                  <option value={block.beatmap}>{t('rhythmBlock.pick')}</option>
                )}
                {maps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {labelText(m.name, locale, m.id)}
                  </option>
                ))}
              </select>
            ),
          }}
        />
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="rhythm-edit"
          onClick={() => {
            pick(block.beatmap || null);
            setView('beatmaps');
          }}
        >
          <CircleDot size={16} aria-hidden="true" />
          {t('rhythmBlock.edit')}
        </button>
      </div>
      {maps.length === 0 && <p className="hint">{t('rhythmBlock.none')}</p>}
      <div className="row row--wrap">
        <label className="inline-field">
          <span>{t('rhythmBlock.pass')}</span>
          <select
            className="picker"
            value={String(pass)}
            data-testid="rhythm-pass"
            onChange={(e) =>
              set((b) => {
                const { pass: _old, ...rest } = b;
                const n = Number(e.target.value);
                return n > 0 ? { ...rest, pass: n } : rest;
              })
            }
          >
            {passes.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t('rhythmBlock.passAny') : t('rhythmBlock.passValue', { n })}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span>{t('rhythmBlock.score')}</span>
          <select
            className="picker"
            value={block.score ?? ''}
            onChange={(e) =>
              set((b) => {
                const { score: _old, ...rest } = b;
                return e.target.value ? { ...rest, score: e.target.value } : rest;
              })
            }
          >
            <option value="">{t('rhythmBlock.noScore')}</option>
            {numbers.map((v) => (
              <option key={v.id} value={v.id}>
                {labelText(v.name, locale, v.id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="branch">
        <span className="branch__label">{t('rhythmBlock.win')}</span>
        <BlockList listKey={listKey.win(block.id)} blocks={block.win} nested testId="rhythm-win" />
      </div>
      <div className="branch">
        <span className="branch__label">{t('rhythmBlock.lose')}</span>
        <BlockList
          listKey={listKey.lose(block.id)}
          blocks={block.lose}
          nested
          testId="rhythm-lose"
        />
      </div>
    </div>
  );
}
