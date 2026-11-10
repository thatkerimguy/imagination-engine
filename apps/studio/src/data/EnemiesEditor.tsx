import { STAGE_COLORS, type EnemyDef, type StoryProject } from '@ie/story';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import type { MessageKey } from '../messages.ts';
import { useProject } from '../project/store.ts';
import { countUsages } from '../project/usages.ts';
import { useT } from '../store.ts';
import { nextName, useEditor } from '../write/edit.ts';
import { DeleteButton } from './DeleteButton.tsx';
import { EnemyMoves } from './EnemyMoves.tsx';

const HP = [50, 75, 100, 150, 200, 300] as const;
const ATTACK = [5, 8, 10, 15, 20, 30] as const;

/** A select over numbers, keeping a value that isn't one of the presets. */
function NumberChoice({
  values,
  value,
  label,
  onChange,
}: {
  readonly values: readonly number[];
  readonly value: number;
  readonly label: string;
  readonly onChange: (n: number) => void;
}) {
  const all = values.includes(value) ? values : [...values, value].sort((a, b) => a - b);
  return (
    <label className="labelled">
      <span className="ie-label">{label}</span>
      <select
        className="picker"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {all.map((v) => (
          <option key={v} value={String(v)}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Enemies for Fight blocks: names, strength, damage, colour, the words around them, their moves. */
export function EnemiesEditor({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const editor = useEditor();
  const edit = useProject((s) => s.edit);
  const usages = useMemo(() => countUsages(doc).enemies, [doc]);
  const enemies = doc.enemies ?? [];
  const set = (id: string, change: (e: EnemyDef) => EnemyDef, key = `enemy:${id}`) =>
    edit(
      (d) => ({ ...d, enemies: (d.enemies ?? []).map((e) => (e.id === id ? change(e) : e)) }),
      key,
    );

  return (
    <div className="cards" data-testid="enemies">
      {enemies.length === 0 && <p className="hint">{t('enemies.empty')}</p>}
      {enemies.map((enemy) => (
        <section className="card" key={enemy.id} data-testid="enemy">
          <div className="card__grid">
            <label className="labelled">
              <span className="ie-label">{t('language.en')}</span>
              <input
                className="field"
                value={enemy.name.en ?? ''}
                onChange={(e) =>
                  set(enemy.id, (x) => ({ ...x, name: { ...x.name, en: e.target.value } }))
                }
              />
            </label>
            <label className="labelled">
              <span className="ie-label">{t('language.tr')}</span>
              <input
                className="field"
                lang="tr"
                value={enemy.name.tr ?? ''}
                onChange={(e) =>
                  set(enemy.id, (x) => ({ ...x, name: { ...x.name, tr: e.target.value } }))
                }
              />
            </label>
            <NumberChoice
              values={HP}
              value={enemy.hp ?? 100}
              label={t('enemies.hp')}
              onChange={(hp) => set(enemy.id, (x) => ({ ...x, hp }))}
            />
            <NumberChoice
              values={ATTACK}
              value={enemy.attack ?? 10}
              label={t('enemies.attack')}
              onChange={(attack) => set(enemy.id, (x) => ({ ...x, attack }))}
            />
            <label className="labelled">
              <span className="ie-label">{t('enemies.color')}</span>
              <select
                className="picker"
                value={enemy.color ?? 'red'}
                onChange={(e) => {
                  const color = STAGE_COLORS.find((c) => c === e.target.value);
                  if (color) set(enemy.id, (x) => ({ ...x, color }));
                }}
              >
                {STAGE_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {t(`stage.color.${c}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="card__grid">
            {(['en', 'tr'] as const).map((locale) => (
              <label className="labelled" key={locale}>
                <span className="ie-label">
                  {`${t('enemies.presence')} (${t(locale === 'en' ? 'language.en' : 'language.tr')})`}
                </span>
                <textarea
                  className="field"
                  lang={locale}
                  rows={3}
                  value={(enemy.presence ?? []).map((p) => p[locale] ?? '').join('\n')}
                  onChange={(e) =>
                    set(enemy.id, (x) => {
                      const lines = e.target.value.split('\n').slice(0, 12);
                      const old = x.presence ?? [];
                      const count = Math.max(lines.length, old.length);
                      const presence = Array.from({ length: count }, (_, i) => ({
                        ...old[i],
                        [locale]: lines[i] ?? '',
                      })).filter((p) => p.en || p.tr);
                      return { ...x, presence };
                    })
                  }
                />
              </label>
            ))}
          </div>
          <p className="hint">{t('enemies.presenceHint')}</p>
          <EnemyMoves
            enemy={enemy}
            onChange={(moves) => set(enemy.id, (x) => ({ ...x, moves }), `moves:${enemy.id}`)}
          />
          <div className="card__foot">
            <span className="hint">{t('data.uses', { count: usages.get(enemy.id) ?? 0 })}</span>
            <DeleteButton
              uses={usages.get(enemy.id) ?? 0}
              onDelete={() =>
                edit((d) => ({ ...d, enemies: (d.enemies ?? []).filter((x) => x.id !== enemy.id) }))
              }
            />
          </div>
        </section>
      ))}
      <button
        type="button"
        className="ie-button"
        data-testid="add-enemy"
        onClick={() => {
          const name = nextName(
            t('enemy.base'),
            enemies.map((e) => e.name.en ?? ''),
          );
          editor.addEnemy({ en: name, tr: name });
        }}
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('enemies.add')}
      </button>
    </div>
  );
}
