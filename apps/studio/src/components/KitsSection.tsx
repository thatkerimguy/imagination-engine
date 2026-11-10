import { applyKit, findKit, KITS } from '@ie/kits';
import type { StoryProject } from '@ie/story';
import { Plus } from 'lucide-react';
import { useProject } from '../project/store.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { MenuButton } from './Menu.tsx';

/** The kits a novel was made with, and mixing another one in (its story stays the novel's own). */
export function KitsSection({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const edit = useProject((s) => s.edit);
  const used = doc.kits ?? [];
  const names = used.map((id) => labelText(findKit(id)?.name, locale, id));
  const more = KITS.filter((k) => !used.includes(k.id));

  return (
    <section className="kits" data-testid="kits">
      <h3 className="ie-label project-sheet__list-title">{t('kits.title')}</h3>
      <p className="hint" data-testid="kits-used">
        {names.length
          ? new Intl.ListFormat(locale, { type: 'conjunction' }).format(names)
          : t('kits.none')}
      </p>
      {more.length > 0 && (
        <>
          <MenuButton
            label={t('kits.add')}
            className="ie-button"
            testId="kits-add"
            items={more.map((kit) => ({
              id: kit.id,
              label: labelText(kit.name, locale),
              hint: labelText(kit.blurb, locale),
              onSelect: () => edit((d) => applyKit(d, kit)),
            }))}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('kits.add')}
          </MenuButton>
          <p className="hint">{t('kits.addHint')}</p>
        </>
      )}
    </section>
  );
}
