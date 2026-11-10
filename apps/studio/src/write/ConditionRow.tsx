import type { StoryProject } from '@ie/story';
import {
  opsFor,
  defaultRow,
  QUEST_CHECKS,
  type CompareOp,
  type ConditionRow,
  type QuestCheck,
} from '../project/condition.ts';
import { allPassages, walkBlocks } from '../project/tree.ts';
import type { MessageKey } from '../messages.ts';
import { useStudio, useT } from '../store.ts';
import { labelText, useWriteLocale } from './edit.ts';
import { PassagePicker, VariablePicker } from './pickers.tsx';
import { ItemPicker, QuestPicker } from './rpg-pickers.tsx';
import { PlainValue } from './ValueField.tsx';

const OP_LABEL: Readonly<Record<CompareOp, MessageKey>> = {
  '==': 'op.eq',
  '!=': 'op.ne',
  '<': 'op.lt',
  '<=': 'op.le',
  '>': 'op.gt',
  '>=': 'op.ge',
};

const SUBJECT_VISITED = '__visited__';
const SUBJECT_CHOSEN = '__chosen__';
const SUBJECT_OWNED = '__owned__';
const SUBJECT_QUEST = '__quest__';

function subjectOf(row: ConditionRow): string {
  if (row.kind === 'visited') return SUBJECT_VISITED;
  if (row.kind === 'chosen') return SUBJECT_CHOSEN;
  if (row.kind === 'owned') return SUBJECT_OWNED;
  if (row.kind === 'quest') return SUBJECT_QUEST;
  return row.var;
}

const isStorySubject = (row: ConditionRow) => !('var' in row);

/** One condition row: subject, comparison and value, as dropdowns and a box. */
export function RowEditor({
  doc,
  row,
  onChange,
}: {
  readonly doc: StoryProject;
  readonly row: ConditionRow;
  readonly onChange: (row: ConditionRow) => void;
}) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const writeLocale = useWriteLocale();

  const subject = (
    <select
      className="picker"
      aria-label={t('condition.subject')}
      value={subjectOf(row)}
      onChange={(e) => {
        const value = e.target.value;
        if (value === SUBJECT_VISITED)
          return onChange({ kind: 'visited', passage: allPassages(doc)[0]?.id ?? '', is: true });
        if (value === SUBJECT_CHOSEN) return onChange({ kind: 'chosen', option: '', is: true });
        if (value === SUBJECT_OWNED)
          return onChange({ kind: 'owned', item: doc.items?.[0]?.id ?? '', is: true });
        if (value === SUBJECT_QUEST)
          return onChange({
            kind: 'quest',
            quest: doc.quests?.[0]?.id ?? '',
            status: 'done',
            is: true,
          });
        const variable = doc.variables.find((v) => v.id === value);
        if (variable) onChange(defaultRow(variable));
      }}
    >
      {!doc.variables.some((v) => v.id === subjectOf(row)) && !isStorySubject(row) && (
        <option value={subjectOf(row)}>{t('pick.variable')}</option>
      )}
      <optgroup label={t('condition.variables')}>
        {doc.variables.map((v) => (
          <option key={v.id} value={v.id}>
            {labelText(v.name, locale, v.id)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('condition.story')}>
        <option value={SUBJECT_VISITED}>{t('condition.visitedSubject')}</option>
        <option value={SUBJECT_CHOSEN}>{t('condition.chosenSubject')}</option>
        <option value={SUBJECT_OWNED}>{t('condition.ownedSubject')}</option>
        <option value={SUBJECT_QUEST}>{t('condition.questSubject')}</option>
      </optgroup>
    </select>
  );

  const yesNo = (is: boolean, yes: MessageKey, no: MessageKey, change: (is: boolean) => void) => (
    <select
      className="picker"
      aria-label={t('condition.comparison')}
      value={is ? 'yes' : 'no'}
      onChange={(e) => change(e.target.value === 'yes')}
    >
      <option value="yes">{t(yes)}</option>
      <option value="no">{t(no)}</option>
    </select>
  );

  switch (row.kind) {
    case 'flag':
      return (
        <span className="condition__parts">
          {subject}
          {yesNo(row.is, 'op.isYes', 'op.isNo', (is) => onChange({ ...row, is }))}
        </span>
      );
    case 'contains':
      return (
        <span className="condition__parts">
          {subject}
          {yesNo(row.is, 'op.has', 'op.hasNot', (is) => onChange({ ...row, is }))}
          <input
            className="field"
            aria-label={t('condition.value')}
            value={row.value}
            onChange={(e) => onChange({ ...row, value: e.target.value })}
          />
        </span>
      );
    case 'visited':
      return (
        <span className="condition__parts">
          {subject}
          {yesNo(row.is, 'op.visited', 'op.notVisited', (is) => onChange({ ...row, is }))}
          <PassagePicker
            doc={doc}
            value={row.passage}
            onChange={(passage) => onChange({ ...row, passage })}
            label={t('condition.passage')}
          />
        </span>
      );
    case 'chosen': {
      const options: { id: string; label: string }[] = [];
      walkBlocks(doc, ({ block }) => {
        if (block.type === 'choice')
          for (const o of block.options)
            options.push({
              id: o.id,
              label: o.text[writeLocale] || o.text.en || o.text.tr || o.id,
            });
      });
      return (
        <span className="condition__parts">
          {subject}
          {yesNo(row.is, 'op.chosen', 'op.notChosen', (is) => onChange({ ...row, is }))}
          <select
            className="picker"
            aria-label={t('condition.option')}
            value={row.option}
            onChange={(e) => onChange({ ...row, option: e.target.value })}
          >
            {!row.option && <option value="">{t('pick.option')}</option>}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </span>
      );
    }
    case 'owned':
      return (
        <span className="condition__parts">
          {subject}
          {yesNo(row.is, 'op.owns', 'op.ownsNot', (is) => onChange({ ...row, is }))}
          <ItemPicker
            doc={doc}
            value={row.item}
            onChange={(item) => onChange({ ...row, item })}
            label={t('condition.value')}
          />
        </span>
      );
    case 'quest':
      return (
        <span className="condition__parts">
          {subject}
          <QuestPicker
            doc={doc}
            value={row.quest}
            onChange={(quest) => onChange({ ...row, quest })}
            label={t('condition.value')}
          />
          {yesNo(row.is, 'op.questIs', 'op.questIsNot', (is) => onChange({ ...row, is }))}
          <select
            className="picker"
            aria-label={t('condition.value')}
            value={row.status}
            onChange={(e) => onChange({ ...row, status: e.target.value as QuestCheck })}
          >
            {QUEST_CHECKS.map((status) => (
              <option key={status} value={status}>
                {t(`questStatus.${status}` as MessageKey)}
              </option>
            ))}
          </select>
        </span>
      );
    case 'compare': {
      const variable = doc.variables.find((v) => v.id === row.var);
      const type = variable?.type ?? 'number';
      return (
        <span className="condition__parts">
          {subject}
          <select
            className="picker"
            aria-label={t('condition.comparison')}
            value={row.op}
            onChange={(e) => onChange({ ...row, op: e.target.value as CompareOp })}
          >
            {opsFor(type).map((op) => (
              <option key={op} value={op}>
                {t(OP_LABEL[op])}
              </option>
            ))}
          </select>
          {row.value.k === 'var' ? (
            <VariablePicker
              doc={doc}
              value={row.value.id}
              onChange={(id) => onChange({ ...row, value: { k: 'var', id } })}
              label={t('condition.value')}
            />
          ) : (
            <PlainValue
              type={type === 'list' ? 'text' : type}
              values={variable?.values}
              value={row.value.v}
              onChange={(v) => onChange({ ...row, value: { k: 'lit', v } })}
              label={t('condition.value')}
            />
          )}
        </span>
      );
    }
  }
}
