import { createId } from '@ie/core';
import {
  listKey,
  PARAM_TYPES,
  type ParamType,
  type RoutineDef,
  type RoutineParam,
  type StoryProject,
} from '@ie/story';
import { Plus, X } from 'lucide-react';
import { useMemo } from 'react';
import type { MessageKey } from '../messages.ts';
import { useProject } from '../project/store.ts';
import { countUsages } from '../project/usages.ts';
import { useT } from '../store.ts';
import { DeleteButton } from '../data/DeleteButton.tsx';
import { BlockList } from '../write/BlockList.tsx';
import { useWrite, WriteCtx } from '../write/context.ts';
import { nextName } from '../write/edit.ts';

/**
 * The routine's blocks see its inputs as variables: pickers and text fields list them next to
 * the story's variables, while edits still go to the real project.
 */
function useRoutineCtx(routine: RoutineDef) {
  const ctx = useWrite();
  return useMemo(() => {
    const inputs = (routine.params ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      scope: 'temp' as const,
    }));
    return { ...ctx, doc: { ...ctx.doc, variables: [...ctx.doc.variables, ...inputs] } };
  }, [ctx, routine.params]);
}

/** One routine: its name, typed inputs, and the blocks it runs. */
export function RoutineCard({
  doc,
  routine,
}: {
  readonly doc: StoryProject;
  readonly routine: RoutineDef;
}) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const inner = useRoutineCtx(routine);
  const uses = useMemo(() => countUsages(doc).routines.get(routine.id) ?? 0, [doc, routine.id]);
  const params = routine.params ?? [];
  const set = (change: (r: RoutineDef) => RoutineDef, key?: string) =>
    edit(
      (d) => ({
        ...d,
        routines: (d.routines ?? []).map((r) => (r.id === routine.id ? change(r) : r)),
      }),
      key,
    );
  const setParams = (next: readonly RoutineParam[], key?: string) =>
    set((r) => ({ ...r, params: next }), key);

  return (
    <section className="card logic-card" data-testid="routine">
      <label className="labelled">
        <span className="ie-label">{t('routines.name')}</span>
        <input
          className="field"
          value={routine.name}
          data-testid="routine-name"
          onChange={(e) =>
            set((r) => ({ ...r, name: e.target.value.slice(0, 80) }), `routine:${routine.id}:name`)
          }
        />
      </label>
      <div className="branch">
        <span className="branch__label">{t('routines.inputs')}</span>
        {params.map((param, index) => (
          <div className="row row--wrap" key={param.id}>
            {(['en', 'tr'] as const).map((locale) => (
              <input
                key={locale}
                className="field"
                lang={locale}
                aria-label={`${t('routines.inputBase')} (${t(locale === 'en' ? 'language.en' : 'language.tr')})`}
                value={param.name[locale] ?? ''}
                onChange={(e) =>
                  setParams(
                    params.with(index, {
                      ...param,
                      name: { ...param.name, [locale]: e.target.value },
                    }),
                    `param:${param.id}:${locale}`,
                  )
                }
              />
            ))}
            <select
              className="picker"
              aria-label={t('variables.type')}
              value={param.type}
              onChange={(e) =>
                setParams(params.with(index, { ...param, type: e.target.value as ParamType }))
              }
            >
              {PARAM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`type.${type}` as MessageKey)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ie-button ie-button--quiet"
              aria-label={t('routines.removeInput')}
              title={t('routines.removeInput')}
              onClick={() => setParams(params.toSpliced(index, 1))}
            >
              <X size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        ))}
        <div className="row row--wrap">
          <button
            type="button"
            className="ie-button ie-button--quiet"
            data-testid="routine-add-input"
            disabled={params.length >= 8}
            onClick={() => {
              const name = nextName(
                t('routines.inputBase'),
                params.map((p) => p.name.en ?? ''),
              );
              setParams([
                ...params,
                { id: createId('in'), name: { en: name, tr: name }, type: 'number' },
              ]);
            }}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('routines.addInput')}
          </button>
          {params.length > 0 && <span className="hint">{t('routines.inputHint')}</span>}
        </div>
      </div>
      <div className="branch">
        <span className="branch__label">{t('routines.blocks')}</span>
        <WriteCtx.Provider value={inner}>
          <BlockList
            listKey={listKey.routine(routine.id)}
            blocks={routine.blocks}
            nested
            testId="routine-blocks"
          />
        </WriteCtx.Provider>
      </div>
      <div className="card__foot">
        <span className="hint">{t('data.uses', { count: uses })}</span>
        <DeleteButton
          uses={uses}
          onDelete={() =>
            edit((d) => ({
              ...d,
              routines: (d.routines ?? []).filter((r) => r.id !== routine.id),
            }))
          }
        />
      </div>
    </section>
  );
}
