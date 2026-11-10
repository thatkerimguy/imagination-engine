import type { SET_OPS } from '@ie/story';
import {
  type ActionBlock,
  type CallBlock,
  type JumpBlock,
  type ReturnBlock,
  type SetBlock,
  type VariableType,
} from '@ie/story';
import type { MessageKey } from '../../messages.ts';
import { useT } from '../../store.ts';
import { useWrite } from '../context.ts';
import { PassagePicker, VariablePicker } from '../pickers.tsx';
import { Sentence } from '../Sentence.tsx';
import { ValueField } from '../ValueField.tsx';

type SetOp = (typeof SET_OPS)[number];

/** Which changes make sense for each variable type. */
const OPS_FOR: Readonly<Record<VariableType, readonly SetOp[]>> = {
  number: ['set', 'add', 'subtract'],
  text: ['set'],
  bool: ['set', 'toggle'],
  enum: ['set'],
  list: ['append', 'remove', 'set'],
};

/** "Set Gold to 10", "Add 5 to Gold", "Flip Warned": a sentence with dropdowns in its blanks. */
export function SetEditor({ block }: { readonly block: SetBlock }) {
  const t = useT();
  const { doc, editor } = useWrite();
  const variable = doc.variables.find((v) => v.id === block.var);
  const type = variable?.type ?? 'number';
  const op = block.op ?? 'set';
  const ops = OPS_FOR[type];
  const set = (change: Partial<SetBlock>, mergeKey?: string) =>
    editor.block(block.id, (b) => ({ ...(b as SetBlock), ...change }), mergeKey);

  const varSlot = (
    <VariablePicker
      doc={doc}
      value={block.var}
      label={t('set.variable')}
      testId="set-variable"
      onChange={(id) => {
        const next = doc.variables.find((v) => v.id === id);
        const nextOps = OPS_FOR[next?.type ?? 'number'];
        const nextOp = nextOps.includes(op) ? op : (nextOps[0] ?? 'set');
        const value = next?.type === 'bool' ? true : next?.type === 'number' ? 0 : '""';
        editor.block(block.id, () =>
          nextOp === 'toggle'
            ? { id: block.id, type: 'set', var: id, op: nextOp }
            : { id: block.id, type: 'set', var: id, op: nextOp, value },
        );
      }}
    />
  );
  const valueSlot =
    op === 'toggle' ? null : (
      <ValueField
        key={`${block.var}:${op}`}
        type={type === 'list' && op !== 'set' ? 'text' : type}
        values={variable?.values}
        value={block.value}
        label={t('set.value')}
        testId="set-value"
        onChange={(value) => set({ value }, `set:${block.id}`)}
      />
    );

  return (
    <div className="row row--wrap">
      <select
        className="picker picker--verb"
        aria-label={t('set.change')}
        value={op}
        onChange={(e) => {
          const nextOp = e.target.value as SetOp;
          editor.block(block.id, () =>
            nextOp === 'toggle'
              ? { id: block.id, type: 'set', var: block.var, op: nextOp }
              : { id: block.id, type: 'set', var: block.var, op: nextOp, value: block.value ?? 0 },
          );
        }}
      >
        {ops.map((o) => (
          <option key={o} value={o}>
            {t(`setOp.${o}` as MessageKey)}
          </option>
        ))}
      </select>
      <Sentence
        template={t(`sentence.${op}` as MessageKey)}
        slots={{ var: varSlot, value: valueSlot }}
      />
    </div>
  );
}

/** Jump, Call, Return and module actions: where the story goes next. */
export function FlowEditor({
  block,
}: {
  readonly block: JumpBlock | CallBlock | ReturnBlock | ActionBlock;
}) {
  const t = useT();
  const { doc, editor } = useWrite();
  if (block.type === 'return') return <p className="sentence">{t('sentence.return')}</p>;
  if (block.type === 'action')
    return (
      <p className="sentence">
        <code>{block.action}</code> <span className="hint">{t('action.later')}</span>
      </p>
    );
  return (
    <Sentence
      template={t(block.type === 'jump' ? 'sentence.jump' : 'sentence.call')}
      slots={{
        passage: (
          <PassagePicker
            doc={doc}
            value={block.to}
            label={t('jump.target')}
            testId="jump-target"
            onChange={(to) => editor.block(block.id, (b) => ({ ...(b as JumpBlock), to }))}
          />
        ),
      }}
    />
  );
}
