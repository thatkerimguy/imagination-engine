import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { RoutineCard } from '../logic/RoutineCard.tsx';
import { RuleCard } from '../logic/RuleCard.tsx';
import { newRoutine, newRule } from '../project/factory-rpg.ts';
import type { LocatedProblem } from '../project/problems.ts';
import { useDoc } from '../project/store.ts';
import { useT } from '../store.ts';
import { WriteCtx, type WriteContext } from '../write/context.ts';
import { nextName, useEditor, useWriteLocale } from '../write/edit.ts';
import { useProblems } from './WriteView.tsx';

/** Logic: rules (When → If → Do) and routines (named blocks with inputs), built from blocks. */
export function LogicView() {
  const t = useT();
  const doc = useDoc();
  const editor = useEditor();
  const locale = useWriteLocale();
  const problems = useProblems();
  const [tab, setTab] = useState<'rules' | 'routines'>('rules');
  const byBlock = useMemo(() => {
    const map = new Map<string, LocatedProblem[]>();
    for (const p of problems) if (p.blockId) map.set(p.blockId, [...(map.get(p.blockId) ?? []), p]);
    return map;
  }, [problems]);
  const ctx: WriteContext = useMemo(
    () => ({ doc, editor, locale, problems: byBlock }),
    [doc, editor, locale, byBlock],
  );
  const rules = doc.rules ?? [];
  const routines = doc.routines ?? [];

  return (
    <WriteCtx.Provider value={ctx}>
      <section className="page page--wide" data-testid="view-logic">
        <h2 className="page__title">{t('view.logic')}</h2>
        <Segmented
          label={t('view.logic')}
          value={tab}
          options={[
            { value: 'rules', label: t('logic.rules') },
            { value: 'routines', label: t('logic.routines') },
          ]}
          onChange={setTab}
        />
        <div className="page__body cards">
          {tab === 'rules' ? (
            <>
              {rules.length === 0 && <p className="hint">{t('rules.empty')}</p>}
              {rules.map((rule) => (
                <RuleCard key={rule.id} doc={doc} rule={rule} />
              ))}
              <button
                type="button"
                className="ie-button"
                data-testid="add-rule"
                onClick={() => {
                  const rule = newRule(
                    nextName(
                      t('rule.base'),
                      rules.map((r) => r.name ?? ''),
                    ),
                  );
                  editor.edit((d) => ({ ...d, rules: [...(d.rules ?? []), rule] }));
                }}
              >
                <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                {t('rules.add')}
              </button>
            </>
          ) : (
            <>
              {routines.length === 0 && <p className="hint">{t('routines.empty')}</p>}
              {routines.map((routine) => (
                <RoutineCard key={routine.id} doc={doc} routine={routine} />
              ))}
              <button
                type="button"
                className="ie-button"
                data-testid="add-routine"
                onClick={() => {
                  const routine = newRoutine(
                    nextName(
                      t('routine.base'),
                      routines.map((r) => r.name),
                    ),
                  );
                  editor.edit((d) => ({ ...d, routines: [...(d.routines ?? []), routine] }));
                }}
              >
                <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                {t('routines.add')}
              </button>
            </>
          )}
        </div>
      </section>
    </WriteCtx.Provider>
  );
}
