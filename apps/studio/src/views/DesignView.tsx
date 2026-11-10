import { useMemo, useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { ScreensEditor } from '../design/ScreensEditor.tsx';
import { ThemeEditor } from '../design/ThemeEditor.tsx';
import { useDoc } from '../project/store.ts';
import { useT } from '../store.ts';
import { WriteCtx, type WriteContext } from '../write/context.ts';
import { useEditor, useWriteLocale } from '../write/edit.ts';
import { useProblems } from './WriteView.tsx';

/** Design: the story's theme, and its screens (title screen, HUDs, panels). */
export function DesignView() {
  const t = useT();
  const doc = useDoc();
  const editor = useEditor();
  const locale = useWriteLocale();
  const problems = useProblems();
  const [tab, setTab] = useState<'theme' | 'screens'>('theme');
  // Screen text fields and conditions are the Manuscript's own editors; they read this context.
  const ctx: WriteContext = useMemo(
    () => ({ doc, editor, locale, problems: new Map() }),
    [doc, editor, locale],
  );

  return (
    <WriteCtx.Provider value={ctx}>
      <section className="page page--wide" data-testid="view-design">
        <h2 className="page__title">{t('view.design')}</h2>
        <Segmented
          label={t('view.design')}
          value={tab}
          options={[
            { value: 'theme', label: t('design.theme') },
            { value: 'screens', label: t('design.screens') },
          ]}
          onChange={setTab}
        />
        <div className="page__body">
          {tab === 'theme' ? (
            <ThemeEditor doc={doc} />
          ) : (
            <ScreensEditor doc={doc} problems={problems} />
          )}
        </div>
      </section>
    </WriteCtx.Provider>
  );
}
