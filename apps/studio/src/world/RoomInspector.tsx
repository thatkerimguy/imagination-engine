import { WORLD_SIZE, type RoomDef, type StoryProject } from '@ie/story';
import { PenLine, Plus, Signpost } from 'lucide-react';
import { useState } from 'react';
import { DeleteButton } from '../data/DeleteButton.tsx';
import { LabelFields } from '../data/LabelFields.tsx';
import { useProject } from '../project/store.ts';
import { useStudio, useT } from '../store.ts';
import { labelText } from '../write/edit.ts';
import { PassagePicker } from '../write/pickers.tsx';
import { ExitRow, RoomPicker } from './ExitRow.tsx';
import {
  addExit,
  appendExitsBlock,
  deleteRoom,
  endsWithExits,
  suggestDirection,
  updateRoom,
} from './world-edit.ts';

function Coordinate({
  label,
  value,
  onChange,
  testId,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (n: number) => void;
  readonly testId: string;
}) {
  return (
    <label className="labelled">
      <span className="ie-label">{label}</span>
      <input
        className="field field--number"
        type="number"
        min={-WORLD_SIZE}
        max={WORLD_SIZE}
        step={1}
        value={value}
        data-testid={testId}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) onChange(Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, n)));
        }}
      />
    </label>
  );
}

/** Adds a way out: pick where it leads; the direction follows the map when they touch. */
function AddExit({ doc, room }: { readonly doc: StoryProject; readonly room: RoomDef }) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const others = (doc.world?.rooms ?? []).filter((r) => r.id !== room.id);
  const [to, setTo] = useState('');
  const [twoWay, setTwoWay] = useState(true);
  const target = others.find((r) => r.id === to);
  if (others.length === 0) return null;
  return (
    <div className="row row--wrap">
      <RoomPicker rooms={others} value={to} testId="wexit-new-to" onChange={setTo} />
      <label
        className="check"
        title={
          target ? t('world.twoWayHint', { name: labelText(target.name, t.locale, to) }) : undefined
        }
      >
        <input type="checkbox" checked={twoWay} onChange={(e) => setTwoWay(e.target.checked)} />
        <span>{t('world.twoWay')}</span>
      </label>
      <button
        type="button"
        className="ie-button ie-button--quiet"
        disabled={!target}
        data-testid="wexit-add"
        onClick={() => {
          edit((d) => addExit(d, room.id, suggestDirection(room, target), to, twoWay));
          setTo('');
        }}
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('world.addExit')}
      </button>
    </div>
  );
}

/** Everything about the selected room: name, passage, square, exits. */
export function RoomInspector({
  doc,
  room,
  onDeleted,
}: {
  readonly doc: StoryProject;
  readonly room: RoomDef;
  readonly onDeleted: () => void;
}) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const openPassage = useProject((s) => s.openPassage);
  const setView = useStudio((s) => s.setView);
  const set = (change: (r: RoomDef) => RoomDef, mergeKey?: string) =>
    edit((d) => updateRoom(d, room.id, change), mergeKey);
  const rooms = doc.world?.rooms ?? [];
  const incoming = rooms.filter((r) => r.exits.some((e) => e.to === room.id)).length;
  const hasBlock = room.passage ? endsWithExits(doc, room.passage) : false;

  return (
    <section
      className="card wroom"
      data-testid="room-inspector"
      aria-label={labelText(room.name, t.locale, room.id)}
    >
      <div className="card__grid">
        <LabelFields
          value={room.name}
          prefix={t('world.name')}
          testId="room-name"
          onChange={(name) => set((r) => ({ ...r, name }), `room-name:${room.id}`)}
        />
      </div>
      <div className="setting">
        <span className="ie-label">{t('world.passage')}</span>
        <div className="row row--wrap">
          <PassagePicker
            doc={doc}
            value={room.passage}
            label={t('world.passage')}
            testId="room-passage"
            onChange={(passage) => set((r) => ({ ...r, passage }))}
          />
          {room.passage && (
            <button
              type="button"
              className="ie-button ie-button--quiet"
              data-testid="room-open-passage"
              onClick={() => {
                openPassage(room.passage);
                setView('write');
              }}
            >
              <PenLine size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('world.openPassage')}
            </button>
          )}
        </div>
        {room.passage &&
          (hasBlock ? (
            <p className="hint">{t('world.hasExitsBlock')}</p>
          ) : (
            <div className="stack">
              <p className="hint">{t('world.exitsTip')}</p>
              <button
                type="button"
                className="ie-button ie-button--quiet wroom__tip"
                data-testid="room-add-exits-block"
                onClick={() => edit((d) => appendExitsBlock(d, room.passage))}
              >
                <Signpost size={16} strokeWidth={1.5} aria-hidden="true" />
                {t('world.addExitsBlock')}
              </button>
            </div>
          ))}
      </div>
      <div className="row row--wrap">
        <Coordinate
          label={t('world.x')}
          value={room.x}
          testId="room-x"
          onChange={(x) => set((r) => ({ ...r, x }), `room-x:${room.id}`)}
        />
        <Coordinate
          label={t('world.y')}
          value={room.y}
          testId="room-y"
          onChange={(y) => set((r) => ({ ...r, y }), `room-y:${room.id}`)}
        />
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={room.secret === true}
          onChange={(e) =>
            set((r) => {
              if (e.target.checked) return { ...r, secret: true };
              const { secret: _gone, ...rest } = r;
              return rest;
            })
          }
        />
        <span>{t('world.secret')}</span>
      </label>
      <div className="setting">
        <span className="ie-label">{t('world.exits')}</span>
        {room.exits.length === 0 ? (
          <p className="hint">{t('world.noExits')}</p>
        ) : (
          <ul className="wexits">
            {room.exits.map((exit) => (
              <ExitRow key={exit.id} doc={doc} room={room} exit={exit} />
            ))}
          </ul>
        )}
        <AddExit key={room.id} doc={doc} room={room} />
      </div>
      <div className="card__foot">
        <span className="hint">{t('world.deleteHint')}</span>
        <DeleteButton
          uses={incoming}
          onDelete={() => {
            edit((d) => deleteRoom(d, room.id));
            onDeleted();
          }}
        />
      </div>
    </section>
  );
}
