import { LAYOUTS, type Layout, type Passage, type StoryProject } from '@ie/story';
import { Flag, Play, Settings2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { runAction } from '../kernel.ts';
import { useProject } from '../project/store.ts';
import { allPassages, updatePassage } from '../project/tree.ts';
import { useT } from '../store.ts';
import { useEditor, useWriteLocale } from './edit.ts';
import { wordStats } from './word-stats.ts';

/** The open passage's name, its settings, and "Play from here". */
export function PassageHeader({
  doc,
  passage,
}: {
  readonly doc: StoryProject;
  readonly passage: Passage;
}) {
  const t = useT();
  const editor = useEditor();
  const setPlayFrom = useProject((s) => s.setPlayFrom);
  const openPassage = useProject((s) => s.openPassage);
  const [settings, setSettings] = useState(false);
  const locale = useWriteLocale();
  const stats = useMemo(() => wordStats(passage.blocks, locale), [passage.blocks, locale]);
  const isStart = doc.start === passage.id;
  const passages = allPassages(doc);
  const set = (change: (p: Passage) => Passage) =>
    editor.edit((d) => updatePassage(d, passage.id, change));

  return (
    <header className="passage-head">
      <div className="passage-head__row">
        <input
          className="passage-head__name"
          aria-label={t('passage.name')}
          value={passage.name ?? ''}
          placeholder={t('passage.unnamed')}
          data-testid="passage-name"
          onChange={(e) => editor.renamePassage(passage.id, e.target.value)}
        />
        <button
          type="button"
          className="ie-button ie-button--quiet icon-button"
          aria-expanded={settings}
          aria-label={t('passage.settings')}
          title={t('passage.settings')}
          onClick={() => setSettings(!settings)}
        >
          <Settings2 size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ie-button"
          data-testid="play-from-here"
          onClick={() => {
            setPlayFrom(passage.id);
            runAction('studio.view.open', { view: 'play' });
          }}
        >
          <Play size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('passage.playFromHere')}
        </button>
      </div>
      <p
        className="passage-head__stats hint"
        title={t('passage.wordsHint')}
        data-testid="passage-words"
      >
        {t('passage.words', { count: stats.words, minutes: stats.minutes })}
      </p>
      {settings && (
        <div className="passage-head__settings">
          <label className="inline-field">
            <span>{t('passage.layout')}</span>
            <select
              className="picker"
              value={passage.layout ?? ''}
              onChange={(e) =>
                set((p) => {
                  const copy = { ...p };
                  if (e.target.value) copy.layout = e.target.value as Layout;
                  else delete copy.layout;
                  return copy;
                })
              }
            >
              <option value="">{t('layout.inherit')}</option>
              {LAYOUTS.map((l) => (
                <option key={l} value={l}>
                  {t(`layout.${l}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={passage.keepPage === true}
              onChange={(e) =>
                set((p) => {
                  const copy = { ...p };
                  if (e.target.checked) copy.keepPage = true;
                  else delete copy.keepPage;
                  return copy;
                })
              }
            />
            <span>{t('passage.keepPage')}</span>
          </label>
          <button
            type="button"
            className="ie-button ie-button--quiet"
            disabled={isStart}
            onClick={() => editor.edit((d) => ({ ...d, start: passage.id }))}
          >
            <Flag size={16} strokeWidth={1.5} aria-hidden="true" />
            {isStart ? t('passage.isStart') : t('passage.makeStart')}
          </button>
          <button
            type="button"
            className="ie-button ie-button--quiet"
            data-danger
            disabled={isStart || passages.length === 1}
            title={isStart ? t('passage.cantDeleteStart') : undefined}
            onClick={() => {
              editor.edit((d) => ({
                ...d,
                chapters: d.chapters.map((c) => ({
                  ...c,
                  passages: c.passages.filter((p) => p.id !== passage.id),
                })),
              }));
              openPassage(doc.start);
            }}
          >
            <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('passage.delete')}
          </button>
        </div>
      )}
    </header>
  );
}
