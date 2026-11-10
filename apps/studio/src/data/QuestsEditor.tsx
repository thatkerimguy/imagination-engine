import { createId } from '@ie/core';
import type { QuestDef, StoryProject } from '@ie/story';
import { Plus, X } from 'lucide-react';
import { useMemo } from 'react';
import { newQuest } from '../project/factory-rpg.ts';
import { useProject } from '../project/store.ts';
import { countUsages } from '../project/usages.ts';
import { useT } from '../store.ts';
import { nextName } from '../write/edit.ts';
import { DeleteButton } from './DeleteButton.tsx';
import { LabelFields } from './LabelFields.tsx';

/** Quests: a name and the steps the journal shows, in both languages. */
export function QuestsEditor({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const usages = useMemo(() => countUsages(doc).quests, [doc]);
  const quests = doc.quests ?? [];
  const set = (id: string, change: (q: QuestDef) => QuestDef, key = `quest:${id}`) =>
    edit(
      (d) => ({ ...d, quests: (d.quests ?? []).map((q) => (q.id === id ? change(q) : q)) }),
      key,
    );

  return (
    <div className="cards" data-testid="quests">
      {quests.length === 0 && <p className="hint">{t('quests.empty')}</p>}
      {quests.map((quest) => (
        <section className="card" key={quest.id} data-testid="quest">
          <div className="card__grid">
            <LabelFields
              value={quest.name}
              testId="quest-name"
              onChange={(name) => set(quest.id, (x) => ({ ...x, name }))}
            />
          </div>
          <span className="ie-label">{t('quests.steps')}</span>
          {quest.steps.map((step, index) => (
            <div className="row row--wrap" key={step.id}>
              <span className="hint">{index + 1}</span>
              {(['en', 'tr'] as const).map((locale) => (
                <input
                  key={locale}
                  className="field"
                  lang={locale}
                  aria-label={`${t('quest.stepBase')} ${index + 1} (${t(locale === 'en' ? 'language.en' : 'language.tr')})`}
                  value={step.text[locale] ?? ''}
                  data-testid={`quest-step-${locale}`}
                  onChange={(e) =>
                    set(
                      quest.id,
                      (x) => ({
                        ...x,
                        steps: x.steps.with(index, {
                          ...step,
                          text: { ...step.text, [locale]: e.target.value },
                        }),
                      }),
                      `step:${step.id}:${locale}`,
                    )
                  }
                />
              ))}
              <button
                type="button"
                className="ie-button ie-button--quiet"
                aria-label={t('quests.removeStep')}
                title={t('quests.removeStep')}
                disabled={quest.steps.length <= 1}
                onClick={() =>
                  set(quest.id, (x) => ({ ...x, steps: x.steps.toSpliced(index, 1) }), '')
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
              data-testid="add-step"
              onClick={() => {
                const name = `${t('quest.stepBase')} ${quest.steps.length + 1}`;
                set(
                  quest.id,
                  (x) => ({
                    ...x,
                    steps: [...x.steps, { id: createId('st'), text: { en: name, tr: name } }],
                  }),
                  '',
                );
              }}
            >
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('quests.addStep')}
            </button>
          </div>
          <div className="card__foot">
            <span className="hint">{t('data.uses', { count: usages.get(quest.id) ?? 0 })}</span>
            <DeleteButton
              uses={usages.get(quest.id) ?? 0}
              onDelete={() =>
                edit((d) => ({ ...d, quests: (d.quests ?? []).filter((x) => x.id !== quest.id) }))
              }
            />
          </div>
        </section>
      ))}
      <button
        type="button"
        className="ie-button"
        data-testid="add-quest"
        onClick={() => {
          const name = nextName(
            t('quest.base'),
            quests.map((q) => q.name.en ?? ''),
          );
          const step = t('quest.firstStep');
          const quest = newQuest({ en: name, tr: name }, { en: step, tr: step });
          edit((d) => ({ ...d, quests: [...(d.quests ?? []), quest] }));
        }}
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('quests.add')}
      </button>
    </div>
  );
}
