import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { DeleteButton } from '../data/DeleteButton.tsx';
import { useDoc, useProject } from '../project/store.ts';
import { countUsages } from '../project/usages.ts';
import { useSequencerUi } from '../sequencer/ui.ts';
import { Workbench } from '../sequencer/Workbench.tsx';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { useAddSequence } from '../write/blocks/SequenceEditor.tsx';

/** Sequences: pick or make one, then edit it on the timeline (ADR 0019). */
export function SequencerView() {
  const t = useT();
  const doc = useDoc();
  const edit = useProject((s) => s.edit);
  const locale = useStudio((s) => s.locale);
  const ui = useSequencerUi();
  const add = useAddSequence();
  const sequences = doc.sequences ?? [];
  const current = sequences.find((s) => s.id === ui.sequenceId) ?? sequences[0];
  const uses = useMemo(() => countUsages(doc).sequences, [doc]);
  const name = (s: (typeof sequences)[number]) => labelText(s.name, locale, s.id);
  const make = (kind: 'scene' | 'move') =>
    ui.open(add(kind, t(kind === 'move' ? 'seq.moveBase' : 'seq.sceneBase')));

  return (
    <section className="page page--wide" data-testid="view-sequencer">
      <h2 className="page__title">{t('view.sequencer')}</h2>
      <p className="page__intro">{t('seq.intro')}</p>
      <div className="row row--wrap seq-pick">
        {current && (
          <select
            className="picker"
            aria-label={t('seq.pick')}
            value={current.id}
            data-testid="seq-pick"
            onChange={(e) => ui.open(e.target.value)}
          >
            {(['scene', 'move'] as const).map((kind) => {
              const list = sequences.filter((s) => s.kind === kind);
              return list.length === 0 ? null : (
                <optgroup key={kind} label={t(`seq.kind.${kind}`)}>
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {name(s)}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        )}
        <button
          type="button"
          className="ie-button"
          data-testid="seq-new-scene"
          onClick={() => make('scene')}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('seq.newScene')}
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="seq-new-move"
          onClick={() => make('move')}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('seq.newMove')}
        </button>
        {current && (
          <DeleteButton
            uses={uses.get(current.id) ?? 0}
            onDelete={() => {
              edit((d) => ({
                ...d,
                sequences: (d.sequences ?? []).filter((s) => s.id !== current.id),
              }));
              ui.open(null);
            }}
          />
        )}
      </div>
      {current ? (
        <Workbench key={current.id} sequence={current} />
      ) : (
        <p className="hint" data-testid="seq-empty">
          {t('seq.empty')}
        </p>
      )}
    </section>
  );
}
