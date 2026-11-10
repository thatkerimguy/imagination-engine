import type { Value } from '@ie/core';
import { compileFormula, FormulaError, type Formula, type VariableType } from '@ie/story';
import { FunctionSquare } from 'lucide-react';
import { useState } from 'react';
import { formulaLiteral, literalFormula } from '../project/condition.ts';
import { useT } from '../store.ts';

interface PlainValueProps {
  readonly type: VariableType;
  readonly values?: readonly string[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  readonly label: string;
  readonly testId?: string;
}

/** An input that fits a variable type: a number box, a text box, Yes/No, or a list of values. */
export function PlainValue({ type, values, value, onChange, label, testId }: PlainValueProps) {
  const t = useT();
  if (type === 'bool')
    return (
      <select
        className="picker"
        aria-label={label}
        value={value === true ? 'yes' : 'no'}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value === 'yes')}
      >
        <option value="yes">{t('value.yes')}</option>
        <option value="no">{t('value.no')}</option>
      </select>
    );
  if (type === 'enum')
    return (
      <select
        className="picker"
        aria-label={label}
        value={typeof value === 'string' ? value : ''}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
      >
        {(values ?? []).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  if (type === 'number')
    return (
      <input
        className="field field--number"
        type="number"
        inputMode="decimal"
        aria-label={label}
        data-testid={testId}
        value={typeof value === 'number' ? value : 0}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    );
  return (
    <input
      className="field"
      aria-label={label}
      data-testid={testId}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Formula mode: the power-user view of the same value, checked as it is typed. */
export function FormulaInput({
  value,
  onChange,
  label,
}: {
  readonly value: string;
  readonly onChange: (formula: string) => void;
  readonly label: string;
}) {
  const t = useT();
  let error = '';
  try {
    if (value.trim()) compileFormula(value);
  } catch (e) {
    error = e instanceof FormulaError ? e.message : String(e);
  }
  return (
    <span className="formula">
      <input
        className="field field--mono"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        spellCheck={false}
        autoCapitalize="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <span className="formula__error" role="status">
          {t('formula.error')}
        </span>
      )}
    </span>
  );
}

interface ValueFieldProps {
  readonly type: VariableType;
  readonly values?: readonly string[];
  readonly value: Formula | undefined;
  readonly onChange: (formula: Formula) => void;
  readonly label: string;
  readonly testId?: string;
}

/** A value that is usually plain (10, "Ayşe", Yes) and can switch to a formula (gold * 2). */
export function ValueField({ type, values, value, onChange, label, testId }: ValueFieldProps) {
  const t = useT();
  const literal = formulaLiteral(value);
  const [formulaMode, setFormulaMode] = useState(literal === undefined && value !== undefined);
  const asText = value === undefined ? '' : String(value);

  return (
    <span className="value-field">
      {formulaMode ? (
        <FormulaInput value={asText} onChange={(f) => onChange(f)} label={label} />
      ) : (
        <PlainValue
          type={type}
          values={values}
          value={literal ?? null}
          onChange={(v) => onChange(literalFormula(v))}
          label={label}
          testId={testId}
        />
      )}
      <button
        type="button"
        className="ie-button ie-button--quiet value-field__mode"
        aria-pressed={formulaMode}
        aria-label={t('formula.toggle')}
        title={t('formula.toggle')}
        onClick={() => {
          if (formulaMode && formulaLiteral(value) === undefined) {
            // Leaving formula mode loses an expression; start the plain field from scratch.
            onChange(literalFormula(type === 'number' ? 0 : type === 'bool' ? false : ''));
          }
          setFormulaMode(!formulaMode);
        }}
      >
        <FunctionSquare size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </span>
  );
}
