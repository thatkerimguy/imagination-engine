import { applyScript, passageToScript, type Passage } from '@ie/story';
import { Check, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDoc, useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { useWriteLocale } from './edit.ts';

/**
 * Script view (PLAN §3.3): the open passage as plain text in one language, for fast typing and
 * pasting. Nothing changes until Apply (or Ctrl+Enter), which is one undo step.
 */
export function ScriptView({ passage }: { readonly passage: Passage }) {
  const t = useT();
  const doc = useDoc();
  const edit = useProject((s) => s.edit);
  const locale = useWriteLocale();
  const names = useMemo(
    () => ({ characters: doc.characters, passages: doc.chapters.flatMap((c) => c.passages) }),
    [doc],
  );
  const script = useMemo(
    () => passageToScript(passage.blocks, locale, names),
    [passage.blocks, locale, names],
  );
  // The draft follows the document until the writer types; after Apply it follows again.
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const dirty = draft !== null && draft !== script;
  const text = draft ?? script;

  const apply = () => {
    if (!dirty) return;
    const result = applyScript(doc, passage.id, locale, text);
    edit(() => result.project);
    const notes = [t('script.applied')];
    if (result.created.length > 0)
      notes.push(t('script.created', { names: result.created.join(', ') }));
    if (result.missing.length > 0)
      notes.push(t('script.missing', { count: result.missing.length }));
    setStatus(notes.join(' '));
    setDraft(null);
  };

  return (
    <article className="manuscript script" data-testid="script-view">
      <h2 className="script__name">{passage.name || passage.id}</h2>
      <textarea
        className="field field--mono script__text"
        lang={locale}
        spellCheck
        aria-label={t('script.label', {
          name: passage.name || passage.id,
          language: t(`language.${locale}`),
        })}
        data-testid="script-text"
        value={text}
        onChange={(e) => {
          setDraft(e.target.value);
          setStatus(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            apply();
          }
        }}
      />
      <div className="row row--wrap script__bar">
        <button
          type="button"
          className="ie-button"
          data-testid="script-apply"
          disabled={!dirty}
          onClick={apply}
        >
          <Check size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('script.apply')}
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          disabled={!dirty}
          onClick={() => setDraft(null)}
        >
          <Undo2 size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('script.revert')}
        </button>
        <span className="script__status" role="status" data-testid="script-status">
          {dirty ? t('script.dirty') : status}
        </span>
      </div>
      <details className="script__help">
        <summary>{t('script.help')}</summary>
        <ul>
          {(['text', 'dialogue', 'choice', 'jump', 'section', 'other', 'escape'] as const).map(
            (key) => (
              <li key={key}>{t(`script.help.${key}`)}</li>
            ),
          )}
        </ul>
      </details>
    </article>
  );
}
