import { MAP_REVEALS, type MapReveal } from '@ie/story';
import { useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import type { MessageKey } from '../messages.ts';
import { useDoc, useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { RoomInspector } from '../world/RoomInspector.tsx';
import { SpacesEditor } from '../world/SpacesEditor.tsx';
import { setWorld, worldOf } from '../world/world-edit.ts';
import { WorldMap } from '../world/WorldMap.tsx';

const TABS = ['map', 'spaces'] as const;
type Tab = (typeof TABS)[number];

function WorldSettings() {
  const t = useT();
  const doc = useDoc();
  const edit = useProject((s) => s.edit);
  const world = worldOf(doc);
  return (
    <div className="row row--wrap world__settings">
      <label className="labelled">
        <span className="ie-label">{t('world.reveal')}</span>
        <select
          className="picker"
          value={world.reveal ?? 'nearby'}
          data-testid="world-reveal"
          onChange={(e) =>
            edit((d) => setWorld(d, (w) => ({ ...w, reveal: e.target.value as MapReveal })))
          }
        >
          {MAP_REVEALS.map((r) => (
            <option key={r} value={r}>
              {t(`reveal.${r}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={world.fastTravel === true}
          data-testid="world-fast-travel"
          onChange={(e) =>
            edit((d) =>
              setWorld(d, (w) => {
                if (e.target.checked) return { ...w, fastTravel: true };
                const { fastTravel: _gone, ...rest } = w;
                return rest;
              }),
            )
          }
        />
        <span>{t('world.fastTravel')}</span>
      </label>
    </div>
  );
}

/** World: rooms on a map joined by exits, and the spaces beside the story (ADR 0031). */
export function WorldView() {
  const t = useT();
  const doc = useDoc();
  const [tab, setTab] = useState<Tab>('map');
  const [selected, setSelected] = useState<string | null>(null);
  const rooms = worldOf(doc).rooms;
  const room = rooms.find((r) => r.id === selected);

  return (
    <section className="page page--wide" data-testid="view-world">
      <h2 className="page__title">{t('view.world')}</h2>
      <div className="data__tabs">
        <Segmented
          label={t('view.world')}
          value={tab}
          options={TABS.map((value) => ({ value, label: t(`world.tab.${value}`) }))}
          onChange={setTab}
        />
      </div>
      <div className="page__body">
        {tab === 'spaces' ? (
          <SpacesEditor doc={doc} />
        ) : (
          <div className="stack">
            <p className="hint">{t('world.intro')}</p>
            <WorldSettings />
            <div className="world">
              <WorldMap doc={doc} selected={selected} onSelect={setSelected} />
              <div className="world__side">
                {room ? (
                  <RoomInspector
                    key={room.id}
                    doc={doc}
                    room={room}
                    onDeleted={() => setSelected(null)}
                  />
                ) : (
                  <p className="hint">
                    {rooms.length === 0 ? t('world.noRooms') : t('world.nothingSelected')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
