import {
  ITEM_OPS,
  listKey,
  QUEST_OPS,
  type BattleBlock,
  type Formula,
  type ItemBlock,
  type ItemOp,
  type QuestBlock,
  type QuestOp,
  type RoutineBlock,
  type ShopBlock,
} from '@ie/story';
import { Plus, X } from 'lucide-react';
import type { MessageKey } from '../../messages.ts';
import { useStudio, useT } from '../../store.ts';
import { BlockList } from '../BlockList.tsx';
import { useWrite } from '../context.ts';
import { labelText } from '../edit.ts';
import { VariablePicker } from '../pickers.tsx';
import { ItemPicker, QuestPicker, RoutinePicker } from '../rpg-pickers.tsx';
import { Sentence } from '../Sentence.tsx';
import { ValueField } from '../ValueField.tsx';
import { EnemyPicker } from './FightEditor.tsx';

/** Drops an optional key, so a cleared field leaves no `undefined` behind in the saved file. */
function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const { [key]: _gone, ...rest } = value;
  return rest;
}

function useBlock<B extends { id: string }>(block: B) {
  const { editor } = useWrite();
  return (change: (b: B) => B, mergeKey?: string) =>
    editor.block(block.id, (b) => change(b as unknown as B) as never, mergeKey);
}

/** "Give 2 × Potion": a verb, a count and an item. */
export function ItemEditor({ block }: { readonly block: ItemBlock }) {
  const t = useT();
  const { doc } = useWrite();
  const set = useBlock(block);
  return (
    <div className="row row--wrap">
      <Sentence
        template={t('itemBlock.sentence')}
        slots={{
          op: (
            <select
              className="picker picker--verb"
              aria-label={t('itemBlock.op')}
              value={block.op}
              data-testid="item-op"
              onChange={(e) => set((b) => ({ ...b, op: e.target.value as ItemOp }))}
            >
              {ITEM_OPS.map((op) => (
                <option key={op} value={op}>
                  {t(`itemOp.${op}` as MessageKey)}
                </option>
              ))}
            </select>
          ),
          count: (
            <ValueField
              type="number"
              value={block.count ?? 1}
              label={t('itemBlock.count')}
              onChange={(count) =>
                set((b) => (count === 1 ? without(b, 'count') : { ...b, count }))
              }
            />
          ),
          item: (
            <ItemPicker
              doc={doc}
              value={block.item}
              label={t('itemBlock.item')}
              testId="item-item"
              onChange={(item) => set((b) => ({ ...b, item }))}
            />
          ),
        }}
      />
    </div>
  );
}

/** "Start the quest", "Move it to a step", "Complete it", "Fail it". */
export function QuestEditor({ block }: { readonly block: QuestBlock }) {
  const t = useT();
  const { doc } = useWrite();
  const locale = useStudio((s) => s.locale);
  const set = useBlock(block);
  const quest = doc.quests?.find((q) => q.id === block.quest);
  return (
    <div className="row row--wrap">
      <Sentence
        template={t(block.op === 'step' ? 'questBlock.sentenceStep' : 'questBlock.sentence')}
        slots={{
          op: (
            <select
              className="picker picker--verb"
              aria-label={t('questBlock.op')}
              value={block.op}
              data-testid="quest-op"
              onChange={(e) => {
                const op = e.target.value as QuestOp;
                set((b) =>
                  op === 'step'
                    ? { ...b, op, step: b.step ?? quest?.steps[0]?.id ?? '' }
                    : without({ ...b, op }, 'step'),
                );
              }}
            >
              {QUEST_OPS.map((op) => (
                <option key={op} value={op}>
                  {t(`questOp.${op}` as MessageKey)}
                </option>
              ))}
            </select>
          ),
          quest: (
            <QuestPicker
              doc={doc}
              value={block.quest}
              label={t('questBlock.quest')}
              testId="quest-quest"
              onChange={(id) => set((b) => without({ ...b, quest: id }, 'step'))}
            />
          ),
          step: (
            <select
              className="picker"
              aria-label={t('questBlock.step')}
              value={block.step ?? ''}
              onChange={(e) => set((b) => ({ ...b, step: e.target.value }))}
            >
              {!quest?.steps.some((s) => s.id === block.step) && (
                <option value="">{t('pick.step')}</option>
              )}
              {(quest?.steps ?? []).map((s, i) => (
                <option key={s.id} value={s.id}>
                  {labelText(s.text, locale, String(i + 1))}
                </option>
              ))}
            </select>
          ),
        }}
      />
    </div>
  );
}

/** A shop: what money it takes, what it sells (and for how much), and whether it buys. */
export function ShopEditor({ block }: { readonly block: ShopBlock }) {
  const t = useT();
  const { doc } = useWrite();
  const set = useBlock(block);
  const setStock = (stock: ShopBlock['stock']) => set((b) => ({ ...b, stock }));
  return (
    <div className="branches">
      <div className="row row--wrap">
        <Sentence
          template={t('shopBlock.sentence')}
          slots={{
            currency: (
              <VariablePicker
                doc={doc}
                value={block.currency}
                label={t('shopBlock.currency')}
                types={['number']}
                testId="shop-currency"
                onChange={(currency) => set((b) => ({ ...b, currency }))}
              />
            ),
          }}
        />
      </div>
      <span className="branch__label">{t('shopBlock.stock')}</span>
      {block.stock.map((stock, index) => {
        const base = doc.items?.find((i) => i.id === stock.item)?.price ?? 0;
        return (
          <div className="row row--wrap" key={`${stock.item}:${index}`}>
            <ItemPicker
              doc={doc}
              value={stock.item}
              label={t('itemBlock.item')}
              testId="shop-item"
              onChange={(item) => setStock(block.stock.with(index, { ...stock, item }))}
            />
            <input
              className="field field--number"
              type="number"
              min={0}
              inputMode="numeric"
              aria-label={t('shopBlock.price')}
              placeholder={String(base)}
              title={t('shopBlock.defaultPrice', { price: base })}
              value={stock.price ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                const next =
                  value === ''
                    ? without(stock, 'price')
                    : { ...stock, price: Math.max(0, Math.round(Number(value))) };
                setStock(block.stock.with(index, next));
              }}
            />
            <button
              type="button"
              className="ie-button ie-button--quiet"
              aria-label={t('shopBlock.remove')}
              title={t('shopBlock.remove')}
              onClick={() => setStock(block.stock.toSpliced(index, 1))}
            >
              <X size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <div className="row row--wrap">
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid="shop-add"
          onClick={() => setStock([...block.stock, { item: doc.items?.[0]?.id ?? '' }])}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('shopBlock.add')}
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={block.sells === true}
            onChange={(e) =>
              set((b) => (e.target.checked ? { ...b, sells: true } : without(b, 'sells')))
            }
          />
          <span>{t('shopBlock.sells')}</span>
        </label>
      </div>
    </div>
  );
}

/** "Battle the Rat", whether the reader may run, then what happens on a win, a loss, an escape. */
export function BattleEditor({ block }: { readonly block: BattleBlock }) {
  const t = useT();
  const { doc } = useWrite();
  const set = useBlock(block);
  return (
    <div className="branches">
      <div className="row row--wrap">
        <Sentence
          template={t('battleBlock.sentence')}
          slots={{
            enemy: (
              <EnemyPicker
                doc={doc}
                value={block.enemy}
                onChange={(enemy) => set((b) => ({ ...b, enemy }))}
              />
            ),
          }}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={block.flee === true}
            data-testid="battle-flee"
            onChange={(e) =>
              set((b) =>
                e.target.checked
                  ? { ...b, flee: true, fled: b.fled ?? [] }
                  : without(without(b, 'flee'), 'fled'),
              )
            }
          />
          <span>{t('battleBlock.flee')}</span>
        </label>
      </div>
      <p className="hint">{t('battleBlock.heroHint')}</p>
      <div className="branch">
        <span className="branch__label">{t('battleBlock.win')}</span>
        <BlockList listKey={listKey.win(block.id)} blocks={block.win} nested testId="battle-win" />
      </div>
      <div className="branch">
        <span className="branch__label">{t('battleBlock.lose')}</span>
        <BlockList
          listKey={listKey.lose(block.id)}
          blocks={block.lose}
          nested
          testId="battle-lose"
        />
      </div>
      {block.fled && (
        <div className="branch">
          <span className="branch__label">{t('battleBlock.fled')}</span>
          <BlockList listKey={listKey.fled(block.id)} blocks={block.fled} nested />
        </div>
      )}
    </div>
  );
}

/** "Run Reward" and a value for each of the routine's inputs. */
export function RoutineCallEditor({ block }: { readonly block: RoutineBlock }) {
  const t = useT();
  const { doc } = useWrite();
  const locale = useStudio((s) => s.locale);
  const set = useBlock(block);
  const routine = doc.routines?.find((r) => r.id === block.routine);
  if (!doc.routines?.length) return <p className="hint">{t('routineBlock.none')}</p>;
  const setArg = (id: string, value: Formula) =>
    set((b) => ({ ...b, args: { ...b.args, [id]: value } }), `args:${block.id}:${id}`);
  return (
    <div className="branches">
      <div className="row row--wrap">
        <Sentence
          template={t('routineBlock.sentence')}
          slots={{
            routine: (
              <RoutinePicker
                doc={doc}
                value={block.routine}
                label={t('routineBlock.routine')}
                testId="routine-pick"
                onChange={(routine) => set(() => ({ id: block.id, type: 'routine', routine }))}
              />
            ),
          }}
        />
      </div>
      {(routine?.params ?? []).map((param) => (
        <label className="inline-field" key={param.id}>
          <span>{labelText(param.name, locale, param.id)}</span>
          <ValueField
            type={param.type}
            value={
              block.args?.[param.id] ??
              (param.type === 'number' ? 0 : param.type === 'bool' ? false : '""')
            }
            label={labelText(param.name, locale, param.id)}
            onChange={(value) => setArg(param.id, value)}
          />
        </label>
      ))}
    </div>
  );
}
