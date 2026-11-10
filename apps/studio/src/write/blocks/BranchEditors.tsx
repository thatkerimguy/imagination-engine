import { createId } from '@ie/core';
import { listKey, type CheckBlock, type IfBlock, type RandomBlock } from '@ie/story';
import { Plus, X } from 'lucide-react';
import { newText } from '../../project/factory.ts';
import { useT } from '../../store.ts';
import { BlockList } from '../BlockList.tsx';
import { ConditionBuilder } from '../ConditionBuilder.tsx';
import { useWrite } from '../context.ts';
import { TextField } from '../TextField.tsx';
import { ValueField } from '../ValueField.tsx';

const DICE = ['1d6', '2d6', '3d6', '1d10', '1d20', '1d100'] as const;

function RemoveButton({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ie-button ie-button--quiet icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <X size={16} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}

/** If / Else if / Else, each branch with a condition and its own blocks. */
export function IfEditor({ block }: { readonly block: IfBlock }) {
  const t = useT();
  const { doc, editor } = useWrite();
  const set = (change: (b: IfBlock) => IfBlock) =>
    editor.block(block.id, (b) => change(b as IfBlock));

  return (
    <div className="branches">
      {block.branches.map((branch, index) => (
        <div className="branch" key={branch.id}>
          <div className="branch__head">
            <span className="branch__label">{t(index === 0 ? 'if.if' : 'if.elseIf')}</span>
            {block.branches.length > 1 && (
              <RemoveButton
                label={t('if.removeBranch')}
                onClick={() =>
                  set((b) => ({ ...b, branches: b.branches.filter((x) => x.id !== branch.id) }))
                }
              />
            )}
          </div>
          <ConditionBuilder
            doc={doc}
            value={branch.when}
            required
            label={t('if.condition')}
            testId="if-condition"
            onChange={(when) =>
              set((b) => ({
                ...b,
                branches: b.branches.map((x) =>
                  x.id === branch.id ? { ...x, when: when ?? true } : x,
                ),
              }))
            }
          />
          <BlockList listKey={listKey.branch(branch.id)} blocks={branch.then} nested />
        </div>
      ))}
      {block.else && (
        <div className="branch">
          <div className="branch__head">
            <span className="branch__label">{t('if.else')}</span>
            <RemoveButton
              label={t('if.removeElse')}
              onClick={() =>
                set((b) => {
                  const copy = { ...b };
                  delete copy.else;
                  return copy;
                })
              }
            />
          </div>
          <BlockList listKey={listKey.else(block.id)} blocks={block.else} nested />
        </div>
      )}
      <div className="row row--wrap">
        <button
          type="button"
          className="ie-button ie-button--quiet"
          onClick={() =>
            set((b) => ({
              ...b,
              branches: [...b.branches, { id: createId('br'), when: true, then: [] }],
            }))
          }
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('if.addElseIf')}
        </button>
        {!block.else && (
          <button
            type="button"
            className="ie-button ie-button--quiet"
            onClick={() => set((b) => ({ ...b, else: [] }))}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('if.addElse')}
          </button>
        )}
      </div>
    </div>
  );
}

/** A dice check: roll + modifier against a target, with a success and a fail branch. */
export function CheckEditor({ block }: { readonly block: CheckBlock }) {
  const t = useT();
  const { editor, locale } = useWrite();
  const set = (change: Partial<CheckBlock>, mergeKey?: string) =>
    editor.block(block.id, (b) => ({ ...(b as CheckBlock), ...change }), mergeKey);

  return (
    <div className="branches">
      <TextField
        value={block.label?.[locale] ?? ''}
        locale={locale}
        label={t('check.label')}
        placeholder={t('check.labelPlaceholder')}
        onChange={(v) => {
          if (block.label) return editor.text(block.label.id, locale, v);
          set({ label: { ...newText(), [locale]: v } });
        }}
      />
      <div className="row row--wrap">
        <label className="inline-field">
          <span>{t('check.dice')}</span>
          <select
            className="picker"
            value={block.dice}
            onChange={(e) => set({ dice: e.target.value })}
          >
            {!DICE.includes(block.dice as (typeof DICE)[number]) && (
              <option value={block.dice}>{block.dice}</option>
            )}
            {DICE.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span>{t('check.modifier')}</span>
          <ValueField
            type="number"
            value={block.modifier ?? 0}
            label={t('check.modifier')}
            onChange={(modifier) => set({ modifier }, `mod:${block.id}`)}
          />
        </label>
        <label className="inline-field">
          <span>{t('check.target')}</span>
          <ValueField
            type="number"
            value={block.target}
            label={t('check.target')}
            onChange={(target) => set({ target }, `target:${block.id}`)}
          />
        </label>
      </div>
      <div className="branch">
        <span className="branch__label">{t('check.success')}</span>
        <BlockList listKey={listKey.success(block.id)} blocks={block.success} nested />
      </div>
      <div className="branch">
        <span className="branch__label">{t('check.fail')}</span>
        <BlockList listKey={listKey.fail(block.id)} blocks={block.fail} nested />
      </div>
    </div>
  );
}

/** A random branch: one of several paths, picked by weight. */
export function RandomEditor({ block }: { readonly block: RandomBlock }) {
  const t = useT();
  const { editor } = useWrite();
  const set = (change: (b: RandomBlock) => RandomBlock) =>
    editor.block(block.id, (b) => change(b as RandomBlock));
  const total = block.branches.reduce((sum, b) => sum + (b.weight ?? 1), 0);

  return (
    <div className="branches">
      {block.branches.map((branch, index) => (
        <div className="branch" key={branch.id}>
          <div className="branch__head">
            <span className="branch__label">
              {t('random.branch', {
                n: index + 1,
                percent: Math.round(((branch.weight ?? 1) / total) * 100),
              })}
            </span>
            <label className="inline-field">
              <span>{t('random.weight')}</span>
              <input
                className="field field--number"
                type="number"
                min={1}
                inputMode="numeric"
                value={branch.weight ?? 1}
                onChange={(e) => {
                  const weight = Math.max(1, Number(e.target.value) || 1);
                  set((b) => ({
                    ...b,
                    branches: b.branches.map((x) => (x.id === branch.id ? { ...x, weight } : x)),
                  }));
                }}
              />
            </label>
            {block.branches.length > 1 && (
              <RemoveButton
                label={t('random.remove')}
                onClick={() =>
                  set((b) => ({ ...b, branches: b.branches.filter((x) => x.id !== branch.id) }))
                }
              />
            )}
          </div>
          <BlockList listKey={listKey.branch(branch.id)} blocks={branch.then} nested />
        </div>
      ))}
      <button
        type="button"
        className="ie-button ie-button--quiet"
        onClick={() =>
          set((b) => ({ ...b, branches: [...b.branches, { id: createId('br'), then: [] }] }))
        }
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('random.add')}
      </button>
    </div>
  );
}
