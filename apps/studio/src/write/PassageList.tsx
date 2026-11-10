import type { StoryProject } from '@ie/story';
import { Flag, Plus } from 'lucide-react';
import type { LocatedProblem } from '../project/problems.ts';
import { useProject } from '../project/store.ts';
import { allPassages } from '../project/tree.ts';
import { useT } from '../store.ts';
import { nextName, useEditor } from './edit.ts';
import { ProblemText } from './ProblemText.tsx';

interface PassageListProps {
  readonly doc: StoryProject;
  readonly current: string;
  readonly problems: readonly LocatedProblem[];
  readonly counts: ReadonlyMap<string, number>;
  readonly onPick?: () => void;
}

/** The passages of the novel, then every problem in it. Tapping either opens the place. */
export function PassageList({ doc, current, problems, counts, onPick }: PassageListProps) {
  const t = useT();
  const editor = useEditor();
  const openPassage = useProject((s) => s.openPassage);
  const passages = allPassages(doc);
  const names = new Map(passages.map((p) => [p.id, p.name || p.id]));

  return (
    <div className="passages">
      <div className="passages__head">
        <h2 className="ie-label">{t('passages.title')}</h2>
        <button
          type="button"
          className="ie-button ie-button--quiet icon-button"
          aria-label={t('passages.add')}
          title={t('passages.add')}
          data-testid="add-passage"
          onClick={() => {
            const id = editor.addPassage(
              nextName(
                t('passage.base'),
                passages.map((p) => p.name ?? ''),
              ),
            );
            openPassage(id);
            onPick?.();
          }}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <ul className="passages__list" data-testid="passage-list">
        {passages.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="passages__item"
              aria-current={p.id === current ? 'page' : undefined}
              onClick={() => {
                openPassage(p.id);
                onPick?.();
              }}
            >
              <span className="passages__name">{p.name || p.id}</span>
              {p.id === doc.start && (
                <Flag
                  size={14}
                  strokeWidth={1.5}
                  aria-label={t('passage.start')}
                  className="passages__start"
                />
              )}
              {(counts.get(p.id) ?? 0) > 0 && <span className="badge">{counts.get(p.id)}</span>}
            </button>
          </li>
        ))}
      </ul>
      <h2 className="ie-label passages__problems-title">
        {t('problems.title', { count: problems.length })}
      </h2>
      {problems.length === 0 ? (
        <p className="hint">{t('problems.none')}</p>
      ) : (
        <ul className="problems" data-testid="problems">
          {problems.map((p, i) => (
            <li key={i}>
              <button
                type="button"
                className="problems__item"
                data-severity={p.severity}
                disabled={!p.passageId}
                onClick={() => {
                  if (!p.passageId) return;
                  openPassage(p.passageId, p.blockId ?? undefined);
                  onPick?.();
                }}
              >
                <span className="problems__text">
                  <ProblemText problem={p} />
                </span>
                {p.passageId && <span className="problems__where">{names.get(p.passageId)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
