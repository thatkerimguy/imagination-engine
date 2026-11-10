import { createId } from '@ie/core';
import { iconElement } from '@ie/present';
import {
  ALIGNS,
  GAPS,
  ICONS,
  LIST_SOURCES,
  TEXT_STYLES,
  type LocalText,
  type ScreenComponent,
  type ScreenDef,
  type StoryProject,
} from '@ie/story';
import { useLayoutEffect, useRef } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import type { MessageKey } from '../messages.ts';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { useWriteLocale } from '../write/edit.ts';
import { VariablePicker } from '../write/pickers.tsx';
import { TextField } from '../write/TextField.tsx';
import { ActionsEditor } from './ActionsEditor.tsx';
import { BarFields } from './BarFields.tsx';
import { updateComponent } from './screen-edit.ts';

type Change = (component: ScreenComponent) => ScreenComponent;

export function useComponentEdit(id: string) {
  const edit = useProject((s) => s.edit);
  return (change: Change, mergeKey?: string) =>
    edit((d) => updateComponent(d, id, change), mergeKey && `comp:${id}:${mergeKey}`);
}

/** A screen text in the language being written (the other language is kept). */
export function ScreenText({
  value,
  label,
  testId,
  onChange,
}: {
  readonly value: LocalText | undefined;
  readonly label: string;
  readonly testId?: string;
  readonly onChange: (text: LocalText) => void;
}) {
  const locale = useWriteLocale();
  return (
    <div className="labelled labelled--wide">
      <span className="ie-label">{label}</span>
      <TextField
        value={value?.[locale] ?? ''}
        locale={locale}
        label={label}
        {...(testId ? { testId } : {})}
        onChange={(next) => onChange({ ...(value ?? { id: createId('l') }), [locale]: next })}
      />
    </div>
  );
}

function IconPreview({ icon }: { readonly icon: (typeof ICONS)[number] }) {
  const holder = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    holder.current?.replaceChildren(iconElement(icon));
  }, [icon]);
  return <span className="screen-icon-preview" ref={holder} aria-hidden="true" />;
}

function Choice<V extends string>({
  label,
  value,
  options,
  messages,
  onChange,
  testId,
}: {
  readonly label: string;
  readonly value: V;
  readonly options: readonly V[];
  readonly messages: string;
  readonly onChange: (value: V) => void;
  readonly testId?: string;
}) {
  const t = useT();
  return (
    <label className="labelled">
      <span className="ie-label">{label}</span>
      <select
        className="picker"
        value={value}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value as V)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {t(`${messages}.${o}` as MessageKey)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The fields one kind of component has. */
export function ComponentFields({
  doc,
  screen,
  component,
}: {
  readonly doc: StoryProject;
  readonly screen: ScreenDef;
  readonly component: ScreenComponent;
}) {
  const t = useT();
  const set = useComponentEdit(component.id);
  const c = component;
  switch (c.type) {
    case 'stack':
      return (
        <div className="card__grid">
          <div className="labelled">
            <span className="ie-label">{t('comp.direction')}</span>
            <Segmented
              label={t('comp.direction')}
              value={c.direction ?? 'column'}
              options={(['column', 'row'] as const).map((value) => ({
                value,
                label: t(`direction.${value}`),
              }))}
              onChange={(direction) => set(() => ({ ...c, direction }))}
            />
          </div>
          <Choice
            label={t('comp.gap')}
            value={c.gap ?? 'medium'}
            options={GAPS}
            messages="gap"
            onChange={(gap) => set(() => ({ ...c, gap }))}
          />
          <Choice
            label={t('comp.align')}
            value={c.align ?? 'stretch'}
            options={ALIGNS}
            messages="align"
            onChange={(align) => set(() => ({ ...c, align }))}
          />
        </div>
      );
    case 'grid':
      return (
        <label className="labelled">
          <span className="ie-label">{t('comp.columns')}</span>
          <select
            className="picker"
            value={c.columns}
            onChange={(e) => set(() => ({ ...c, columns: Number(e.target.value) }))}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      );
    case 'text':
      return (
        <>
          <ScreenText
            value={c.text}
            label={t('component.text')}
            testId="comp-text"
            onChange={(text) => set((old) => ({ ...old, text }) as ScreenComponent, 'text')}
          />
          <Choice
            label={t('comp.style')}
            value={c.style ?? 'body'}
            options={TEXT_STYLES}
            messages="textStyle"
            onChange={(style) => set(() => ({ ...c, style }))}
          />
        </>
      );
    case 'bar':
      return (
        <>
          <BarFields doc={doc} bar={c} onChange={(bar, key) => set(() => bar, key)} />
          <ScreenText
            value={c.label}
            label={t('comp.label')}
            onChange={(label) => set((old) => ({ ...old, label }) as ScreenComponent, 'label')}
          />
        </>
      );
    case 'icon':
      return (
        <div className="row">
          <IconPreview icon={c.icon} />
          <Choice
            label={t('comp.icon')}
            value={c.icon}
            options={ICONS}
            messages="icon"
            testId="comp-icon"
            onChange={(icon) => set(() => ({ ...c, icon }))}
          />
        </div>
      );
    case 'list':
      return (
        <>
          <div className="card__grid">
            <Choice
              label={t('comp.source')}
              value={c.source}
              options={LIST_SOURCES}
              messages="listSource"
              onChange={(source) => {
                const { var: _old, ...rest } = c;
                set(() =>
                  source === 'variable' ? { ...rest, source, var: '' } : { ...rest, source },
                );
              }}
            />
            {c.source === 'variable' && (
              <label className="labelled">
                <span className="ie-label">{t('comp.var')}</span>
                <VariablePicker
                  doc={doc}
                  value={c.var ?? ''}
                  label={t('comp.var')}
                  types={['list']}
                  newType="list"
                  onChange={(v) => set(() => ({ ...c, var: v }))}
                />
              </label>
            )}
          </div>
          <ScreenText
            value={c.empty}
            label={t('comp.empty')}
            onChange={(empty) => set((old) => ({ ...old, empty }) as ScreenComponent, 'empty')}
          />
        </>
      );
    case 'button':
      return (
        <>
          <ScreenText
            value={c.label}
            label={t('comp.label')}
            testId="comp-label"
            onChange={(label) => set((old) => ({ ...old, label }) as ScreenComponent, 'label')}
          />
          <ActionsEditor
            doc={doc}
            screen={screen}
            actions={c.actions}
            onChange={(actions, key) =>
              set((old) => ({ ...old, actions }) as ScreenComponent, key && `actions:${key}`)
            }
          />
        </>
      );
    case 'tabs':
      return null;
  }
}
