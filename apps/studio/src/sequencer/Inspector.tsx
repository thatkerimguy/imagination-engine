import {
  isAudioAction,
  NOTE_KINDS,
  type ActionBlock,
  type Block,
  type SequenceClip,
  type SequenceDef,
  type SequenceNote,
} from '@ie/story';
import { Copy, Scissors, Trash2 } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { useDoc } from '../project/store.ts';
import { useT } from '../store.ts';
import { AudioEditor } from '../write/blocks/AudioEditors.tsx';
import { StageEditor } from '../write/blocks/StageEditors.tsx';
import { WriteCtx, type WriteContext } from '../write/context.ts';
import { useEditor, useWriteLocale } from '../write/edit.ts';
import { blockName } from '../write/blockInfo.ts';
import { CLIP_KINDS, findItem, newClip, type ClipKind } from './edit.ts';
import { clipKind, noteName } from './labels.ts';

const POWERS = [0.5, 0.75, 1, 1.5, 2] as const;
const NO_PROBLEMS = new Map();

export interface InspectorProps {
  readonly sequence: SequenceDef;
  readonly selected: string | null;
  /** Changes the selected clip or note; drags and typing pass a merge key. */
  readonly change: (
    change: (item: SequenceClip | SequenceNote) => SequenceClip | SequenceNote,
    mergeKey?: string,
  ) => void;
  readonly canSplit: boolean;
  readonly onSplit: () => void;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
}

const toBlock = (clip: SequenceClip): ActionBlock => ({
  id: clip.id,
  type: 'action',
  action: clip.action,
  ...(clip.params ? { params: clip.params } : {}),
});

/** A number field for beats (shown counted from 1, like bars and beats on the ruler). */
function BeatField({
  label,
  value,
  min,
  max,
  offset,
  testId,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly offset: number;
  readonly testId: string;
  readonly onChange: (beat: number) => void;
}) {
  return (
    <label className="inline-field">
      <span>{label}</span>
      <input
        className="field field--number"
        type="number"
        inputMode="decimal"
        min={min + offset}
        max={max + offset}
        step={0.25}
        value={Math.round((value + offset) * 1000) / 1000}
        data-testid={testId}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n - offset)));
        }}
      />
    </label>
  );
}

/** Settings of the selected clip (its sentence, as in Write) or note, and its time. */
export function Inspector(props: InspectorProps) {
  const t = useT();
  const doc = useDoc();
  const editor = useEditor();
  const locale = useWriteLocale();
  const { sequence, selected, change } = props;
  const found = findItem(sequence, selected);

  // The block editors edit "blocks": route their edits back into the selected clip.
  const ctx = useMemo<WriteContext>(
    () => ({
      doc,
      locale,
      problems: NO_PROBLEMS,
      editor: {
        ...editor,
        block: (_id: string, edit: (b: Block) => Block, mergeKey?: string) =>
          change((item) => {
            if (!('action' in item)) return item;
            const next = edit(toBlock(item));
            if (next.type !== 'action') return item;
            const { params: _old, ...rest } = item;
            return {
              ...rest,
              action: next.action,
              ...(next.params ? { params: next.params } : {}),
            };
          }, mergeKey),
      },
    }),
    [doc, locale, editor, change],
  );

  if (!found) return <p className="hint">{t('seq.nothingSelected')}</p>;
  const { item, track } = found;
  const at = (
    <BeatField
      label={t('seq.at')}
      value={item.at}
      min={0}
      max={Math.max(0, sequence.length - 0.0625)}
      offset={1}
      testId="seq-at"
      onChange={(beat) => change((i) => ({ ...i, at: beat }), `at:${item.id}`)}
    />
  );

  let body: ReactNode;
  if ('action' in item) {
    const kinds = track.kind === 'notes' ? [] : (CLIP_KINDS[track.kind] as readonly ClipKind[]);
    const kind = clipKind(item);
    body = (
      <>
        <div className="row row--wrap">
          {kinds.length > 1 && (
            <label className="inline-field">
              <span>{t('seq.kind')}</span>
              <select
                className="picker"
                value={kind}
                data-testid="seq-clip-kind"
                onChange={(e) => {
                  const next = kinds.find((k) => k === e.target.value);
                  if (!next) return;
                  const sound = doc.audio?.sounds[0]?.id;
                  const fresh = newClip(next, item.at, sound);
                  change((i) => ({ ...fresh, id: i.id }));
                }}
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {t(blockName(k))}
                  </option>
                ))}
              </select>
            </label>
          )}
          {at}
          {item.length !== undefined && (
            <BeatField
              label={t('seq.length')}
              value={item.length}
              min={0.0625}
              max={sequence.length - item.at}
              offset={0}
              testId="seq-length"
              onChange={(length) => change((i) => ({ ...i, length }), `len:${item.id}`)}
            />
          )}
        </div>
        <WriteCtx.Provider value={ctx}>
          {isAudioAction(item.action) ? (
            <AudioEditor block={toBlock(item)} />
          ) : (
            <StageEditor block={toBlock(item)} timed={false} />
          )}
        </WriteCtx.Provider>
      </>
    );
  } else {
    const kinds = sequence.kind === 'move' ? NOTE_KINDS.filter((k) => k !== 'strike') : NOTE_KINDS;
    body = (
      <div className="row row--wrap">
        <Segmented
          label={t('seq.kind')}
          value={item.kind}
          options={kinds.map((k) => ({ value: k, label: t(noteName(k)) }))}
          onChange={(kind) => change((i) => ({ ...i, kind }))}
        />
        {at}
        <label className="inline-field">
          <span>{t('seq.power')}</span>
          <select
            className="picker"
            value={String(item.power ?? 1)}
            onChange={(e) =>
              change((i) => {
                const power = Number(e.target.value);
                const { power: _old, ...rest } = i as SequenceNote;
                return power === 1 ? rest : { ...rest, power };
              })
            }
          >
            {POWERS.map((p) => (
              <option key={p} value={String(p)}>{`×${p}`}</option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="stack" data-testid="seq-inspector">
      {body}
      <div className="row row--wrap">
        {props.canSplit && (
          <button
            type="button"
            className="ie-button ie-button--quiet"
            data-testid="seq-split"
            onClick={props.onSplit}
          >
            <Scissors size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('seq.split')}
          </button>
        )}
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="seq-duplicate"
          onClick={props.onDuplicate}
        >
          <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('seq.duplicate')}
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-danger
          data-testid="seq-remove"
          onClick={props.onRemove}
        >
          <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('seq.remove')}
        </button>
      </div>
    </div>
  );
}
