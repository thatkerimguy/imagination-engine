import { LOCALES, upper } from '@ie/i18n';
import { listKey } from '@ie/story';
import { ListTree } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { findProblems, problemsByPassage, type LocatedProblem } from '../project/problems.ts';
import { useDoc, useProject } from '../project/store.ts';
import { allPassages } from '../project/tree.ts';
import { useT } from '../store.ts';
import { BlockList } from '../write/BlockList.tsx';
import { WriteCtx, type WriteContext } from '../write/context.ts';
import { useEditor, usePassageId, useWriteLocale } from '../write/edit.ts';
import { PassageHeader } from '../write/PassageHeader.tsx';
import { PassageList } from '../write/PassageList.tsx';
import { ScriptView } from '../write/ScriptView.tsx';
import { TranslationView } from '../write/TranslationView.tsx';

/** Problems of the open project, recomputed only when the document changes. */
export function useProblems(): readonly LocatedProblem[] {
  const doc = useDoc();
  return useMemo(() => findProblems(doc), [doc]);
}

/** Write: passages on the side, the open passage as a column of blocks (or every line to translate). */
export function WriteView() {
  const t = useT();
  const doc = useDoc();
  const editor = useEditor();
  const locale = useWriteLocale();
  const setWriteLocale = useProject((s) => s.setWriteLocale);
  const passageId = usePassageId(doc);
  const problems = useProblems();
  const [mode, setMode] = useState<'write' | 'script' | 'translate'>('write');
  const [drawer, setDrawer] = useState(false);
  const passage = allPassages(doc).find((p) => p.id === passageId);

  const byBlock = useMemo(() => {
    const map = new Map<string, LocatedProblem[]>();
    for (const p of problems) if (p.blockId) map.set(p.blockId, [...(map.get(p.blockId) ?? []), p]);
    return map;
  }, [problems]);
  const counts = useMemo(() => problemsByPassage(problems), [problems]);
  const ctx: WriteContext = useMemo(
    () => ({ doc, editor, locale, problems: byBlock }),
    [doc, editor, locale, byBlock],
  );

  return (
    <WriteCtx.Provider value={ctx}>
      <section className="write" data-testid="view-write">
        <aside className="write__side" data-open={drawer || undefined}>
          <PassageList
            doc={doc}
            current={passageId}
            problems={problems}
            counts={counts}
            onPick={() => setDrawer(false)}
          />
        </aside>
        {/* On phones the passage list is a drawer; touching the page behind it closes it. */}
        <div className="write__main" onPointerDown={() => drawer && setDrawer(false)}>
          <div className="write__bar">
            <button
              type="button"
              className="ie-button ie-button--quiet write__drawer"
              aria-expanded={drawer}
              data-testid="passages-button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setDrawer(!drawer)}
            >
              <ListTree size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('passages.title')}
              {problems.length > 0 && <span className="badge">{problems.length}</span>}
            </button>
            <Segmented
              label={t('write.mode')}
              value={mode}
              options={[
                { value: 'write', label: t('write.manuscript') },
                { value: 'script', label: t('write.script') },
                { value: 'translate', label: t('write.translate') },
              ]}
              onChange={setMode}
            />
            {mode !== 'translate' && (
              <Segmented
                className="write__lang"
                label={t('write.language')}
                value={locale}
                options={LOCALES.map((l) => ({ value: l, label: upper(l, 'en') }))}
                onChange={setWriteLocale}
              />
            )}
          </div>
          {mode === 'translate' ? (
            <TranslationView doc={doc} onOpen={() => setMode('write')} />
          ) : passage && mode === 'script' ? (
            <ScriptView key={passage.id} passage={passage} />
          ) : passage ? (
            <article className="manuscript" key={passage.id}>
              <PassageHeader doc={doc} passage={passage} />
              <BlockList listKey={listKey.passage(passage.id)} blocks={passage.blocks} />
            </article>
          ) : null}
        </div>
      </section>
    </WriteCtx.Provider>
  );
}
