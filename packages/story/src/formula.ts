import type { Value } from '@ie/core';

/**
 * The formula language (ADR 0007): `charisma >= 6 and not warned`, `gold - 10`,
 * `visited("alley") > 1`, `clamp(hp + 5, 0, max_hp)`. Formulas are the stored form of story
 * logic; the Studio's sentence blocks parse and print them.
 */
export type Expr =
  | { readonly k: 'lit'; readonly v: Value }
  | { readonly k: 'var'; readonly id: string }
  | { readonly k: 'not' | 'neg'; readonly a: Expr }
  | { readonly k: 'bin'; readonly op: BinaryOp; readonly a: Expr; readonly b: Expr }
  | { readonly k: 'call'; readonly fn: FunctionName; readonly args: readonly Expr[] };

export type BinaryOp =
  '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=' | 'and' | 'or';

/** Function name → [min args, max args]. */
export const FUNCTIONS = {
  min: [2, 8],
  max: [2, 8],
  clamp: [3, 3],
  abs: [1, 1],
  round: [1, 1],
  floor: [1, 1],
  ceil: [1, 1],
  random: [2, 2],
  visited: [1, 1],
  chosen: [1, 1],
  has: [2, 2],
  len: [1, 1],
} as const satisfies Record<string, readonly [number, number]>;
export type FunctionName = keyof typeof FUNCTIONS;

export class FormulaError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
    this.name = 'FormulaError';
  }
}

type Token =
  | { t: 'num'; v: number; p: number }
  | { t: 'str'; v: string; p: number }
  | { t: 'id'; v: string; p: number }
  | { t: 'op'; v: string; p: number }
  | { t: 'end'; p: number };

const WORD_OPS: Readonly<Record<string, string>> = { and: 'and', or: 'or', not: 'not' };
const SYMBOL_OPS = [
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '!',
  '(',
  ')',
  ',',
];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source.charAt(i);
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/\d/.test(c) || (c === '.' && /\d/.test(source.charAt(i + 1)))) {
      const match = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(source.slice(i));
      const text = match?.[0] ?? c;
      tokens.push({ t: 'num', v: Number(text), p: i });
      i += text.length;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = source.indexOf(c, i + 1);
      if (end < 0) throw new FormulaError('This text is missing its closing quote.', i);
      tokens.push({ t: 'str', v: source.slice(i + 1, end), p: i });
      i = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i))?.[0] ?? c;
      const op = WORD_OPS[word];
      tokens.push(op ? { t: 'op', v: op, p: i } : { t: 'id', v: word, p: i });
      i += word.length;
      continue;
    }
    const symbol = SYMBOL_OPS.find((s) => source.startsWith(s, i));
    if (!symbol) throw new FormulaError(`"${c}" can't be used in a formula.`, i);
    const normalized =
      symbol === '&&' ? 'and' : symbol === '||' ? 'or' : symbol === '!' ? 'not' : symbol;
    tokens.push({ t: 'op', v: normalized, p: i });
    i += symbol.length;
  }
  tokens.push({ t: 'end', p: source.length });
  return tokens;
}

/** How tightly each binary operator binds (higher binds tighter). */
export const BINDING: Readonly<Record<string, number>> = {
  or: 1,
  and: 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

/** Parses a formula. Throws {@link FormulaError} with a plain-language message and position. */
export function parseFormula(source: string): Expr {
  const tokens = tokenize(source);
  let pos = 0;
  const peek = (): Token => tokens[pos] ?? { t: 'end', p: source.length };
  const next = (): Token => tokens[pos++] ?? { t: 'end', p: source.length };
  const isOp = (token: Token, v: string) => token.t === 'op' && token.v === v;

  function primary(): Expr {
    const token = next();
    switch (token.t) {
      case 'num':
        return { k: 'lit', v: token.v };
      case 'str':
        return { k: 'lit', v: token.v };
      case 'id': {
        if (token.v === 'true' || token.v === 'false') return { k: 'lit', v: token.v === 'true' };
        if (!isOp(peek(), '(')) return { k: 'var', id: token.v };
        next();
        if (!(token.v in FUNCTIONS))
          throw new FormulaError(`There is no function called "${token.v}".`, token.p);
        const fn = token.v as FunctionName;
        const args: Expr[] = [];
        if (!isOp(peek(), ')')) {
          do args.push(expression(0));
          while (isOp(peek(), ',') && next());
        }
        if (!isOp(next(), ')'))
          throw new FormulaError(`"${fn}(" is missing its closing ")".`, token.p);
        const [min, max] = FUNCTIONS[fn];
        if (args.length < min || args.length > max) {
          const want = min === max ? `${min}` : `${min} to ${max}`;
          throw new FormulaError(`"${fn}" takes ${want} values, not ${args.length}.`, token.p);
        }
        return { k: 'call', fn, args };
      }
      case 'op':
        if (token.v === '(') {
          const inner = expression(0);
          if (!isOp(next(), ')'))
            throw new FormulaError('A "(" is missing its closing ")".', token.p);
          return inner;
        }
        if (token.v === 'not') return { k: 'not', a: expression(7) };
        if (token.v === '-') return { k: 'neg', a: expression(7) };
        throw new FormulaError(`Something is missing before "${token.v}".`, token.p);
      case 'end':
        throw new FormulaError('The formula ends too early.', token.p);
    }
  }

  function expression(minBinding: number): Expr {
    let left = primary();
    for (;;) {
      const token = peek();
      if (token.t !== 'op') break;
      const binding = BINDING[token.v];
      if (binding === undefined || binding <= minBinding) break;
      next();
      left = { k: 'bin', op: token.v as BinaryOp, a: left, b: expression(binding) };
    }
    return left;
  }

  const result = expression(0);
  const rest = peek();
  if (rest.t !== 'end')
    throw new FormulaError('There is something extra at the end of the formula.', rest.p);
  return result;
}

/** Parses a stored formula field: JSON numbers and booleans are literals. */
export function compileFormula(formula: string | number | boolean): Expr {
  return typeof formula === 'string' ? parseFormula(formula) : { k: 'lit', v: formula };
}

export interface EvalContext {
  value(id: string): Value;
  visits(passageId: string): number;
  chosen(optionId: string): number;
  /** Integer in [min, max], from the story's seeded generator. */
  random(min: number, max: number): number;
}

/** A value as plain text: lists and records as JSON, null as nothing. */
export function valueText(value: Value): string {
  if (value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function truthy(value: Value): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

const num = (value: Value): number => (typeof value === 'number' ? value : Number(value) || 0);
const finite = (value: number): number => (Number.isFinite(value) ? value : 0);

function equals(a: Value, b: Value): boolean {
  if (Array.isArray(a) || Array.isArray(b) || typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

function compare(a: Value, b: Value): number {
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return num(a) - num(b);
}

export function evaluate(expr: Expr, ctx: EvalContext): Value {
  switch (expr.k) {
    case 'lit':
      return expr.v;
    case 'var':
      return ctx.value(expr.id);
    case 'not':
      return !truthy(evaluate(expr.a, ctx));
    case 'neg':
      return -num(evaluate(expr.a, ctx));
    case 'bin': {
      if (expr.op === 'and') return truthy(evaluate(expr.a, ctx)) && truthy(evaluate(expr.b, ctx));
      if (expr.op === 'or') return truthy(evaluate(expr.a, ctx)) || truthy(evaluate(expr.b, ctx));
      const a = evaluate(expr.a, ctx);
      const b = evaluate(expr.b, ctx);
      switch (expr.op) {
        case '+':
          return typeof a === 'string' || typeof b === 'string'
            ? valueText(a) + valueText(b)
            : num(a) + num(b);
        case '-':
          return num(a) - num(b);
        case '*':
          return num(a) * num(b);
        case '/':
          return finite(num(a) / num(b));
        case '%':
          return finite(num(a) % num(b));
        case '==':
          return equals(a, b);
        case '!=':
          return !equals(a, b);
        case '<':
          return compare(a, b) < 0;
        case '<=':
          return compare(a, b) <= 0;
        case '>':
          return compare(a, b) > 0;
        case '>=':
          return compare(a, b) >= 0;
      }
      return null;
    }
    case 'call':
      return callFunction(expr.fn, expr.args, ctx);
  }
}

function callFunction(fn: FunctionName, args: readonly Expr[], ctx: EvalContext): Value {
  const values = args.map((arg) => evaluate(arg, ctx));
  const n = values.map(num);
  const [first = null, second = null] = values;
  switch (fn) {
    case 'min':
      return Math.min(...n);
    case 'max':
      return Math.max(...n);
    case 'clamp':
      return Math.min(Math.max(n[0] ?? 0, n[1] ?? 0), n[2] ?? 0);
    case 'abs':
      return Math.abs(n[0] ?? 0);
    case 'round':
      return Math.round(n[0] ?? 0);
    case 'floor':
      return Math.floor(n[0] ?? 0);
    case 'ceil':
      return Math.ceil(n[0] ?? 0);
    case 'random':
      return ctx.random(Math.ceil(n[0] ?? 0), Math.floor(n[1] ?? 0));
    case 'visited':
      return ctx.visits(valueText(first));
    case 'chosen':
      return ctx.chosen(valueText(first));
    case 'has':
      return Array.isArray(first)
        ? first.some((item) => equals(item, second))
        : valueText(first).includes(valueText(second));
    case 'len':
      return Array.isArray(first) ? first.length : valueText(first).length;
  }
}

/** Every variable a formula reads, and the passage/option IDs it names in visited()/chosen(). */
export function references(expr: Expr): {
  vars: Set<string>;
  passages: Set<string>;
  options: Set<string>;
} {
  const found = {
    vars: new Set<string>(),
    passages: new Set<string>(),
    options: new Set<string>(),
  };
  const walk = (e: Expr): void => {
    if (e.k === 'var') found.vars.add(e.id);
    else if (e.k === 'not' || e.k === 'neg') walk(e.a);
    else if (e.k === 'bin') {
      walk(e.a);
      walk(e.b);
    } else if (e.k === 'call') {
      const [target] = e.args;
      if (target?.k === 'lit' && typeof target.v === 'string') {
        if (e.fn === 'visited') found.passages.add(target.v);
        if (e.fn === 'chosen') found.options.add(target.v);
      }
      e.args.forEach(walk);
    }
  };
  walk(expr);
  return found;
}

/** A simple requirement (`charisma >= 6`) that the reader can explain as "Requires Charisma 6". */
export interface Requirement {
  readonly var: string;
  readonly op: '==' | '!=' | '<' | '<=' | '>' | '>=';
  readonly value: Value;
}

export function simpleRequirement(expr: Expr): Requirement | null {
  if (expr.k === 'var') return { var: expr.id, op: '==', value: true };
  if (expr.k !== 'bin' || expr.a.k !== 'var' || expr.b.k !== 'lit') return null;
  if (expr.op === 'and' || expr.op === 'or' || ['+', '-', '*', '/', '%'].includes(expr.op))
    return null;
  return { var: expr.a.id, op: expr.op as Requirement['op'], value: expr.b.v };
}
