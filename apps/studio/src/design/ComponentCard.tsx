import { createId } from '@ie/core';
import {
  COMPONENT_TYPES,
  type ScreenComponent,
  type ScreenDef,
  type StoryProject,
  type TabsComponent,
} from '@ie/story';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { createContext, useContext } from 'react';
import { MenuButton } from '../components/Menu.tsx';
import { messages } from '../messages.ts';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import type { LocatedProblem } from '../project/problems.ts';
import { ConditionBuilder } from '../write/ConditionBuilder.tsx';
import { ProblemText } from '../write/ProblemText.tsx';
import { ComponentFields, ScreenText, useComponentEdit } from './ComponentFields.tsx';
import {
  insertComponent,
  moveComponent,
  newComponent,
  removeComponent,
  screenListKey,
} from './screen-edit.ts';

/** Validator problems by component id, provided once by the screens editor. */
export const ScreenProblems = createContext<ReadonlyMap<string, readonly LocatedProblem[]>>(
  new Map(),
);

/** Each tab: its name and its own list of components. */
function TabsFields({
  doc,
  screen,
  component: c,
}: {
  readonly doc: StoryProject;
  readonly screen: ScreenDef;
  readonly component: TabsComponent;
}) {
  const t = useT();
  const set = useComponentEdit(c.id);
  return (
    <div className="screen-tabs-edit">
      {c.tabs.map((tab, i) => (
        <div className="branch" key={tab.id}>
          <div className="branch__head">
            <span className="branch__label">
              {t('comp.tab')} {i + 1}
            </span>
            {c.tabs.length > 1 && (
              <button
                type="button"
                className="ie-button ie-button--quiet icon-button"
                aria-label={t('comp.removeTab')}
                title={t('comp.removeTab')}
                onClick={() =>
                  set((old) =>
                    old.type === 'tabs'
                      ? { ...old, tabs: old.tabs.filter((x) => x.id !== tab.id) }
                      : old,
                  )
                }
              >
                <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </div>
          <ScreenText
            value={tab.label}
            label={t('comp.label')}
            onChange={(label) =>
              set(
                (old) =>
                  old.type === 'tabs'
                    ? { ...old, tabs: old.tabs.map((x) => (x.id === tab.id ? { ...x, label } : x)) }
                    : old,
                `tab:${tab.id}`,
              )
            }
          />
          <ComponentList
            doc={doc}
            screen={screen}
            listKey={screenListKey.tab(tab.id)}
            components={tab.children}
          />
        </div>
      ))}
      {c.tabs.length < 6 && (
        <button
          type="button"
          className="ie-button ie-button--quiet"
          onClick={() =>
            set((old) =>
              old.type === 'tabs'
                ? {
                    ...old,
                    tabs: [
                      ...old.tabs,
                      { id: createId('tab'), label: { id: createId('l') }, children: [] },
                    ],
                  }
                : old,
            )
          }
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('comp.addTab')}
        </button>
      )}
    </div>
  );
}

function ComponentCard({
  doc,
  screen,
  component,
  first,
  last,
}: {
  readonly doc: StoryProject;
  readonly screen: ScreenDef;
  readonly component: ScreenComponent;
  readonly first: boolean;
  readonly last: boolean;
}) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const set = useComponentEdit(component.id);
  const own = useContext(ScreenProblems).get(component.id) ?? [];
  const quiet = 'ie-button ie-button--quiet icon-button';
  return (
    <section className="screen-comp" data-testid={`comp-${component.type}`}>
      <header className="screen-comp__head">
        <span className="screen-comp__type">{t(`component.${component.type}`)}</span>
        <span className="screen-comp__tools">
          <button
            type="button"
            className={quiet}
            disabled={first}
            aria-label={t('comp.up')}
            title={t('comp.up')}
            onClick={() => edit((d) => moveComponent(d, component.id, -1))}
          >
            <ArrowUp size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={quiet}
            disabled={last}
            aria-label={t('comp.down')}
            title={t('comp.down')}
            onClick={() => edit((d) => moveComponent(d, component.id, 1))}
          >
            <ArrowDown size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={quiet}
            data-danger
            aria-label={t('comp.remove')}
            title={t('comp.remove')}
            onClick={() => edit((d) => removeComponent(d, component.id))}
          >
            <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </span>
      </header>
      {component.type === 'tabs' ? (
        <TabsFields doc={doc} screen={screen} component={component} />
      ) : (
        <ComponentFields doc={doc} screen={screen} component={component} />
      )}
      {(component.type === 'stack' || component.type === 'grid') && (
        <ComponentList
          doc={doc}
          screen={screen}
          listKey={screenListKey.component(component.id)}
          components={component.children}
        />
      )}
      {own.length > 0 && (
        <ul className="block__problems">
          {own.map((p, i) => (
            <li key={i} data-severity={p.severity}>
              <ProblemText problem={p} />
            </li>
          ))}
        </ul>
      )}
      <div className="branch">
        <span className="branch__label">{t('comp.if')}</span>
        <ConditionBuilder
          doc={doc}
          value={component.if}
          label={t('comp.if')}
          onChange={(formula) =>
            set((old) => {
              const { if: _old, ...rest } = old;
              return formula === undefined ? rest : { ...rest, if: formula };
            }, 'if')
          }
        />
      </div>
    </section>
  );
}

/** A list of components with "Add to screen" at the end; stacks, grids and tabs nest one. */
export function ComponentList({
  doc,
  screen,
  listKey,
  components,
}: {
  readonly doc: StoryProject;
  readonly screen: ScreenDef;
  readonly listKey: string;
  readonly components: readonly ScreenComponent[];
}) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const nested = !listKey.startsWith('s:');
  return (
    <div className={nested ? 'screen-comps screen-comps--nested' : 'screen-comps'}>
      {components.map((component, i) => (
        <ComponentCard
          key={component.id}
          doc={doc}
          screen={screen}
          component={component}
          first={i === 0}
          last={i === components.length - 1}
        />
      ))}
      {components.length < 40 && (
        <MenuButton
          label={t('screens.add.component')}
          className="ie-button ie-button--quiet"
          testId="add-component"
          items={COMPONENT_TYPES.map((type) => ({
            id: type,
            label: t(`component.${type}`),
            hint: t(`componentHint.${type}`),
            onSelect: () => {
              const label = {
                en: messages.en['component.button'],
                tr: messages.tr['component.button'],
              };
              const component = newComponent(type, type === 'button' ? { label } : {});
              edit((d) => insertComponent(d, listKey, components.length, component));
            },
          }))}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('screens.add.component')}
        </MenuButton>
      )}
    </div>
  );
}
