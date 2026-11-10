import { useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { CharactersEditor } from '../data/CharactersEditor.tsx';
import { EnemiesEditor } from '../data/EnemiesEditor.tsx';
import { HeroEditor } from '../data/HeroEditor.tsx';
import { ItemsEditor } from '../data/ItemsEditor.tsx';
import { QuestsEditor } from '../data/QuestsEditor.tsx';
import { SkillsEditor } from '../data/SkillsEditor.tsx';
import { VariablesEditor } from '../data/VariablesEditor.tsx';
import { useDoc } from '../project/store.ts';
import { useT } from '../store.ts';

const TABS = ['characters', 'variables', 'items', 'quests', 'hero', 'skills', 'enemies'] as const;
type Tab = (typeof TABS)[number];

/** Data: characters, variables, and the RPG kit's items, quests, hero, skills and enemies. */
export function DataView() {
  const t = useT();
  const doc = useDoc();
  const [tab, setTab] = useState<Tab>('characters');
  return (
    <section className="page page--wide" data-testid="view-data">
      <h2 className="page__title">{t('view.data')}</h2>
      <div className="data__tabs">
        <Segmented
          label={t('view.data')}
          value={tab}
          options={TABS.map((value) => ({ value, label: t(`data.${value}`) }))}
          onChange={setTab}
        />
      </div>
      <div className="page__body">
        {tab === 'characters' && <CharactersEditor doc={doc} />}
        {tab === 'variables' && <VariablesEditor doc={doc} />}
        {tab === 'items' && <ItemsEditor doc={doc} />}
        {tab === 'quests' && <QuestsEditor doc={doc} />}
        {tab === 'hero' && <HeroEditor doc={doc} />}
        {tab === 'skills' && <SkillsEditor doc={doc} />}
        {tab === 'enemies' && <EnemiesEditor doc={doc} />}
      </div>
    </section>
  );
}
