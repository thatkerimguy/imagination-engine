import * as dice from '@kn/module-bl-dice-3d';
import * as lighter from '@kn/module-bl-lighter-flick';
import * as ambient from '@kn/module-core-ambient-bed';
import * as chat from '@kn/module-gits-cyberbrain-chat';
import * as whisper from '@kn/module-gits-ghost-whisper';
import * as gaslight from '@kn/module-pt-gaslight-edit';
import { describe, expect, it } from 'vitest';
import { enabledWriterModules, getWriterModule, writerModules } from './registry.ts';

const formatters: Record<string, (p: never) => unknown> = {
  [ambient.meta.id]: ambient.formatCardSummary,
  [chat.meta.id]: chat.formatCardSummary,
  [dice.meta.id]: dice.formatCardSummary,
  [gaslight.meta.id]: gaslight.formatCardSummary,
  [whisper.meta.id]: whisper.formatCardSummary,
  [lighter.meta.id]: lighter.formatCardSummary,
};

describe('writer module registry', () => {
  it('contains exactly the six modules', () => {
    expect(writerModules.map((m) => m.meta.id).sort()).toEqual(
      [
        'bl-dice-3d',
        'bl-lighter-flick',
        'core-ambient-bed',
        'gits-cyberbrain-chat',
        'gits-ghost-whisper',
        'pt-gaslight-edit',
      ].sort(),
    );
    expect(getWriterModule('bl-dice-3d')?.meta.id).toBe('bl-dice-3d');
    expect(getWriterModule('nope')).toBeUndefined();
  });

  it('summarize() on defaults matches each module formatCardSummary', () => {
    for (const m of writerModules) {
      const expected = formatters[m.meta.id]!(m.schema.defaults as never);
      expect(m.summarize(m.schema.defaults)).toEqual(expected);
    }
  });

  it("returns a fallback card with badge 'FIX' for invalid props", () => {
    for (const m of writerModules) {
      const bad = Object.fromEntries(Object.keys(m.schema.defaults).map((k) => [k, {}]));
      const card = m.summarize(bad);
      expect(card.badge).toBe('FIX');
      expect(card.title).toContain(m.meta.name);
    }
  });

  it('enabledWriterModules filters, keeps registry order, ignores unknown ids', () => {
    const reversed = [...writerModules].reverse().map((m) => m.meta.id);
    expect(enabledWriterModules(reversed).map((m) => m.meta.id)).toEqual(
      writerModules.map((m) => m.meta.id),
    );
    const one = writerModules[1]!.meta.id;
    expect(enabledWriterModules(['ghost', one]).map((m) => m.meta.id)).toEqual([one]);
    expect(enabledWriterModules([])).toEqual([]);
  });
});
