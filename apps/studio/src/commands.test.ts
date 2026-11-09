import { createTranslator } from '@ie/i18n';
import { describe, expect, it } from 'vitest';
import { buildCommands, filterCommands } from './commands.ts';
import { messages } from './messages.ts';

describe('studio commands', () => {
  const en = createTranslator(messages, 'en');
  const tr = createTranslator(messages, 'tr');

  it('offers every view, theme, language and the overlay', () => {
    const commands = buildCommands(en, { hud: false });
    const ids = commands.map((c) => c.id);
    expect(ids).toContain('goto.write');
    expect(ids).toContain('goto.diagnostics');
    expect(ids).toContain('theme.night');
    expect(ids).toContain('language.tr');
    expect(new Set(ids).size).toBe(ids.length);
    expect(commands.find((c) => c.id === 'hud.toggle')?.params).toEqual({ visible: true });
  });

  it('filters with Turkish folding and ignores accents', () => {
    const commands = buildCommands(tr, { hud: true });
    expect(filterCommands(commands, 'akis').map((c) => c.id)).toEqual(['goto.flow']);
    expect(filterCommands(commands, 'KAGIT').map((c) => c.id)).toEqual(['theme.paper']);
    expect(filterCommands(commands, 'tanilama git').map((c) => c.id)).toEqual(['goto.diagnostics']);
  });

  it('returns everything for an empty query and nothing for a miss', () => {
    const commands = buildCommands(en, { hud: false });
    expect(filterCommands(commands, '  ')).toHaveLength(commands.length);
    expect(filterCommands(commands, 'zzz')).toEqual([]);
  });
});
