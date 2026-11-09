import type { Value } from '@ie/core';
import { harmonizeSuffix, localeTag, upper, type Locale } from '@ie/i18n';
import { valueText } from './formula.ts';
import type { EffectName, MarkupNode } from './markup.ts';

export interface Effect {
  readonly name: EffectName;
  readonly arg?: string;
}

/** Rendered text, ready for any presenter: runs of text with their effect stack, and pauses. */
export type Piece =
  | { readonly kind: 'text'; readonly text: string; readonly fx: readonly Effect[] }
  | { readonly kind: 'pause'; readonly ms: number };

export interface TextContext {
  readonly locale: Locale;
  value(id: string): Value;
  character(id: string): { readonly name: string; readonly suffixAs?: string } | undefined;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const listFormats = new Map<string, Intl.ListFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

function cached<T>(map: Map<string, T>, locale: Locale, make: (tag: string) => T): T {
  let found = map.get(locale);
  if (!found) {
    found = make(localeTag(locale));
    map.set(locale, found);
  }
  return found;
}

const YES_NO: Readonly<Record<Locale, readonly [string, string]>> = {
  en: ['yes', 'no'],
  tr: ['evet', 'hayır'],
};

/** How a variable's value reads inside a sentence, in the reader's language. */
export function formatValue(value: Value, locale: Locale): string {
  if (value === null) return '';
  if (typeof value === 'number') {
    return cached(
      numberFormats,
      locale,
      (tag) => new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }),
    ).format(value);
  }
  if (typeof value === 'boolean') return YES_NO[locale][value ? 0 : 1];
  if (Array.isArray(value)) {
    return cached(
      listFormats,
      locale,
      (tag) => new Intl.ListFormat(tag, { type: 'conjunction' }),
    ).format(value.map((item) => formatValue(item, locale)));
  }
  if (typeof value === 'object') return '';
  return value;
}

function withSuffix(
  shown: string,
  heard: string | number,
  suffix: string | undefined,
  ctx: TextContext,
  suffixAs?: string,
): string {
  if (!suffix) return shown;
  // English keeps what was written ({name}'s); Turkish re-harmonizes it for the actual word.
  if (ctx.locale !== 'tr') return `${shown}'${suffix}`;
  return `${shown}'${harmonizeSuffix(heard, suffix, suffixAs ? { suffixAs } : {})}`;
}

export function renderMarkup(nodes: readonly MarkupNode[], ctx: TextContext): Piece[] {
  const pieces: Piece[] = [];

  const push = (text: string, fx: readonly Effect[]) => {
    if (!text) return;
    const shouted = fx.some((e) => e.name === 'shout') ? upper(text, ctx.locale) : text;
    const last = pieces.at(-1);
    if (last?.kind === 'text' && last.fx === fx) {
      pieces[pieces.length - 1] = { kind: 'text', text: last.text + shouted, fx };
    } else {
      pieces.push({ kind: 'text', text: shouted, fx });
    }
  };

  const walk = (list: readonly MarkupNode[], fx: readonly Effect[], count: number | null) => {
    for (const node of list) {
      switch (node.t) {
        case 'text':
          push(node.v, fx);
          break;
        case 'var': {
          const value = ctx.value(node.id);
          const shown = formatValue(value, ctx.locale);
          push(withSuffix(shown, typeof value === 'number' ? value : shown, node.suffix, ctx), fx);
          break;
        }
        case 'char': {
          const character = ctx.character(node.id);
          const name = character?.name ?? node.id;
          push(withSuffix(name, name, node.suffix, ctx, character?.suffixAs), fx);
          break;
        }
        case 'hash':
          if (count !== null) push(formatValue(count, ctx.locale), fx);
          break;
        case 'plural': {
          const n = Number(ctx.value(node.id)) || 0;
          const category = cached(
            pluralRules,
            ctx.locale,
            (tag) => new Intl.PluralRules(tag),
          ).select(n);
          walk(node.cases[`=${n}`] ?? node.cases[category] ?? node.cases.other ?? [], fx, n);
          break;
        }
        case 'select': {
          const key = valueText(ctx.value(node.id));
          walk(node.cases[key] ?? node.cases.other ?? [], fx, count);
          break;
        }
        case 'fx':
          walk(
            node.children,
            [
              ...fx,
              node.arg === undefined ? { name: node.name } : { name: node.name, arg: node.arg },
            ],
            count,
          );
          break;
        case 'pause':
          pieces.push({ kind: 'pause', ms: node.ms });
          break;
      }
    }
  };

  walk(nodes, [], null);
  return pieces;
}

/** The words alone, for screen readers, the backlog search and save-slot labels. */
export function plainText(pieces: readonly Piece[]): string {
  return pieces.map((piece) => (piece.kind === 'text' ? piece.text : '')).join('');
}
