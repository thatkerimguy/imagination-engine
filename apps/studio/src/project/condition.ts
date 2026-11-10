import type { Value } from '@ie/core';
import { compileFormula, printFormula, type Expr, type Formula, type VariableDef } from '@ie/story';

/**
 * The condition builder's model: rows like "Charisma is at least 6", joined by all/any. It is a view
 * of a formula (ADR 0007): parse a formula into rows when it fits this shape, print rows back.
 */

export const COMPARE_OPS = ['==', '!=', '<', '<=', '>', '>='] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export type Operand =
  { readonly k: 'lit'; readonly v: Value } | { readonly k: 'var'; readonly id: string };

export type ConditionRow =
  | {
      readonly kind: 'compare';
      readonly var: string;
      readonly op: CompareOp;
      readonly value: Operand;
    }
  /** A Yes/No variable is (or isn't) yes. */
  | { readonly kind: 'flag'; readonly var: string; readonly is: boolean }
  /** A list variable contains (or doesn't contain) a value. */
  | {
      readonly kind: 'contains';
      readonly var: string;
      readonly value: string;
      readonly is: boolean;
    }
  /** The reader has (or hasn't) been to a passage. */
  | { readonly kind: 'visited'; readonly passage: string; readonly is: boolean }
  /** The reader has (or hasn't) picked an option before. */
  | { readonly kind: 'chosen'; readonly option: string; readonly is: boolean };

export interface Condition {
  readonly join: 'and' | 'or';
  readonly rows: readonly ConditionRow[];
}

/** Always true: an empty condition. */
export const ALWAYS: Condition = { join: 'and', rows: [] };

const isCompare = (op: string): op is CompareOp => (COMPARE_OPS as readonly string[]).includes(op);

function flatten(expr: Expr, join: 'and' | 'or'): Expr[] {
  return expr.k === 'bin' && expr.op === join
    ? [...flatten(expr.a, join), ...flatten(expr.b, join)]
    : [expr];
}

function stringArg(expr: Expr | undefined): string | null {
  return expr?.k === 'lit' && typeof expr.v === 'string' ? expr.v : null;
}

/** `visited("p") > 0` / `== 0` (and the same for chosen). */
function countRow(expr: Expr, is: boolean): ConditionRow | null {
  if (expr.k !== 'bin' || expr.a.k !== 'call' || expr.b.k !== 'lit' || expr.b.v !== 0) return null;
  const target = stringArg(expr.a.args[0]);
  if (target === null) return null;
  const positive = expr.op === '>' || expr.op === '!=';
  const negative = expr.op === '==' || expr.op === '<=';
  if (!positive && !negative) return null;
  const yes = positive === is;
  if (expr.a.fn === 'visited') return { kind: 'visited', passage: target, is: yes };
  if (expr.a.fn === 'chosen') return { kind: 'chosen', option: target, is: yes };
  return null;
}

function row(expr: Expr): ConditionRow | null {
  const negated = expr.k === 'not';
  const inner = expr.k === 'not' ? expr.a : expr;
  if (inner.k === 'var') return { kind: 'flag', var: inner.id, is: !negated };
  if (inner.k === 'call' && inner.fn === 'has' && inner.args[0]?.k === 'var') {
    const value = stringArg(inner.args[1]);
    if (value !== null) return { kind: 'contains', var: inner.args[0].id, value, is: !negated };
  }
  if (inner.k === 'call' && (inner.fn === 'visited' || inner.fn === 'chosen')) {
    return countRow({ k: 'bin', op: '>', a: inner, b: { k: 'lit', v: 0 } }, !negated);
  }
  if (inner.k !== 'bin') return null;
  const counted = countRow(inner, !negated);
  if (counted) return counted;
  if (negated || !isCompare(inner.op) || inner.a.k !== 'var') return null;
  if (inner.b.k === 'lit')
    return { kind: 'compare', var: inner.a.id, op: inner.op, value: inner.b };
  if (inner.b.k === 'var')
    return { kind: 'compare', var: inner.a.id, op: inner.op, value: inner.b };
  return null;
}

/** Rows for a formula, or null when it needs formula mode (mixed and/or, arithmetic, functions). */
export function parseCondition(formula: Formula | undefined): Condition | null {
  if (formula === undefined || formula === true || formula === '') return ALWAYS;
  let expr: Expr;
  try {
    expr = compileFormula(formula);
  } catch {
    return null;
  }
  if (expr.k === 'lit' && expr.v === true) return ALWAYS;
  const join = expr.k === 'bin' && expr.op === 'or' ? 'or' : 'and';
  const rows: ConditionRow[] = [];
  for (const part of flatten(expr, join)) {
    const parsed = row(part);
    if (!parsed) return null;
    rows.push(parsed);
  }
  return { join, rows };
}

const lit = (v: Value): Expr => ({ k: 'lit', v });
const counted = (fn: 'visited' | 'chosen', id: string, is: boolean): Expr => ({
  k: 'bin',
  op: is ? '>' : '==',
  a: { k: 'call', fn, args: [lit(id)] },
  b: lit(0),
});

function rowExpr(r: ConditionRow): Expr {
  switch (r.kind) {
    case 'compare':
      return {
        k: 'bin',
        op: r.op,
        a: { k: 'var', id: r.var },
        b: r.value.k === 'var' ? { k: 'var', id: r.value.id } : lit(r.value.v),
      };
    case 'flag':
      return r.is ? { k: 'var', id: r.var } : { k: 'not', a: { k: 'var', id: r.var } };
    case 'contains': {
      const has: Expr = { k: 'call', fn: 'has', args: [{ k: 'var', id: r.var }, lit(r.value)] };
      return r.is ? has : { k: 'not', a: has };
    }
    case 'visited':
      return counted('visited', r.passage, r.is);
    case 'chosen':
      return counted('chosen', r.option, r.is);
  }
}

/** The stored formula for a condition; `true` when it has no rows. */
export function printCondition(condition: Condition): Formula {
  const [first, ...rest] = condition.rows.map(rowExpr);
  if (!first) return true;
  const expr = rest.reduce<Expr>((a, b) => ({ k: 'bin', op: condition.join, a, b }), first);
  return printFormula(expr);
}

/** A row that fits a variable's type, for "add condition" and when the variable changes. */
export function defaultRow(variable: VariableDef): ConditionRow {
  switch (variable.type) {
    case 'bool':
      return { kind: 'flag', var: variable.id, is: true };
    case 'list':
      return { kind: 'contains', var: variable.id, value: '', is: true };
    case 'number':
      return { kind: 'compare', var: variable.id, op: '>=', value: { k: 'lit', v: 1 } };
    case 'enum':
      return {
        kind: 'compare',
        var: variable.id,
        op: '==',
        value: { k: 'lit', v: variable.values?.[0] ?? '' },
      };
    case 'text':
      return { kind: 'compare', var: variable.id, op: '==', value: { k: 'lit', v: '' } };
  }
}

/** Which comparisons make sense for a variable type. */
export function opsFor(type: VariableDef['type']): readonly CompareOp[] {
  return type === 'number' ? COMPARE_OPS : ['==', '!='];
}

/**
 * The stored form of a plain value typed into a field: numbers and Yes/No stay JSON literals, text
 * becomes a quoted formula string, so `Set Name to Ayşe` stores `"Ayşe"`.
 */
export function literalFormula(value: Value): Formula {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return printFormula(lit(value));
}

/** The plain value a formula holds, or undefined when it is a real expression. */
export function formulaLiteral(formula: Formula | undefined): Value | undefined {
  if (formula === undefined) return undefined;
  if (typeof formula !== 'string') return formula;
  try {
    const expr = compileFormula(formula);
    if (expr.k === 'lit') return expr.v;
    if (expr.k === 'neg' && expr.a.k === 'lit' && typeof expr.a.v === 'number') return -expr.a.v;
  } catch {
    return undefined;
  }
  return undefined;
}
