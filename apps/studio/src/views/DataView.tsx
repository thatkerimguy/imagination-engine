import { useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { CharactersEditor } from '../data/CharactersEditor.tsx';
import { EnemiesEditor } from '../data/EnemiesEditor.tsx';
import { VariablesEditor } from '../data/VariablesEditor.tsx';
import { useDoc } from '../project/store.ts';
import { useT } from '../store.ts';

/** Data: characters, variables and enemies now; items, skills and quests arrive with the kits (phase 6). */
export function DataView() {
  const t = useT();
  const doc = useDoc();
  const [tab, setTab] = useState<'characters' | 'variables' | 'enemies'>('characters');
  return (
    <section className="page page--wide" data-testid="view-data">
      <h2 className="page__title">{t('view.data')}</h2>
      <Segmented
        label={t('view.data')}
        value={tab}
        options={[
          { value: 'characters', label: t('data.characters') },
          { value: 'variables', label: t('data.variables') },
          { value: 'enemies', label: t('data.enemies') },
        ]}
        onChange={setTab}
      />
      <div className="page__body">
        {tab === 'characters' && <CharactersEditor doc={doc} />}
        {tab === 'variables' && <VariablesEditor doc={doc} />}
        {tab === 'enemies' && <EnemiesEditor doc={doc} />}
      </div>
    </section>
  );
}
