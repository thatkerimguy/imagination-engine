import type { Value } from '@ie/core';
import { BINDING, type Expr } from './formula.ts';

const UNARY = 7;
const ATOM = 8;

function binding(expr: Expr): number {
  if (expr.k === 'bin') return BINDING[expr.op] ?? 0;
  if (expr.k === 'not' || expr.k === 'neg') return UNARY;
  return ATOM;
}

function literal(value: Value): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value.includes('"') ? `'${value}'` : `"${value}"`;
  // Lists, records and null have no formula syntax; an empty text is the closest literal.
  return '""';
}

function wrap(expr: Expr, parens: boolean): string {
  const text = printFormula(expr);
  return parens ? `(${text})` : text;
}

/**
 * Prints a formula tree back to text with as few parentheses as the parser needs, so the Studio's
 * condition builder and the stored formula stay two views of one thing (ADR 0007).
 */
export function printFormula(expr: Expr): string {
  switch (expr.k) {
    case 'lit':
      return literal(expr.v);
    case 'var':
      return expr.id;
    case 'not':
      return `not ${wrap(expr.a, binding(expr.a) < UNARY)}`;
    case 'neg':
      return `-${wrap(expr.a, binding(expr.a) < UNARY)}`;
    case 'bin': {
      const own = binding(expr);
      // Operators are left-associative: a right operand of equal strength needs parentheses.
      return `${wrap(expr.a, binding(expr.a) < own)} ${expr.op} ${wrap(expr.b, binding(expr.b) <= own)}`;
    }
    case 'call':
      return `${expr.fn}(${expr.args.map(printFormula).join(', ')})`;
  }
}
