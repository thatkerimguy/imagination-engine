import { LOCALES, upper, type Locale } from '@ie/i18n';
import { compileStory, StoryLoadError, type CompiledStory, type StoryProblem } from '@ie/story';
import { RotateCcw, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { runAction } from '../kernel.ts';
import { director } from '../audio/studio-audio.ts';
import { PlaySession, type PlayAudio } from '../play/PlaySession.ts';
import { findProblems } from '../project/problems.ts';
import { useDoc, useProject } from '../project/store.ts';
import { allPassages } from '../project/tree.ts';
import { useStudio, useT } from '../store.ts';
import { ProblemText } from '../write/ProblemText.tsx';
import { attachStage, setStageLocale, stage } from '../stage/studio-stage.ts';

const INTERACTIVE = 'button, input, textarea, select, a, label';

/** Play runs audio and stage blocks through the Studio's action bus, like the Player does. */
const playAudio: PlayAudio = {
  run: (id, params) => runAction(id, params),
  typed: (speaker, text) => director.typed(speaker, text),
  applyScene: (scene) => {
    director.applyScene(scene);
    stage.applyScene(scene);
  },
  stopAll: () => {
    director.stopAll();
    stage.applyScene({});
  },
};

function compile(doc: unknown): { story: CompiledStory } | { problems: readonly StoryProblem[] } {
  try {
    return { story: compileStory(doc) };
  } catch (error) {
    if (error instanceof StoryLoadError) return { problems: error.problems };
    throw error;
  }
}

/** Play: the novel exactly as readers get it, from the start or from any passage. */
export function PlayView() {
  const t = useT();
  const doc = useDoc();
  const uiLocale = useStudio((s) => s.locale);
  const playFrom = useProject((s) => s.playFrom);
  const setPlayFrom = useProject((s) => s.setPlayFrom);
  const openPassage = useProject((s) => s.openPassage);
  const [locale, setLocale] = useState<Locale>(uiLocale);
  const [canBack, setCanBack] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const session = useRef<PlaySession | null>(null);
  const result = useMemo(() => compile(doc), [doc]);
  const start = playFrom && allPassages(doc).some((p) => p.id === playFrom) ? playFrom : undefined;
  const startName = start ? allPassages(doc).find((p) => p.id === start)?.name || start : null;

  useEffect(() => {
    if (!('story' in result) || !host.current || !frame.current) return;
    const play = new PlaySession(result.story, start, locale, setCanBack, playAudio);
    session.current = play;
    host.current.replaceChildren(play.presenter.element);
    const detach = attachStage(frame.current, play.presenter.element, locale);
    play.begin();
    return () => {
      play.dispose();
      detach();
      session.current = null;
    };
    // The language changes through setLocale below, without restarting the playthrough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, start]);

  useEffect(() => {
    setStageLocale(locale);
    session.current?.setLocale(locale);
  }, [locale]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const play = session.current;
      if (
        !play ||
        (event.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]')
      )
        return;
      if (play.presenter.handleKey(event.key)) return;
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowRight') {
        event.preventDefault();
        play.tap();
      } else if (event.key === 'ArrowLeft' || event.key === 'Backspace') {
        event.preventDefault();
        play.back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if ('problems' in result) {
    const located = findProblems(doc).filter((p) => p.severity === 'error');
    return (
      <section className="page" data-testid="view-play">
        <h2 className="page__title">{t('play.blocked')}</h2>
        <p className="page__intro">{t('play.blockedIntro')}</p>
        <ul className="problems">
          {(located.length ? located : result.problems).map((p, i) => (
            <li key={i}>
              <button
                type="button"
                className="problems__item"
                data-severity="error"
                onClick={() => {
                  const where = 'passageId' in p ? (p as (typeof located)[number]) : null;
                  if (where?.passageId) openPassage(where.passageId, where.blockId ?? undefined);
                  runAction('studio.view.open', { view: 'write' });
                }}
              >
                <span className="problems__text">
                  <ProblemText problem={p} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="play" data-testid="view-play">
      <div className="play__bar">
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="play-restart"
          onClick={() => session.current?.restart()}
        >
          <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('play.restart')}
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          disabled={!canBack}
          onClick={() => session.current?.back()}
        >
          <Undo2 size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('play.back')}
        </button>
        {startName && (
          <span className="play__from" data-testid="play-from">
            {t('play.from', { name: startName })}
            <button
              type="button"
              className="ie-button ie-button--quiet icon-button"
              aria-label={t('play.fromStart')}
              title={t('play.fromStart')}
              onClick={() => setPlayFrom(null)}
            >
              <X size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </span>
        )}
        <Segmented
          className="play__lang"
          label={t('play.language')}
          value={locale}
          options={LOCALES.map((l) => ({ value: l, label: upper(l, 'en') }))}
          onChange={setLocale}
        />
      </div>
      {/* The frame holds the page and, over it, the stage canvas. */}
      <div className="play__frame" ref={frame}>
        <div
          className="play__page"
          ref={host}
          onClick={(event) => {
            if ((event.target as Element).closest(INTERACTIVE)) return;
            if (!document.getSelection()?.isCollapsed) return;
            session.current?.tap();
          }}
        />
      </div>
    </section>
  );
}
