import { useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { CharactersEditor } from '../data/CharactersEditor.tsx';
import { VariablesEditor } from '../data/VariablesEditor.tsx';
import { useDoc } from '../project/store.ts';
import { useT } from '../store.ts';

/** Data: characters and variables now; items, skills and quests arrive with the kits (phase 6). */
export function DataView() {
  const t = useT();
  const doc = useDoc();
  const [tab, setTab] = useState<'characters' | 'variables'>('characters');
  return (
    <section className="page page--wide" data-testid="view-data">
      <h2 className="page__title">{t('view.data')}</h2>
      <Segmented
        label={t('view.data')}
        value={tab}
        options={[
          { value: 'characters', label: t('data.characters') },
          { value: 'variables', label: t('data.variables') },
        ]}
        onChange={setTab}
      />
      <div className="page__body">
        {tab === 'characters' ? <CharactersEditor doc={doc} /> : <VariablesEditor doc={doc} />}
      </div>
    </section>
  );
}
