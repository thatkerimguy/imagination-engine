import type { CharacterDef, StoryProject } from '@ie/story';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { countUsages } from '../project/usages.ts';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { nextName, useEditor } from '../write/edit.ts';
import { DeleteButton } from './DeleteButton.tsx';

const COLORS = ['accent', 'muted', 'faint', 'ink'] as const;

/** Characters: names in both languages, the colour of their name, and Turkish suffix help. */
export function CharactersEditor({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const editor = useEditor();
  const edit = useProject((s) => s.edit);
  const usages = useMemo(() => countUsages(doc).characters, [doc]);
  const set = (id: string, change: (c: CharacterDef) => CharacterDef) =>
    edit(
      (d) => ({ ...d, characters: d.characters.map((c) => (c.id === id ? change(c) : c)) }),
      `character:${id}`,
    );
  const field = <K extends 'color' | 'suffixAs'>(
    c: CharacterDef,
    key: K,
    value: string,
  ): CharacterDef => {
    const copy = { ...c };
    if (value) copy[key] = value;
    else delete copy[key];
    return copy;
  };

  return (
    <div className="cards" data-testid="characters">
      <p className="hint">
        {doc.characters.length === 0 ? t('characters.empty') : t('characters.suffixHint')}
      </p>
      {doc.characters.map((c) => (
        <section className="card" key={c.id} data-testid="character">
          <div className="card__grid">
            <label className="labelled">
              <span className="ie-label">{t('language.en')}</span>
              <input
                className="field"
                value={c.name.en ?? ''}
                onChange={(e) =>
                  set(c.id, (x) => ({ ...x, name: { ...x.name, en: e.target.value } }))
                }
              />
            </label>
            <label className="labelled">
              <span className="ie-label">{t('language.tr')}</span>
              <input
                className="field"
                lang="tr"
                value={c.name.tr ?? ''}
                onChange={(e) =>
                  set(c.id, (x) => ({ ...x, name: { ...x.name, tr: e.target.value } }))
                }
              />
            </label>
            <label className="labelled">
              <span className="ie-label">{t('characters.color')}</span>
              <select
                className="picker"
                value={c.color ?? ''}
                onChange={(e) => set(c.id, (x) => field(x, 'color', e.target.value))}
              >
                <option value="">{t('characters.colorNone')}</option>
                {COLORS.map((color) => (
                  <option key={color} value={color}>
                    {t(`color.${color}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="labelled">
              <span className="ie-label">{t('characters.suffixAs')}</span>
              <input
                className="field"
                lang="tr"
                value={c.suffixAs ?? ''}
                placeholder={c.name.tr ?? ''}
                onChange={(e) => set(c.id, (x) => field(x, 'suffixAs', e.target.value))}
              />
            </label>
          </div>
          <div className="card__foot">
            <span className="hint">{t('data.uses', { count: usages.get(c.id) ?? 0 })}</span>
            <DeleteButton
              uses={usages.get(c.id) ?? 0}
              onDelete={() =>
                edit((d) => ({ ...d, characters: d.characters.filter((x) => x.id !== c.id) }))
              }
            />
          </div>
        </section>
      ))}
      <button
        type="button"
        className="ie-button"
        data-testid="add-character"
        onClick={() => {
          const name = nextName(
            t('character.base'),
            doc.characters.map((c) => c.name.en ?? ''),
          );
          editor.addCharacter({ en: name, tr: name });
        }}
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('characters.add')}
      </button>
    </div>
  );
}
