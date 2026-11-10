import type { Value } from '@ie/core';
import {
  SCOPES,
  VARIABLE_TYPES,
  defaultValue,
  type StoryProject,
  type VariableDef,
  type VariableType,
} from '@ie/story';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import type { MessageKey } from '../messages.ts';
import { useProject } from '../project/store.ts';
import { countUsages } from '../project/usages.ts';
import { useT } from '../store.ts';
import { nextName, useEditor } from '../write/edit.ts';
import { PlainValue } from '../write/ValueField.tsx';
import { DeleteButton } from './DeleteButton.tsx';

/** A variable of a new type keeps only the settings that still make sense. */
function retype(v: VariableDef, type: VariableType): VariableDef {
  const { id, name, scope, description } = v;
  const base: VariableDef = {
    id,
    name,
    type,
    ...(scope ? { scope } : {}),
    ...(description ? { description } : {}),
  };
  return type === 'enum' ? { ...base, values: v.values?.length ? v.values : ['a', 'b'] } : base;
}

/** Variables: what the story remembers. Type, scope, starting value and a note on what it is for. */
export function VariablesEditor({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const editor = useEditor();
  const edit = useProject((s) => s.edit);
  const usages = useMemo(() => countUsages(doc).variables, [doc]);
  const set = (id: string, change: (v: VariableDef) => VariableDef, merge = true) =>
    edit(
      (d) => ({ ...d, variables: d.variables.map((v) => (v.id === id ? change(v) : v)) }),
      merge ? `variable:${id}` : undefined,
    );
  const optional = <K extends 'min' | 'max' | 'description'>(
    v: VariableDef,
    key: K,
    value: VariableDef[K] | undefined,
  ): VariableDef => {
    const copy = { ...v };
    if (value === undefined || value === '') delete copy[key];
    else copy[key] = value;
    return copy;
  };

  return (
    <div className="cards" data-testid="variables">
      {doc.variables.length === 0 && <p className="hint">{t('variables.empty')}</p>}
      {doc.variables.map((v) => (
        <section className="card" key={v.id} data-testid="variable">
          <div className="card__grid">
            <label className="labelled">
              <span className="ie-label">{t('language.en')}</span>
              <input
                className="field"
                value={v.name.en ?? ''}
                onChange={(e) =>
                  set(v.id, (x) => ({ ...x, name: { ...x.name, en: e.target.value } }))
                }
              />
            </label>
            <label className="labelled">
              <span className="ie-label">{t('language.tr')}</span>
              <input
                className="field"
                lang="tr"
                value={v.name.tr ?? ''}
                onChange={(e) =>
                  set(v.id, (x) => ({ ...x, name: { ...x.name, tr: e.target.value } }))
                }
              />
            </label>
            <label className="labelled">
              <span className="ie-label">{t('variables.type')}</span>
              <select
                className="picker"
                value={v.type}
                onChange={(e) => set(v.id, (x) => retype(x, e.target.value as VariableType), false)}
              >
                {VARIABLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`type.${type}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="labelled">
              <span className="ie-label">{t('variables.scope')}</span>
              <select
                className="picker"
                value={v.scope ?? 'game'}
                onChange={(e) =>
                  set(v.id, (x) => ({ ...x, scope: e.target.value as VariableDef['scope'] }), false)
                }
              >
                {SCOPES.map((scope) => (
                  <option key={scope} value={scope}>
                    {t(`scope.${scope}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
            {v.type !== 'list' && (
              <label className="labelled">
                <span className="ie-label">{t('variables.default')}</span>
                <PlainValue
                  type={v.type}
                  values={v.values}
                  value={defaultValue(v)}
                  label={t('variables.default')}
                  onChange={(value: Value) => set(v.id, (x) => ({ ...x, default: value }))}
                />
              </label>
            )}
            {v.type === 'enum' && (
              <label className="labelled labelled--wide">
                <span className="ie-label">{t('variables.values')}</span>
                <input
                  className="field"
                  value={(v.values ?? []).join(', ')}
                  onChange={(e) => {
                    const values = e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    set(v.id, (x) => ({ ...x, values }));
                  }}
                />
              </label>
            )}
            {v.type === 'number' && (
              <>
                <label className="labelled">
                  <span className="ie-label">{t('variables.min')}</span>
                  <input
                    className="field field--number"
                    type="number"
                    inputMode="decimal"
                    value={v.min ?? ''}
                    onChange={(e) =>
                      set(v.id, (x) =>
                        optional(
                          x,
                          'min',
                          e.target.value === '' ? undefined : Number(e.target.value),
                        ),
                      )
                    }
                  />
                </label>
                <label className="labelled">
                  <span className="ie-label">{t('variables.max')}</span>
                  <input
                    className="field field--number"
                    type="number"
                    inputMode="decimal"
                    value={v.max ?? ''}
                    onChange={(e) =>
                      set(v.id, (x) =>
                        optional(
                          x,
                          'max',
                          e.target.value === '' ? undefined : Number(e.target.value),
                        ),
                      )
                    }
                  />
                </label>
              </>
            )}
          </div>
          <label className="labelled">
            <span className="ie-label">{t('variables.description')}</span>
            <input
              className="field"
              value={v.description ?? ''}
              placeholder={t('variables.descriptionPlaceholder')}
              onChange={(e) => set(v.id, (x) => optional(x, 'description', e.target.value))}
            />
          </label>
          <p className="hint">{t(`scopeHint.${v.scope ?? 'game'}` as MessageKey)}</p>
          <div className="card__foot">
            <span className="hint">{t('data.uses', { count: usages.get(v.id) ?? 0 })}</span>
            <DeleteButton
              uses={usages.get(v.id) ?? 0}
              onDelete={() =>
                edit((d) => ({ ...d, variables: d.variables.filter((x) => x.id !== v.id) }))
              }
            />
          </div>
        </section>
      ))}
      <button
        type="button"
        className="ie-button"
        data-testid="add-variable"
        onClick={() =>
          editor.addVariable(
            'number',
            (() => {
              const name = nextName(
                t('variable.base'),
                doc.variables.map((v) => v.name.en ?? ''),
              );
              return { en: name, tr: name };
            })(),
          )
        }
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('variables.add')}
      </button>
    </div>
  );
}
