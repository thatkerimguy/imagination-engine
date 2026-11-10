import {
  PLAYER_PANELS,
  SCREEN_ACTIONS,
  type ScreenAction,
  type ScreenDef,
  type StoryProject,
} from '@ie/story';
import { Plus, X } from 'lucide-react';
import type { MessageKey } from '../messages.ts';
import { useStudio, useT } from '../store.ts';
import { OPS_FOR, type SetOp } from '../write/blocks/LogicEditors.tsx';
import { labelText } from '../write/edit.ts';
import { VariablePicker } from '../write/pickers.tsx';
import { ValueField } from '../write/ValueField.tsx';

type ActionType = ScreenAction['type'];
type SetAction = Extract<ScreenAction, { type: 'set' }>;

function firstPanel(doc: StoryProject, self: string): string {
  return doc.screens?.find((s) => s.kind === 'panel' && s.id !== self)?.id ?? '';
}

function newAction(type: ActionType, doc: StoryProject, self: string): ScreenAction {
  switch (type) {
    case 'open':
      return { type, screen: firstPanel(doc, self) };
    case 'menu':
      return { type, panel: 'settings' };
    case 'set':
      return { type, var: '', op: 'set', value: 0 };
    default:
      return { type };
  }
}

function SetFields({
  doc,
  action,
  onChange,
}: {
  readonly doc: StoryProject;
  readonly action: SetAction;
  readonly onChange: (action: ScreenAction, mergeKey?: string) => void;
}) {
  const t = useT();
  const variable = doc.variables.find((v) => v.id === action.var);
  const type = variable?.type ?? 'number';
  const op = action.op ?? 'set';
  const ops = OPS_FOR[type];
  const shape = (v: string, o: SetOp, value = action.value): SetAction =>
    o === 'toggle'
      ? { type: 'set', var: v, op: o }
      : { type: 'set', var: v, op: o, value: value ?? 0 };
  return (
    <>
      <VariablePicker
        doc={doc}
        value={action.var}
        label={t('set.variable')}
        testId="action-var"
        onChange={(id) => {
          const next = doc.variables.find((v) => v.id === id);
          const nextOps = OPS_FOR[next?.type ?? 'number'];
          const nextOp = nextOps.includes(op) ? op : (nextOps[0] ?? 'set');
          const value = next?.type === 'bool' ? true : next?.type === 'number' ? 0 : '""';
          onChange(shape(id, nextOp, value));
        }}
      />
      <select
        className="picker"
        aria-label={t('set.change')}
        value={op}
        onChange={(e) => onChange(shape(action.var, e.target.value as SetOp))}
      >
        {ops.map((o) => (
          <option key={o} value={o}>
            {t(`setOp.${o}` as MessageKey)}
          </option>
        ))}
      </select>
      {op !== 'toggle' && (
        <ValueField
          key={`${action.var}:${op}`}
          type={type === 'list' && op !== 'set' ? 'text' : type}
          values={variable?.values}
          value={action.value}
          label={t('set.value')}
          onChange={(value) => onChange({ ...action, value }, 'value')}
        />
      )}
    </>
  );
}

function ActionRow({
  doc,
  screen,
  action,
  onChange,
  onRemove,
}: {
  readonly doc: StoryProject;
  readonly screen: ScreenDef;
  readonly action: ScreenAction;
  readonly onChange: (action: ScreenAction, mergeKey?: string) => void;
  readonly onRemove: () => void;
}) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const panels = (doc.screens ?? []).filter((s) => s.kind === 'panel' && s.id !== screen.id);
  return (
    <div className="row row--wrap screen-action" data-testid="screen-action">
      <select
        className="picker picker--verb"
        aria-label={t('comp.actions')}
        value={action.type}
        data-testid="action-type"
        onChange={(e) => onChange(newAction(e.target.value as ActionType, doc, screen.id))}
      >
        {SCREEN_ACTIONS.map((type) => (
          <option key={type} value={type}>
            {t(`action.${type}` as MessageKey)}
          </option>
        ))}
      </select>
      {action.type === 'open' && (
        <select
          className="picker"
          aria-label={t('action.open')}
          value={action.screen}
          onChange={(e) => onChange({ type: 'open', screen: e.target.value })}
        >
          {!panels.some((p) => p.id === action.screen) && (
            <option value={action.screen}>{t('pick.screen')}</option>
          )}
          {panels.map((p) => (
            <option key={p.id} value={p.id}>
              {labelText(p.name, locale, p.id)}
            </option>
          ))}
        </select>
      )}
      {action.type === 'menu' && (
        <select
          className="picker"
          aria-label={t('action.menu')}
          value={action.panel}
          onChange={(e) =>
            onChange({ type: 'menu', panel: e.target.value as (typeof PLAYER_PANELS)[number] })
          }
        >
          {PLAYER_PANELS.map((panel) => (
            <option key={panel} value={panel}>
              {t(`panel.${panel}` as MessageKey)}
            </option>
          ))}
        </select>
      )}
      {action.type === 'set' && <SetFields doc={doc} action={action} onChange={onChange} />}
      <button
        type="button"
        className="ie-button ie-button--quiet icon-button"
        aria-label={t('comp.removeAction')}
        title={t('comp.removeAction')}
        onClick={onRemove}
      >
        <X size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}

/** What a button does, in order: "Open a screen: Journal", "Change a variable: Add 1 to Gold". */
export function ActionsEditor({
  doc,
  screen,
  actions,
  onChange,
}: {
  readonly doc: StoryProject;
  readonly screen: ScreenDef;
  readonly actions: readonly ScreenAction[];
  readonly onChange: (actions: readonly ScreenAction[], mergeKey?: string) => void;
}) {
  const t = useT();
  return (
    <div className="screen-actions">
      <span className="ie-label">{t('comp.actions')}</span>
      {actions.map((action, i) => (
        <ActionRow
          key={i}
          doc={doc}
          screen={screen}
          action={action}
          onChange={(next, key) => onChange(actions.with(i, next), key && `${key}:${i}`)}
          onRemove={() => onChange(actions.toSpliced(i, 1))}
        />
      ))}
      {actions.length < 8 && (
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="add-action"
          onClick={() =>
            onChange([
              ...actions,
              newAction(screen.kind === 'title' ? 'start' : 'close', doc, screen.id),
            ])
          }
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('comp.addAction')}
        </button>
      )}
    </div>
  );
}
