import { useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { useDoc } from '../project/store.ts';
import { AudioSetup } from '../sound/AudioSetup.tsx';
import { MusicPanel } from '../sound/MusicPanel.tsx';
import { SoundDesigner } from '../sound/SoundDesigner.tsx';
import { useT } from '../store.ts';

type Tab = 'music' | 'sounds' | 'setup';

/** Sound: the novel's music (with beat analysis), its sound effects, and this device's audio setup. */
export function SoundView() {
  const t = useT();
  const doc = useDoc();
  const [tab, setTab] = useState<Tab>('music');
  return (
    <section className="page page--wide" data-testid="view-sound">
      <h2 className="page__title">{t('view.sound')}</h2>
      <Segmented
        label={t('view.sound')}
        value={tab}
        options={[
          { value: 'music', label: t('sound.tab.music') },
          { value: 'sounds', label: t('sound.tab.sounds') },
          { value: 'setup', label: t('sound.tab.setup') },
        ]}
        onChange={setTab}
      />
      <div className="page__body">
        {tab === 'music' && <MusicPanel doc={doc} />}
        {tab === 'sounds' && <SoundDesigner doc={doc} />}
        {tab === 'setup' && <AudioSetup />}
      </div>
    </section>
  );
}
