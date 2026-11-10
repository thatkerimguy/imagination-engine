import { ITEM_KINDS, type ItemDef, type ItemKind, type StoryProject } from '@ie/story';
import { Plus, X } from 'lucide-react';
import { useMemo } from 'react';
import type { MessageKey } from '../messages.ts';
import { newItem } from '../project/factory-rpg.ts';
import { useProject } from '../project/store.ts';
import { countUsages } from '../project/usages.ts';
import { useT } from '../store.ts';
import { nextName } from '../write/edit.ts';
import { VariablePicker } from '../write/pickers.tsx';
import { Sentence } from '../write/Sentence.tsx';
import { DeleteButton } from './DeleteButton.tsx';
import { LabelFields } from './LabelFields.tsx';

/** Items: names and descriptions, kind, price, and what using one does. */
export function ItemsEditor({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const usages = useMemo(() => countUsages(doc).items, [doc]);
  const items = doc.items ?? [];
  const set = (id: string, change: (i: ItemDef) => ItemDef, key = `item:${id}`) =>
    edit((d) => ({ ...d, items: (d.items ?? []).map((i) => (i.id === id ? change(i) : i)) }), key);

  return (
    <div className="cards" data-testid="items">
      {items.length === 0 && <p className="hint">{t('items.empty')}</p>}
      {items.map((item) => {
        const effects = item.effects ?? [];
        return (
          <section className="card" key={item.id} data-testid="item">
            <div className="card__grid">
              <LabelFields
                value={item.name}
                testId="item-name"
                onChange={(name) => set(item.id, (x) => ({ ...x, name }))}
              />
              <label className="labelled">
                <span className="ie-label">{t('items.kind')}</span>
                <select
                  className="picker"
                  value={item.kind ?? 'item'}
                  data-testid="item-kind"
                  onChange={(e) =>
                    set(item.id, (x) => ({ ...x, kind: e.target.value as ItemKind }), '')
                  }
                >
                  {ITEM_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`itemKind.${kind}` as MessageKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="labelled">
                <span className="ie-label">{t('items.price')}</span>
                <input
                  className="field field--number"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={item.price ?? 0}
                  data-testid="item-price"
                  onChange={(e) =>
                    set(item.id, (x) => ({
                      ...x,
                      price: Math.max(0, Math.round(Number(e.target.value) || 0)),
                    }))
                  }
                />
              </label>
            </div>
            <div className="card__grid">
              <LabelFields
                value={item.description}
                prefix={t('items.description')}
                onChange={(description) => set(item.id, (x) => ({ ...x, description }))}
              />
            </div>
            <span className="ie-label">{t('items.effects')}</span>
            {effects.map((effect, index) => (
              <div className="row row--wrap" key={index}>
                <Sentence
                  template={t('items.effectSentence')}
                  slots={{
                    amount: (
                      <input
                        className="field field--number"
                        type="number"
                        inputMode="decimal"
                        aria-label={t('items.effects')}
                        value={effect.amount}
                        data-testid="effect-amount"
                        onChange={(e) =>
                          set(item.id, (x) => ({
                            ...x,
                            effects: effects.with(index, {
                              ...effect,
                              amount: Number(e.target.value) || 0,
                            }),
                          }))
                        }
                      />
                    ),
                    var: (
                      <VariablePicker
                        doc={doc}
                        value={effect.var}
                        label={t('items.effects')}
                        types={['number']}
                        onChange={(id) =>
                          set(item.id, (x) => ({
                            ...x,
                            effects: effects.with(index, { ...effect, var: id }),
                          }))
                        }
                      />
                    ),
                  }}
                />
                <button
                  type="button"
                  className="ie-button ie-button--quiet"
                  aria-label={t('items.removeEffect')}
                  title={t('items.removeEffect')}
                  onClick={() =>
                    set(item.id, (x) => ({ ...x, effects: effects.toSpliced(index, 1) }), '')
                  }
                >
                  <X size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            ))}
            <div className="row">
              <button
                type="button"
                className="ie-button ie-button--quiet"
                data-testid="add-effect"
                disabled={effects.length >= 8}
                onClick={() =>
                  set(
                    item.id,
                    (x) => ({
                      ...x,
                      effects: [
                        ...effects,
                        {
                          var:
                            doc.hero?.hp ??
                            doc.variables.find((v) => v.type === 'number')?.id ??
                            '',
                          amount: 10,
                        },
                      ],
                    }),
                    '',
                  )
                }
              >
                <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                {t('items.addEffect')}
              </button>
            </div>
            <div className="card__foot">
              <span className="hint">{t('data.uses', { count: usages.get(item.id) ?? 0 })}</span>
              <DeleteButton
                uses={usages.get(item.id) ?? 0}
                onDelete={() =>
                  edit((d) => ({ ...d, items: (d.items ?? []).filter((x) => x.id !== item.id) }))
                }
              />
            </div>
          </section>
        );
      })}
      <button
        type="button"
        className="ie-button"
        data-testid="add-item"
        onClick={() => {
          const name = nextName(
            t('item.base'),
            items.map((i) => i.name.en ?? ''),
          );
          const item = newItem({ en: name, tr: name });
          edit((d) => ({ ...d, items: [...(d.items ?? []), item] }));
        }}
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('items.add')}
      </button>
    </div>
  );
}
