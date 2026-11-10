import {
  DIFFICULTIES,
  FIGHT_BARS,
  FIGHT_MODES,
  listKey,
  type FightBlock,
  type StoryProject,
} from '@ie/story';
import type { MessageKey } from '../../messages.ts';
import { useStudio, useT } from '../../store.ts';
import { BlockList } from '../BlockList.tsx';
import { useWrite } from '../context.ts';
import { labelText, nextName, useEditor } from '../edit.ts';
import { Sentence } from '../Sentence.tsx';
import { SequencePicker } from './SequenceEditor.tsx';

const NEW = '__new__';
const BAR_CHOICES = [8, 16, 24, 32, 48, 64] as const;

/** Picks an enemy, or makes a new one with starter moves and picks that. */
export function EnemyPicker({
  doc,
  value,
  onChange,
}: {
  readonly doc: StoryProject;
  readonly value: string;
  readonly onChange: (id: string) => void;
}) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const editor = useEditor();
  const enemies = doc.enemies ?? [];
  const name = (e: (typeof enemies)[number]) => labelText(e.name, locale, e.id);
  return (
    <select
      className="picker"
      aria-label={t('fightBlock.enemy')}
      value={value}
      data-testid="fight-enemy"
      onChange={(event) => {
        if (event.target.value !== NEW) return onChange(event.target.value);
        const base = nextName(t('enemy.base'), enemies.map(name));
        onChange(editor.addEnemy({ en: base, tr: base }));
      }}
    >
      {!enemies.some((e) => e.id === value) && <option value={value}>{t('pick.enemy')}</option>}
      {enemies.map((e) => (
        <option key={e.id} value={e.id}>
          {name(e)}
        </option>
      ))}
      <option value={NEW}>{t('pick.newEnemy')}</option>
    </select>
  );
}

/** A select over fixed values whose labels come from `prefix.value` message keys. */
function Options<T extends string | number>({
  values,
  value,
  label,
  text,
  onChange,
  testId,
}: {
  readonly values: readonly T[];
  readonly value: T;
  readonly label: string;
  readonly text: (value: T) => string;
  readonly onChange: (value: T) => void;
  readonly testId?: string;
}) {
  return (
    <label className="inline-field">
      <span>{label}</span>
      <select
        className="picker"
        value={String(value)}
        data-testid={testId}
        onChange={(e) => {
          const picked = values.find((v) => String(v) === e.target.value);
          if (picked !== undefined) onChange(picked);
        }}
      >
        {values.map((v) => (
          <option key={String(v)} value={String(v)}>
            {text(v)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Fight {enemy} to {music}; how hard and how long; where the score goes; win and lose branches. */
export function FightEditor({ block }: { readonly block: FightBlock }) {
  const t = useT();
  const { doc, editor } = useWrite();
  const locale = useStudio((s) => s.locale);
  const set = (change: (b: FightBlock) => FightBlock) =>
    editor.block(block.id, (b) => change(b as FightBlock));
  const tracks = doc.audio?.tracks ?? [];
  const numbers = doc.variables.filter((v) => v.type === 'number');
  const bars = block.bars ?? FIGHT_BARS.default;
  const barChoices = BAR_CHOICES.includes(bars as (typeof BAR_CHOICES)[number])
    ? BAR_CHOICES
    : [...BAR_CHOICES, bars].sort((a, b) => a - b);

  return (
    <div className="branches">
      <div className="row row--wrap">
        <Sentence
          template={t('fightBlock.sentence')}
          slots={{
            enemy: (
              <EnemyPicker
                doc={doc}
                value={block.enemy}
                onChange={(enemy) => set((b) => ({ ...b, enemy }))}
              />
            ),
            music: (
              <select
                className="picker"
                aria-label={t('fightBlock.music')}
                value={block.track ?? ''}
                data-testid="fight-music"
                onChange={(e) =>
                  set((b) => {
                    const { track: _old, ...rest } = b;
                    return e.target.value ? { ...rest, track: e.target.value } : rest;
                  })
                }
              >
                <option value="">{t('fightBlock.musicAuto')}</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.title || track.id}
                  </option>
                ))}
              </select>
            ),
          }}
        />
      </div>
      <div className="row row--wrap">
        <Options
          values={DIFFICULTIES}
          value={block.difficulty ?? 'normal'}
          label={t('fightBlock.difficulty')}
          text={(v) => t(`difficulty.${v}` as MessageKey)}
          onChange={(difficulty) => set((b) => ({ ...b, difficulty }))}
          testId="fight-difficulty"
        />
        <Options
          values={FIGHT_MODES}
          value={block.mode ?? 'call'}
          label={t('fightBlock.mode')}
          text={(v) => t(`fightMode.${v}` as MessageKey)}
          onChange={(mode) => set((b) => ({ ...b, mode }))}
          testId="fight-mode"
        />
        <Options
          values={barChoices}
          value={bars}
          label={t('fightBlock.bars')}
          text={(n) => t('fightBlock.barsValue', { n })}
          onChange={(n) => set((b) => ({ ...b, bars: n }))}
          testId="fight-bars"
        />
        <label className="inline-field">
          <span>{t('fightBlock.score')}</span>
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
            <option value="">{t('fightBlock.noScore')}</option>
            {numbers.map((v) => (
              <option key={v.id} value={v.id}>
                {labelText(v.name, locale, v.id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row row--wrap">
        <label className="inline-field">
          <span>{t('fightBlock.chart')}</span>
          <SequencePicker
            doc={doc}
            kind="scene"
            value={block.chart ?? ''}
            label={t('fightBlock.chart')}
            none={t('fightBlock.chartAuto')}
            newLabel={t('sequenceBlock.new')}
            testId="fight-chart"
            onChange={(chart) =>
              set((b) => {
                const { chart: _old, ...rest } = b;
                return chart ? { ...rest, chart } : rest;
              })
            }
          />
        </label>
      </div>
      <p className="hint">{t(block.chart ? 'fightBlock.chartHint' : 'fightBlock.musicHint')}</p>
      <div className="branch">
        <span className="branch__label">{t('fightBlock.win')}</span>
        <BlockList listKey={listKey.win(block.id)} blocks={block.win} nested testId="fight-win" />
      </div>
      <div className="branch">
        <span className="branch__label">{t('fightBlock.lose')}</span>
        <BlockList
          listKey={listKey.lose(block.id)}
          blocks={block.lose}
          nested
          testId="fight-lose"
        />
      </div>
    </div>
  );
}
