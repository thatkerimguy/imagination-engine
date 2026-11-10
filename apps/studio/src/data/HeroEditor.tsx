import type { HeroDef, StoryProject } from '@ie/story';
import { Plus } from 'lucide-react';
import type { MessageKey } from '../messages.ts';
import { withHeroStats } from '../project/factory-rpg.ts';
import { useProject } from '../project/store.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';

const STATS = [
  'hp',
  'maxHp',
  'attack',
  'defense',
  'mp',
] as const satisfies readonly (keyof HeroDef)[];

/** Which number variables hold the hero's battle stats, or one button that makes them all. */
export function HeroEditor({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const edit = useProject((s) => s.edit);
  const hero = doc.hero ?? {};
  const numbers = doc.variables.filter((v) => v.type === 'number');
  const complete = STATS.every((key) => hero[key]);

  return (
    <div className="cards" data-testid="hero">
      <p className="hint">{t('hero.intro')}</p>
      <section className="card">
        <div className="card__grid">
          {STATS.map((key) => (
            <label className="labelled" key={key}>
              <span className="ie-label">{t(`hero.${key}` as MessageKey)}</span>
              <select
                className="picker"
                value={hero[key] ?? ''}
                data-testid={`hero-${key}`}
                onChange={(e) =>
                  edit((d) => {
                    const { [key]: _old, ...rest } = d.hero ?? {};
                    return {
                      ...d,
                      hero: e.target.value ? { ...rest, [key]: e.target.value } : rest,
                    };
                  })
                }
              >
                <option value="">{t('hero.none')}</option>
                {numbers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {labelText(v.name, locale, v.id)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>
      {!complete && (
        <button
          type="button"
          className="ie-button"
          data-testid="hero-create"
          onClick={() => edit(withHeroStats)}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('hero.create')}
        </button>
      )}
    </div>
  );
}
