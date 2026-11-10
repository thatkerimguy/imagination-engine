import type { SkillDef, StoryProject } from '@ie/story';
import { Plus } from 'lucide-react';
import { newSkill } from '../project/factory-rpg.ts';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { ConditionBuilder } from '../write/ConditionBuilder.tsx';
import { nextName } from '../write/edit.ts';
import { DeleteButton } from './DeleteButton.tsx';
import { LabelFields } from './LabelFields.tsx';

/** Skills offered in battles: name, MP cost, damage or heal, power, and when they're available. */
export function SkillsEditor({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const skills = doc.skills ?? [];
  const set = (id: string, change: (s: SkillDef) => SkillDef, key = `skill:${id}`) =>
    edit(
      (d) => ({ ...d, skills: (d.skills ?? []).map((s) => (s.id === id ? change(s) : s)) }),
      key,
    );

  return (
    <div className="cards" data-testid="skills">
      {skills.length === 0 && <p className="hint">{t('skills.empty')}</p>}
      {skills.map((skill) => (
        <section className="card" key={skill.id} data-testid="skill">
          <div className="card__grid">
            <LabelFields
              value={skill.name}
              testId="skill-name"
              onChange={(name) => set(skill.id, (x) => ({ ...x, name }))}
            />
            <label className="labelled">
              <span className="ie-label">{t('skills.does')}</span>
              <select
                className="picker"
                value={skill.heal ? 'heal' : 'harm'}
                onChange={(e) =>
                  set(
                    skill.id,
                    (x) => {
                      const { heal: _old, ...rest } = x;
                      return e.target.value === 'heal'
                        ? { ...rest, heal: true, power: 0.5 }
                        : { ...rest, power: 1.5 };
                    },
                    '',
                  )
                }
              >
                <option value="harm">{t('skills.harm')}</option>
                <option value="heal">{t('skills.heal')}</option>
              </select>
            </label>
            <label className="labelled">
              <span className="ie-label">{t('skills.cost')}</span>
              <input
                className="field field--number"
                type="number"
                min={0}
                max={999}
                inputMode="numeric"
                value={skill.cost ?? 0}
                onChange={(e) =>
                  set(skill.id, (x) => ({
                    ...x,
                    cost: Math.min(999, Math.max(0, Math.round(Number(e.target.value) || 0))),
                  }))
                }
              />
            </label>
            <label className="labelled">
              <span className="ie-label">{t('skills.power')}</span>
              <input
                className="field field--number"
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                inputMode="decimal"
                value={skill.power ?? (skill.heal ? 0.3 : 1.5)}
                onChange={(e) =>
                  set(skill.id, (x) => ({
                    ...x,
                    power: Math.min(10, Math.max(0.1, Number(e.target.value) || 0.1)),
                  }))
                }
              />
            </label>
          </div>
          <p className="hint">{t('skills.powerHint')}</p>
          <div className="branch">
            <span className="branch__label">{t('skills.requires')}</span>
            <ConditionBuilder
              doc={doc}
              value={skill.requires}
              label={t('skills.requires')}
              onChange={(formula) =>
                set(skill.id, (x) => {
                  const { requires: _old, ...rest } = x;
                  return formula === undefined ? rest : { ...rest, requires: formula };
                })
              }
            />
          </div>
          <div className="card__foot">
            <span />
            <DeleteButton
              uses={0}
              onDelete={() =>
                edit((d) => ({ ...d, skills: (d.skills ?? []).filter((x) => x.id !== skill.id) }))
              }
            />
          </div>
        </section>
      ))}
      <button
        type="button"
        className="ie-button"
        data-testid="add-skill"
        onClick={() => {
          const name = nextName(
            t('skill.base'),
            skills.map((s) => s.name.en ?? ''),
          );
          const skill = newSkill({ en: name, tr: name });
          edit((d) => ({ ...d, skills: [...(d.skills ?? []), skill] }));
        }}
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('skills.add')}
      </button>
    </div>
  );
}
