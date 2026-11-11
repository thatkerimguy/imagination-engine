import {
  MAX_SPACES,
  SPACE_SIDES,
  spaceOrder,
  type SpaceDef,
  type SpaceSide,
  type StoryProject,
} from '@ie/story';
import { ArrowDown, ArrowUp, Map as MapIcon, PanelsTopLeft, Trash2 } from 'lucide-react';
import { LabelFields } from '../data/LabelFields.tsx';
import type { MessageKey } from '../messages.ts';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { labelText, nextName } from '../write/edit.ts';
import { addSpace, moveSpace, removeSpace, updateSpace } from './world-edit.ts';

/** The views beside the story (ADR 0031): a map of the rooms, or a panel screen. */
export function SpacesEditor({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const spaces = doc.spaces ?? [];
  const panels = (doc.screens ?? []).filter((s) => s.kind === 'panel');
  const set = (id: string, change: (s: SpaceDef) => SpaceDef, mergeKey?: string) =>
    edit((d) => updateSpace(d, id, change), mergeKey);
  const order = spaceOrder(spaces)
    .map((s) => (s === 'story' ? t('spaces.story') : labelText(s.name, t.locale, s.id)))
    .join(' · ');
  const full = spaces.length >= MAX_SPACES;
  const add = (kind: SpaceDef['kind']) => {
    const name = nextName(
      t(kind === 'map' ? 'spaces.mapBase' : 'spaces.screenBase'),
      spaces.map((s) => s.name.en ?? ''),
    );
    edit((d) => addSpace(d, kind, { en: name, tr: name }, panels[0]?.id));
  };

  return (
    <div className="cards" data-testid="spaces-editor">
      <p className="hint">{t('spaces.intro')}</p>
      {spaces.length === 0 ? (
        <p className="hint">{t('spaces.empty')}</p>
      ) : (
        <p className="hint" data-testid="spaces-order">
          {t('spaces.order', { order })}
        </p>
      )}
      {spaces.map((space, index) => (
        <section className="card" key={space.id} data-testid="space-card">
          <div className="card__grid">
            <LabelFields
              value={space.name}
              prefix={t('world.name')}
              testId="space-name"
              onChange={(name) => set(space.id, (s) => ({ ...s, name }), `space-name:${space.id}`)}
            />
            <label className="labelled">
              <span className="ie-label">{t('spaces.side')}</span>
              <select
                className="picker"
                value={space.side}
                data-testid="space-side"
                onChange={(e) =>
                  set(space.id, (s) => ({ ...s, side: e.target.value as SpaceSide }))
                }
              >
                {SPACE_SIDES.map((side) => (
                  <option key={side} value={side}>
                    {t(`side.${side}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="labelled">
              <span className="ie-label">{t('spaces.kind')}</span>
              <select
                className="picker"
                value={space.kind}
                data-testid="space-kind"
                onChange={(e) =>
                  set(space.id, (s) => {
                    const { screen: _gone, ...rest } = s;
                    return e.target.value === 'screen'
                      ? { ...rest, kind: 'screen', screen: panels[0]?.id ?? '' }
                      : { ...rest, kind: 'map' };
                  })
                }
              >
                <option value="map">{t('spaceKind.map')}</option>
                <option value="screen">{t('spaceKind.screen')}</option>
              </select>
            </label>
            {space.kind === 'screen' && (
              <label className="labelled">
                <span className="ie-label">{t('spaces.screen')}</span>
                {panels.length === 0 ? (
                  <span className="hint">{t('spaces.noPanels')}</span>
                ) : (
                  <select
                    className="picker"
                    value={space.screen ?? ''}
                    data-testid="space-screen"
                    onChange={(e) => set(space.id, (s) => ({ ...s, screen: e.target.value }))}
                  >
                    {!space.screen && <option value="">{t('spaces.screen')}</option>}
                    {panels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {labelText(p.name, t.locale, p.id)}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            )}
          </div>
          <div className="card__foot">
            <span className="row">
              <button
                type="button"
                className="ie-button ie-button--quiet icon-button"
                aria-label={t('block.up')}
                title={t('block.up')}
                disabled={index === 0}
                onClick={() => edit((d) => moveSpace(d, space.id, -1))}
              >
                <ArrowUp size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ie-button ie-button--quiet icon-button"
                aria-label={t('block.down')}
                title={t('block.down')}
                disabled={index === spaces.length - 1}
                onClick={() => edit((d) => moveSpace(d, space.id, 1))}
              >
                <ArrowDown size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </span>
            <button
              type="button"
              className="ie-button ie-button--quiet"
              data-danger
              data-testid="space-remove"
              onClick={() => edit((d) => removeSpace(d, space.id))}
            >
              <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('spaces.remove')}
            </button>
          </div>
        </section>
      ))}
      {full ? (
        <p className="hint">{t('spaces.full', { n: MAX_SPACES })}</p>
      ) : (
        <div className="row row--wrap">
          <button
            type="button"
            className="ie-button"
            data-testid="add-map-space"
            onClick={() => add('map')}
          >
            <MapIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('spaces.addMap')}
          </button>
          <button
            type="button"
            className="ie-button"
            data-testid="add-screen-space"
            onClick={() => add('screen')}
          >
            <PanelsTopLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('spaces.addScreen')}
          </button>
        </div>
      )}
    </div>
  );
}
