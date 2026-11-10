import { applyStoryTheme, resolveStoryTheme, ScreenHost } from '@ie/present';
import {
  compileStory,
  SCREEN_KINDS,
  StoryRuntime,
  walkComponents,
  type ScreenDef,
  type ScreenKind,
  type StoryProject,
} from '@ie/story';
import { Plus } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { MenuButton } from '../components/Menu.tsx';
import { Segmented } from '../components/Segmented.tsx';
import { LabelFields } from '../data/LabelFields.tsx';
import { DeleteButton } from '../data/DeleteButton.tsx';
import { messages, type MessageKey } from '../messages.ts';
import type { LocatedProblem } from '../project/problems.ts';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { nextName, useWriteLocale } from '../write/edit.ts';
import { ComponentList, ScreenProblems } from './ComponentCard.tsx';
import { newScreen, screenListKey, updateScreen } from './screen-edit.ts';

/**
 * One screen as the reader will see it, with the story's starting values. It is compiled on its
 * own and even with errors, so the preview keeps up while a screen is half built.
 */
function ScreenPreview({
  doc,
  screen,
}: {
  readonly doc: StoryProject;
  readonly screen: ScreenDef;
}) {
  const t = useT();
  const locale = useWriteLocale();
  const frame = useRef<HTMLDivElement>(null);
  const story = useMemo(() => {
    try {
      return compileStory({ ...doc, screens: [screen] }, { allowErrors: true });
    } catch {
      return null;
    }
  }, [doc, screen]);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    applyStoryTheme(el, resolveStoryTheme(doc.theme));
    if (!story) return void el.replaceChildren();
    let host: ScreenHost;
    try {
      host = new ScreenHost(new StoryRuntime(story), { start() {}, continue() {} }, { locale });
      if (screen.kind === 'hud')
        el.replaceChildren(screen.edge === 'bottom' ? host.hudBottom : host.hudTop);
      else {
        el.replaceChildren(host.overlay);
        host.open(screen.id);
      }
    } catch {
      // A screen bound to something that doesn't exist yet; its card already says what.
      return void el.replaceChildren();
    }
    return () => host.dispose();
  }, [story, screen, locale, doc.theme]);

  return (
    <div className="screen-preview">
      <span className="ie-label">{t('screens.preview')}</span>
      <div
        className="screen-preview__frame"
        data-kind={screen.kind}
        ref={frame}
        data-testid="screen-preview"
      />
      <p className="hint">{t('screens.previewHint')}</p>
    </div>
  );
}

function ScreenCard({ doc, screen }: { readonly doc: StoryProject; readonly screen: ScreenDef }) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const set = (change: (s: ScreenDef) => ScreenDef, key?: string) =>
    edit((d) => updateScreen(d, screen.id, change), key && `screen:${screen.id}:${key}`);
  let opens = 0;
  for (const s of doc.screens ?? [])
    walkComponents(s.children, (c) => {
      if (c.type === 'button')
        opens += c.actions.filter((a) => a.type === 'open' && a.screen === screen.id).length;
    });

  return (
    <section className="card screen-card-edit" data-testid="screen">
      <div className="card__grid">
        <LabelFields
          value={screen.name}
          testId="screen-name"
          onChange={(name) => set((s) => ({ ...s, name }), 'name')}
        />
        <label className="labelled">
          <span className="ie-label">{t('screens.kind')}</span>
          <select
            className="picker"
            value={screen.kind}
            data-testid="screen-kind"
            onChange={(e) => {
              const kind = e.target.value as ScreenKind;
              set(({ edge: _edge, ...rest }) =>
                kind === 'hud' ? { ...rest, kind, edge: 'top' } : { ...rest, kind },
              );
            }}
          >
            {SCREEN_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`screenKind.${kind}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {screen.kind === 'hud' && (
        <div className="row row--wrap">
          <span className="ie-label">{t('screens.edge')}</span>
          <Segmented
            label={t('screens.edge')}
            value={screen.edge ?? 'top'}
            options={(['top', 'bottom'] as const).map((value) => ({
              value,
              label: t(`edge.${value}`),
            }))}
            onChange={(edge) => set((s) => ({ ...s, edge }))}
          />
        </div>
      )}
      <div className="screen-card-edit__body">
        <div className="screen-card-edit__contents">
          <span className="ie-label">{t('screens.contents')}</span>
          <ComponentList
            doc={doc}
            screen={screen}
            listKey={screenListKey.screen(screen.id)}
            components={screen.children}
          />
        </div>
        <ScreenPreview doc={doc} screen={screen} />
      </div>
      <div className="card__foot">
        <span />
        <DeleteButton
          uses={opens}
          onDelete={() =>
            edit((d) => ({ ...d, screens: (d.screens ?? []).filter((s) => s.id !== screen.id) }))
          }
        />
      </div>
    </section>
  );
}

/** Title screen, HUDs and panels: each a list of components with a live preview beside it. */
export function ScreensEditor({
  doc,
  problems,
}: {
  readonly doc: StoryProject;
  readonly problems: readonly LocatedProblem[];
}) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const screens = doc.screens ?? [];
  const byComponent = useMemo(() => {
    const map = new Map<string, LocatedProblem[]>();
    for (const p of problems)
      if (p.where && !p.passageId) map.set(p.where, [...(map.get(p.where) ?? []), p]);
    return map;
  }, [problems]);

  const add = (kind: ScreenKind) => {
    const key = `screenKind.${kind}` as const;
    const name = {
      en: nextName(
        messages.en[key],
        screens.map((s) => s.name.en ?? ''),
      ),
      tr: nextName(
        messages.tr[key],
        screens.map((s) => s.name.tr ?? ''),
      ),
    };
    edit((d) => ({ ...d, screens: [...(d.screens ?? []), newScreen(kind, name)] }));
  };

  return (
    <ScreenProblems.Provider value={byComponent}>
      <div className="cards">
        {screens.length === 0 && <p className="hint">{t('screens.empty')}</p>}
        {screens.map((screen) => (
          <ScreenCard key={screen.id} doc={doc} screen={screen} />
        ))}
        {screens.length < 40 && (
          <MenuButton
            label={t('screens.add')}
            className="ie-button"
            testId="add-screen"
            items={SCREEN_KINDS.map((kind) => ({
              id: kind,
              label: t(`screenKind.${kind}` as MessageKey),
              onSelect: () => add(kind),
            }))}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('screens.add')}
          </MenuButton>
        )}
      </div>
    </ScreenProblems.Provider>
  );
}
