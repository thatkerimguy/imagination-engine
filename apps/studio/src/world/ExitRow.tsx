import {
  DIRECTIONS,
  type Direction,
  type ExitDef,
  type Formula,
  type LocalText,
  type RoomDef,
  type StoryProject,
} from '@ie/story';
import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { LabelFields } from '../data/LabelFields.tsx';
import type { MessageKey } from '../messages.ts';
import { newText } from '../project/factory.ts';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { ConditionBuilder } from '../write/ConditionBuilder.tsx';
import { labelText } from '../write/edit.ts';
import { removeExit, updateExit } from './world-edit.ts';

/** Drops an optional key, so a cleared field leaves no `undefined` behind in the saved file. */
function without<K extends keyof ExitDef>(exit: ExitDef, key: K): ExitDef {
  const { [key]: _gone, ...rest } = exit;
  return rest as ExitDef;
}

/** Words in both languages kept as a line (with an ID), dropped when both are empty. */
function setWords(exit: ExitDef, key: 'label' | 'lockedText', words: Partial<LocalText>): ExitDef {
  if (!words.en?.trim() && !words.tr?.trim()) return without(exit, key);
  return { ...exit, [key]: { ...(exit[key] ?? newText()), ...words } };
}

export function DirectionPicker({
  value,
  onChange,
  testId,
}: {
  readonly value: Direction;
  readonly onChange: (dir: Direction) => void;
  readonly testId?: string;
}) {
  const t = useT();
  return (
    <select
      className="picker"
      aria-label={t('world.exitDir')}
      value={value}
      data-testid={testId}
      onChange={(e) => onChange(e.target.value as Direction)}
    >
      {DIRECTIONS.map((d) => (
        <option key={d} value={d}>
          {t(`dir.${d}` as MessageKey)}
        </option>
      ))}
    </select>
  );
}

export function RoomPicker({
  rooms,
  value,
  onChange,
  testId,
}: {
  readonly rooms: readonly RoomDef[];
  readonly value: string;
  readonly onChange: (roomId: string) => void;
  readonly testId?: string;
}) {
  const t = useT();
  return (
    <select
      className="picker"
      aria-label={t('world.exitTo')}
      value={value}
      data-testid={testId}
      onChange={(e) => onChange(e.target.value)}
    >
      {!value && <option value="">{t('world.pickRoom')}</option>}
      {rooms.map((r) => (
        <option key={r.id} value={r.id}>
          {labelText(r.name, t.locale, r.id)}
        </option>
      ))}
    </select>
  );
}

/** One way out: direction, target, and (folded away) words and conditions. */
export function ExitRow({
  doc,
  room,
  exit,
}: {
  readonly doc: StoryProject;
  readonly room: RoomDef;
  readonly exit: ExitDef;
}) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const [open, setOpen] = useState(false);
  const others = (doc.world?.rooms ?? []).filter((r) => r.id !== room.id);
  const set = (change: (e: ExitDef) => ExitDef, mergeKey?: string) =>
    edit((d) => updateExit(d, room.id, exit.id, change), mergeKey);
  const condition = (key: 'visibleIf' | 'enabledIf') => (f: Formula | undefined) =>
    set((e) => (f === undefined ? without(e, key) : { ...e, [key]: f }));

  return (
    <li className="wexit" data-testid="wexit">
      <div className="row row--wrap">
        <DirectionPicker
          value={exit.dir}
          testId="wexit-dir"
          onChange={(dir) => set((e) => ({ ...e, dir }))}
        />
        <RoomPicker
          rooms={others}
          value={exit.to}
          testId="wexit-to"
          onChange={(to) => set((e) => ({ ...e, to }))}
        />
        <button
          type="button"
          className="ie-button ie-button--quiet icon-button"
          aria-expanded={open}
          aria-label={t('world.exitConditions')}
          title={t('world.exitConditions')}
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet icon-button"
          aria-label={t('world.removeExit')}
          title={t('world.removeExit')}
          data-testid="wexit-remove"
          onClick={() => edit((d) => removeExit(d, room.id, exit.id))}
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="wexit__more stack">
          <div className="card__grid">
            <LabelFields
              value={exit.label}
              prefix={t('world.exitLabel')}
              onChange={(l) => set((e) => setWords(e, 'label', l), `exit-label:${exit.id}`)}
            />
          </div>
          <div className="setting">
            <span className="ie-label">{t('world.exitShowIf')}</span>
            <ConditionBuilder
              doc={doc}
              value={exit.visibleIf}
              label={t('world.exitShowIf')}
              onChange={condition('visibleIf')}
            />
          </div>
          <div className="setting">
            <span className="ie-label">{t('world.exitOpenIf')}</span>
            <ConditionBuilder
              doc={doc}
              value={exit.enabledIf}
              label={t('world.exitOpenIf')}
              onChange={condition('enabledIf')}
            />
          </div>
          {exit.enabledIf !== undefined && (
            <div className="card__grid">
              <LabelFields
                value={exit.lockedText}
                prefix={t('world.exitLocked')}
                onChange={(l) => set((e) => setWords(e, 'lockedText', l), `exit-lock:${exit.id}`)}
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}
