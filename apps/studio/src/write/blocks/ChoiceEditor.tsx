import { listKey, type ChoiceBlock, type ChoiceOption } from '@ie/story';
import { ArrowDown, ArrowUp, Ellipsis, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { MenuButton } from '../../components/Menu.tsx';
import { newOption, newText } from '../../project/factory.ts';
import { updateOption } from '../../project/tree.ts';
import { useT } from '../../store.ts';
import { BlockList } from '../BlockList.tsx';
import { ConditionBuilder } from '../ConditionBuilder.tsx';
import { useWrite } from '../context.ts';
import { VariablePicker } from '../pickers.tsx';
import { TextField } from '../TextField.tsx';
import { ValueField } from '../ValueField.tsx';

function OptionSettings({ option }: { readonly option: ChoiceOption }) {
  const t = useT();
  const { doc, editor, locale } = useWrite();
  const set = (change: (o: ChoiceOption) => ChoiceOption, mergeKey?: string) =>
    editor.edit((d) => updateOption(d, option.id, change), mergeKey);
  const without = <K extends keyof ChoiceOption>(o: ChoiceOption, key: K): ChoiceOption => {
    const copy = { ...o };
    delete copy[key];
    return copy;
  };

  return (
    <div className="option__settings" data-testid="option-settings">
      <div className="setting">
        <span className="ie-label">{t('option.visibleIf')}</span>
        <ConditionBuilder
          doc={doc}
          value={option.visibleIf}
          label={t('option.visibleIf')}
          onChange={(f) =>
            set((o) => (f === undefined ? without(o, 'visibleIf') : { ...o, visibleIf: f }))
          }
        />
      </div>
      <div className="setting">
        <span className="ie-label">{t('option.enabledIf')}</span>
        <ConditionBuilder
          doc={doc}
          value={option.enabledIf}
          label={t('option.enabledIf')}
          testId="enabled-if"
          onChange={(f) =>
            set((o) => (f === undefined ? without(o, 'enabledIf') : { ...o, enabledIf: f }))
          }
        />
      </div>
      {option.enabledIf !== undefined && (
        <div className="setting">
          <span className="ie-label">{t('option.lockedText')}</span>
          <TextField
            value={option.lockedText?.[locale] ?? ''}
            locale={locale}
            label={t('option.lockedText')}
            placeholder={t('option.lockedPlaceholder')}
            onChange={(v) => {
              if (option.lockedText) return editor.text(option.lockedText.id, locale, v);
              set((o) => ({ ...o, lockedText: { ...newText(), [locale]: v } }));
            }}
          />
        </div>
      )}
      <div className="setting">
        <label className="check">
          <input
            type="checkbox"
            checked={option.cost !== undefined}
            onChange={(e) =>
              set((o) =>
                e.target.checked
                  ? {
                      ...o,
                      cost: {
                        var: doc.variables.find((v) => v.type === 'number')?.id ?? '',
                        amount: 1,
                      },
                    }
                  : without(o, 'cost'),
              )
            }
          />
          <span>{t('option.cost')}</span>
        </label>
        {option.cost && (
          <span className="row">
            <ValueField
              type="number"
              value={option.cost.amount}
              label={t('option.costAmount')}
              onChange={(amount) =>
                set(
                  (o) => ({ ...o, cost: { var: o.cost?.var ?? '', amount } }),
                  `cost:${option.id}`,
                )
              }
            />
            <VariablePicker
              doc={doc}
              value={option.cost.var}
              types={['number']}
              label={t('option.costVariable')}
              onChange={(id) =>
                set((o) => ({ ...o, cost: { amount: o.cost?.amount ?? 1, var: id } }))
              }
            />
          </span>
        )}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={option.once === true}
          onChange={(e) =>
            set((o) => (e.target.checked ? { ...o, once: true } : without(o, 'once')))
          }
        />
        <span>{t('option.once')}</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={option.showOdds === true}
          disabled={option.then[0]?.type !== 'check' && !option.showOdds}
          onChange={(e) =>
            set((o) => (e.target.checked ? { ...o, showOdds: true } : without(o, 'showOdds')))
          }
        />
        <span>{t('option.odds')}</span>
      </label>
    </div>
  );
}

function OptionRow({
  choice,
  option,
  index,
}: {
  readonly choice: ChoiceBlock;
  readonly option: ChoiceOption;
  readonly index: number;
}) {
  const t = useT();
  const { editor, locale } = useWrite();
  const [open, setOpen] = useState(false);
  const flags = [
    option.visibleIf !== undefined && t('option.flagHidden'),
    option.enabledIf !== undefined && t('option.flagLocked'),
    option.cost && t('option.flagCost'),
    option.once && t('option.flagOnce'),
  ].filter(Boolean);
  const options = (change: (list: readonly ChoiceOption[]) => readonly ChoiceOption[]) =>
    editor.block(
      choice.id,
      (b) => ({ ...b, options: change((b as ChoiceBlock).options) }) as ChoiceBlock,
    );

  return (
    <li className="option" data-testid="option">
      <div className="option__head">
        <span className="option__key" aria-hidden="true">
          {index + 1}
        </span>
        <TextField
          value={option.text[locale] ?? ''}
          locale={locale}
          label={t('option.text', { n: index + 1 })}
          placeholder={t('option.placeholder')}
          testId="option-text"
          onChange={(v) => editor.text(option.text.id, locale, v)}
        />
        <button
          type="button"
          className="ie-button ie-button--quiet icon-button"
          aria-expanded={open}
          aria-label={t('option.settings')}
          title={t('option.settings')}
          data-testid="option-settings-toggle"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <MenuButton
          label={t('option.menu')}
          align="end"
          items={[
            {
              id: 'up',
              label: t('block.up'),
              icon: ArrowUp,
              disabled: index === 0,
              onSelect: () => options((l) => l.toSpliced(index, 1).toSpliced(index - 1, 0, option)),
            },
            {
              id: 'down',
              label: t('block.down'),
              icon: ArrowDown,
              disabled: index === choice.options.length - 1,
              onSelect: () => options((l) => l.toSpliced(index, 1).toSpliced(index + 1, 0, option)),
            },
            {
              id: 'delete',
              label: t('option.delete'),
              icon: Trash2,
              danger: true,
              disabled: choice.options.length === 1,
              onSelect: () => options((l) => l.filter((o) => o.id !== option.id)),
            },
          ]}
        >
          <Ellipsis size={16} strokeWidth={1.5} aria-hidden="true" />
        </MenuButton>
      </div>
      {flags.length > 0 && !open && <p className="option__flags">{flags.join(' · ')}</p>}
      {open && <OptionSettings option={option} />}
      <BlockList listKey={listKey.option(option.id)} blocks={option.then} nested />
    </li>
  );
}

export function ChoiceEditor({ block }: { readonly block: ChoiceBlock }) {
  const t = useT();
  const { editor, locale } = useWrite();
  const set = (change: (b: ChoiceBlock) => ChoiceBlock) =>
    editor.block(block.id, (b) => change(b as ChoiceBlock));

  return (
    <div className="choice-editor">
      {block.prompt ? (
        <TextField
          value={block.prompt[locale] ?? ''}
          locale={locale}
          label={t('choice.prompt')}
          placeholder={t('choice.promptPlaceholder')}
          onChange={(v) => block.prompt && editor.text(block.prompt.id, locale, v)}
        />
      ) : null}
      <ol className="options">
        {block.options.map((option, index) => (
          <OptionRow key={option.id} choice={block} option={option} index={index} />
        ))}
      </ol>
      <div className="row row--wrap">
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="add-option"
          onClick={() => set((b) => ({ ...b, options: [...b.options, newOption()] }))}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('choice.addOption')}
        </button>
        {!block.prompt && (
          <button
            type="button"
            className="ie-button ie-button--quiet"
            onClick={() => set((b) => ({ ...b, prompt: newText() }))}
          >
            {t('choice.addPrompt')}
          </button>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={block.timer !== undefined}
            onChange={(e) =>
              set((b) => {
                if (e.target.checked) return { ...b, timer: { seconds: 10 } };
                const copy = { ...b };
                delete copy.timer;
                return copy;
              })
            }
          />
          <span>{t('choice.timed')}</span>
        </label>
        {block.timer && (
          <span className="row">
            <input
              className="field field--number"
              type="number"
              min={1}
              inputMode="numeric"
              aria-label={t('choice.seconds')}
              value={block.timer.seconds}
              onChange={(e) =>
                set((b) => ({
                  ...b,
                  timer: { ...b.timer, seconds: Math.max(1, Number(e.target.value) || 1) },
                }))
              }
            />
            <span>{t('unit.seconds')}</span>
            <select
              className="picker"
              aria-label={t('choice.default')}
              value={block.timer.default ?? ''}
              onChange={(e) =>
                set((b) => ({
                  ...b,
                  timer: e.target.value
                    ? { seconds: b.timer?.seconds ?? 10, default: e.target.value }
                    : { seconds: b.timer?.seconds ?? 10 },
                }))
              }
            >
              <option value="">{t('choice.defaultFirst')}</option>
              {block.options.map((o, i) => (
                <option key={o.id} value={o.id}>
                  {t('choice.defaultOption', { n: i + 1, text: o.text[locale] || '…' })}
                </option>
              ))}
            </select>
          </span>
        )}
      </div>
    </div>
  );
}
