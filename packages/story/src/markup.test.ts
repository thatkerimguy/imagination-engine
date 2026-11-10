import type { Value } from '@ie/core';
import type { Locale } from '@ie/i18n';
import { describe, expect, it } from 'vitest';
import { MarkupError, parseMarkup } from './markup.ts';
import { plainText, renderMarkup, type TextContext } from './text.ts';

const context = (locale: Locale, vars: Record<string, Value>): TextContext => ({
  locale,
  value: (id) => vars[id] ?? null,
  character: (id) =>
    id === 'kemal'
      ? { name: 'Kemal', suffixAs: 'Kemel' }
      : id === 'mira'
        ? { name: 'Mira' }
        : undefined,
});

const say = (source: string, locale: Locale, vars: Record<string, Value> = {}) =>
  plainText(renderMarkup(parseMarkup(source), context(locale, vars)));

describe('text markup', () => {
  it('inserts variables with locale formatting', () => {
    expect(say('You have {gold} gold.', 'en', { gold: 12500 })).toBe('You have 12,500 gold.');
    expect(say('{gold} altının var.', 'tr', { gold: 12500 })).toBe('12.500 altının var.');
    expect(say('{bag}', 'en', { bag: ['rope', 'key', 'lamp'] })).toBe('rope, key, and lamp');
    expect(say('{bag}', 'tr', { bag: ['ip', 'anahtar'] })).toBe('ip ve anahtar');
  });

  it('re-harmonizes Turkish suffixes and leaves English ones alone', () => {
    expect(say("Mektubu {name}'e verdim.", 'tr', { name: 'Ayşe' })).toBe("Mektubu Ayşe'ye verdim.");
    expect(say("Mektubu {name}'e verdim.", 'tr', { name: 'Can' })).toBe("Mektubu Can'a verdim.");
    expect(say("{@kemal}'e sor.", 'tr')).toBe("Kemal'e sor.");
    expect(say("{coins}'e çıktı.", 'tr', { coins: 6 })).toBe("6'ya çıktı.");
    expect(say("It's {name}'s turn.", 'en', { name: 'Can' })).toBe("It's Can's turn.");
  });

  it('handles plural and select', () => {
    const coins = '{n, plural, =0 {no coins} one {# coin} other {# coins}}';
    expect(say(coins, 'en', { n: 0 })).toBe('no coins');
    expect(say(coins, 'en', { n: 1 })).toBe('1 coin');
    expect(say(coins, 'en', { n: 1200 })).toBe('1,200 coins');
    const pronoun = 'Ask {p, select, she {her} he {him} other {them}}.';
    expect(say(pronoun, 'en', { p: 'she' })).toBe('Ask her.');
    expect(say(pronoun, 'en', { p: 'they' })).toBe('Ask them.');
    expect(say('{n, plural, other {[b]#[/b] gün}}', 'tr', { n: 3 })).toBe('3 gün');
  });

  it('keeps effects as a stack and shouts with Turkish casing', () => {
    const pieces = renderMarkup(
      parseMarkup('a [shake]b [wave]c[/wave][/shake][pause=300]d'),
      context('en', {}),
    );
    expect(pieces).toEqual([
      { kind: 'text', text: 'a ', fx: [] },
      { kind: 'text', text: 'b ', fx: [{ name: 'shake' }] },
      { kind: 'text', text: 'c', fx: [{ name: 'shake' }, { name: 'wave' }] },
      { kind: 'pause', ms: 300 },
      { kind: 'text', text: 'd', fx: [] },
    ]);
    expect(say('[shout]dikkat, {name}![/shout]', 'tr', { name: 'İnci' })).toBe('DİKKAT, İNCİ!');
    expect(say('[color=accent]x[/color]', 'en')).toBe('x');
  });

  it('writes literal brackets and braces', () => {
    expect(say('[[note]] and {{curly}', 'en')).toBe('[note] and {curly}');
  });

  it('explains mistakes', () => {
    const message = (source: string) => {
      try {
        parseMarkup(source);
        return '';
      } catch (error) {
        return error instanceof MarkupError ? error.message : String(error);
      }
    };
    expect(message('[shake]oops')).toBe('"[shake]" is never closed with [/shake].');
    expect(message('[glow]x[/glow]')).toBe('There is no "glow" effect.');
    expect(message('x[/b]')).toBe('"[/b]" closes a tag that isn\'t open.');
    expect(message('{gold')).toBe('"{gold" is missing its closing "}".');
    expect(message('{n, plural, one {x}}')).toBe('The plural for "n" needs an "other" case.');
    expect(message('[pause=soon]')).toBe('[pause] needs a time in milliseconds, like [pause=400].');
  });
});
