import type { MaterialDomain } from '@ie/story';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { DeleteButton } from '../data/DeleteButton.tsx';
import { newMaterial } from '../material/edit.ts';
import { MaterialBench } from '../material/MaterialBench.tsx';
import { useMaterialUi } from '../material/ui.ts';
import { useDoc, useProject } from '../project/store.ts';
import { countUsages } from '../project/usages.ts';
import { useStudio, useT } from '../store.ts';
import { labelText, nextName } from '../write/edit.ts';

/** Materials: pick or make one, then build it from nodes (ADR 0020). */
export function MaterialsView() {
  const t = useT();
  const doc = useDoc();
  const edit = useProject((s) => s.edit);
  const locale = useStudio((s) => s.locale);
  const ui = useMaterialUi();
  const materials = doc.materials ?? [];
  const current = materials.find((m) => m.id === ui.materialId) ?? materials[0];
  const uses = useMemo(() => countUsages(doc).materials, [doc]);
  const name = (m: (typeof materials)[number]) => labelText(m.name, locale, m.id);

  const make = (domain: MaterialDomain) => {
    const base = t(domain === 'text' ? 'mat.textBase' : 'mat.postBase');
    const label = nextName(base, materials.map(name));
    const material = newMaterial(domain, { en: label, tr: label });
    edit((d) => ({ ...d, materials: [...(d.materials ?? []), material] }));
    ui.open(material.id);
  };

  return (
    <section className="page page--wide" data-testid="view-materials">
      <h2 className="page__title">{t('view.materials')}</h2>
      <p className="page__intro">{t('mat.intro')}</p>
      <div className="row row--wrap seq-pick">
        {current && (
          <select
            className="picker"
            aria-label={t('mat.material')}
            value={current.id}
            data-testid="mat-pick"
            onChange={(e) => ui.open(e.target.value)}
          >
            {(['text', 'post'] as const).map((domain) => {
              const list = materials.filter((m) => m.domain === domain);
              return list.length === 0 ? null : (
                <optgroup key={domain} label={t(`mat.domain.${domain}`)}>
                  {list.map((m) => (
                    <option key={m.id} value={m.id}>
                      {name(m)}
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
          data-testid="mat-new-text"
          onClick={() => make('text')}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('mat.newText')}
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="mat-new-post"
          onClick={() => make('post')}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('mat.newPost')}
        </button>
        {current && (
          <DeleteButton
            uses={uses.get(current.id) ?? 0}
            onDelete={() => {
              edit((d) => ({
                ...d,
                materials: (d.materials ?? []).filter((m) => m.id !== current.id),
              }));
              ui.open(null);
            }}
          />
        )}
      </div>
      {current ? (
        <MaterialBench key={current.id} material={current} />
      ) : (
        <p className="hint" data-testid="mat-empty">
          {t('mat.empty')}
        </p>
      )}
    </section>
  );
}
