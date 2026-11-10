import type { SequenceBlock, SequenceKind, StoryProject } from '@ie/story';
import { Film } from 'lucide-react';
import { runAction } from '../../kernel.ts';
import { useProject } from '../../project/store.ts';
import { newSequence } from '../../sequencer/edit.ts';
import { useSequencerUi } from '../../sequencer/ui.ts';
import { useStudio, useT } from '../../store.ts';
import { useWrite } from '../context.ts';
import { labelText, nextName } from '../edit.ts';
import { Sentence } from '../Sentence.tsx';

const NEW = '__new__';

/** Adds a new sequence of `kind` to the project and returns its ID. */
export function useAddSequence(): (kind: SequenceKind, base: string) => string {
  const edit = useProject((s) => s.edit);
  const locale = useStudio((s) => s.locale);
  return (kind, base) => {
    const doc = useProject.getState().history?.present;
    const names = (doc?.sequences ?? []).map((s) => labelText(s.name, locale, s.id));
    const name = nextName(base, names);
    const sequence = newSequence(kind, { en: name, tr: name });
    edit((d) => ({ ...d, sequences: [...(d.sequences ?? []), sequence] }));
    return sequence.id;
  };
}

/** Opens a sequence in the Sequences workspace. */
export function openSequence(id: string): void {
  useSequencerUi.getState().open(id);
  runAction('studio.view.open', { view: 'sequencer' });
}

/** Picks a sequence of one kind; the last entry makes a new one. */
export function SequencePicker({
  doc,
  kind,
  value,
  label,
  none,
  newLabel,
  testId,
  onChange,
}: {
  readonly doc: StoryProject;
  readonly kind: SequenceKind;
  readonly value: string;
  readonly label: string;
  /** Label of the "none" entry, when choosing none is allowed. */
  readonly none?: string;
  readonly newLabel: string;
  readonly testId?: string;
  readonly onChange: (id: string) => void;
}) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const add = useAddSequence();
  const sequences = (doc.sequences ?? []).filter((s) => s.kind === kind);
  return (
    <select
      className="picker"
      aria-label={label}
      value={value}
      data-testid={testId}
      onChange={(e) => {
        if (e.target.value !== NEW) return onChange(e.target.value);
        onChange(add(kind, t(kind === 'move' ? 'seq.moveBase' : 'seq.sceneBase')));
      }}
    >
      {none !== undefined && <option value="">{none}</option>}
      {none === undefined && !sequences.some((s) => s.id === value) && (
        <option value={value}>{t('sequenceBlock.pick')}</option>
      )}
      {sequences.map((s) => (
        <option key={s.id} value={s.id}>
          {labelText(s.name, locale, s.id)}
        </option>
      ))}
      <option value={NEW}>{newLabel}</option>
    </select>
  );
}

/** Play {sequence}, waiting until it ends or not, with a way into the timeline. */
export function SequenceBlockEditor({ block }: { readonly block: SequenceBlock }) {
  const t = useT();
  const { doc, editor } = useWrite();
  const set = (change: (b: SequenceBlock) => SequenceBlock) =>
    editor.block(block.id, (b) => change(b as SequenceBlock));
  return (
    <div className="stack">
      <div className="row row--wrap">
        <Sentence
          template={t('sequenceBlock.sentence')}
          slots={{
            sequence: (
              <SequencePicker
                doc={doc}
                kind="scene"
                value={block.sequence}
                label={t('sequenceBlock.label')}
                newLabel={t('sequenceBlock.new')}
                testId="sequence-block-pick"
                onChange={(sequence) => set((b) => ({ ...b, sequence }))}
              />
            ),
          }}
        />
        <label className="inline-field">
          <input
            type="checkbox"
            checked={block.wait !== false}
            data-testid="sequence-block-wait"
            onChange={(e) =>
              set((b) => {
                const { wait: _old, ...rest } = b;
                return e.target.checked ? rest : { ...rest, wait: false };
              })
            }
          />
          <span>{t('sequenceBlock.wait')}</span>
        </label>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          disabled={!doc.sequences?.some((s) => s.id === block.sequence)}
          data-testid="sequence-block-edit"
          onClick={() => openSequence(block.sequence)}
        >
          <Film size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('sequenceBlock.edit')}
        </button>
      </div>
      <p className="hint">{t('sequenceBlock.hint')}</p>
    </div>
  );
}
