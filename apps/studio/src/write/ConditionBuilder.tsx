import type { Formula, StoryProject } from '@ie/story';
import { FunctionSquare, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import {
  defaultRow,
  parseCondition,
  printCondition,
  type Condition,
  type ConditionRow,
} from '../project/condition.ts';
import { allPassages } from '../project/tree.ts';
import { useT } from '../store.ts';
import { RowEditor } from './ConditionRow.tsx';
import { FormulaInput } from './ValueField.tsx';

interface ConditionBuilderProps {
  readonly doc: StoryProject;
  readonly value: Formula | undefined;
  /** `undefined` clears an optional condition; a required one gets `true`. */
  readonly onChange: (formula: Formula | undefined) => void;
  readonly required?: boolean;
  readonly label: string;
  readonly testId?: string;
}

/**
 * "If Charisma is at least 6 and Warned is no": rows of dropdowns over the stored formula. Anything
 * the rows can't show (mixed and/or, arithmetic) opens in formula mode instead.
 */
export function ConditionBuilder(props: ConditionBuilderProps) {
  const { doc, value, onChange, required, label, testId } = props;
  const t = useT();
  const condition = parseCondition(value);
  const [formulaMode, setFormulaMode] = useState(condition === null);
  const formula = typeof value === 'string' ? value : value === undefined ? '' : String(value);

  const save = (next: Condition) => {
    const printed = printCondition(next);
    onChange(printed === true && !required ? undefined : printed);
  };

  const firstRow = (): ConditionRow => {
    const variable = doc.variables[0];
    if (variable) return defaultRow(variable);
    return { kind: 'visited', passage: allPassages(doc)[0]?.id ?? '', is: true };
  };

  if (formulaMode || condition === null) {
    return (
      <div className="condition" data-testid={testId}>
        <div className="condition__formula">
          <FormulaInput
            value={formula}
            onChange={(f) => onChange(f.trim() ? f : undefined)}
            label={label}
          />
          <button
            type="button"
            className="ie-button ie-button--quiet"
            disabled={condition === null}
            title={condition === null ? t('condition.tooComplex') : undefined}
            onClick={() => setFormulaMode(false)}
          >
            {t('condition.rows')}
          </button>
        </div>
      </div>
    );
  }

  const { rows, join } = condition;
  return (
    <div className="condition" data-testid={testId} role="group" aria-label={label}>
      {rows.length > 1 && (
        <Segmented
          className="condition__join"
          label={t('condition.join')}
          value={join}
          options={[
            { value: 'and', label: t('condition.all') },
            { value: 'or', label: t('condition.any') },
          ]}
          onChange={(j) => save({ join: j, rows })}
        />
      )}
      {rows.length === 0 && <p className="condition__always">{t('condition.always')}</p>}
      {rows.map((row, index) => (
        <div className="condition__row" key={index}>
          <RowEditor
            doc={doc}
            row={row}
            onChange={(next) => save({ join, rows: rows.with(index, next) })}
          />
          <button
            type="button"
            className="ie-button ie-button--quiet icon-button"
            aria-label={t('condition.remove')}
            title={t('condition.remove')}
            onClick={() => save({ join, rows: rows.toSpliced(index, 1) })}
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      ))}
      <div className="condition__actions">
        <button
          type="button"
          className="ie-button ie-button--quiet"
          data-testid={testId ? `${testId}-add` : undefined}
          onClick={() => save({ join, rows: [...rows, firstRow()] })}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('condition.add')}
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          onClick={() => setFormulaMode(true)}
        >
          <FunctionSquare size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('condition.formula')}
        </button>
      </div>
    </div>
  );
}
