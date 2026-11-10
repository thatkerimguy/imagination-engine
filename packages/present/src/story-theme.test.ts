import { THEME_PRESETS } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { PRESETS, contrastRatio, resolveStoryTheme, themeWarnings } from './story-theme.ts';

describe('story themes', () => {
  it('leave the reader’s own look alone on Auto', () => {
    expect(resolveStoryTheme(undefined).vars).toEqual({});
    expect(resolveStoryTheme({ preset: 'auto' })).toEqual({
      vars: {},
      choices: 'outline',
      transition: 'none',
    });
  });

  it('resolve a preset into every colour token, with derived ones', () => {
    const { vars, choices } = resolveStoryTheme({ preset: 'terminal' });
    expect(vars['--color-bg']).toBe('#0b0f0b');
    expect(vars['color-scheme']).toBe('dark');
    expect(vars['--color-line']).toMatch(/^rgb\(155 232 154 \/ 0\.\d+\)$/);
    expect(vars['--font-prose']).toContain('JetBrains Mono');
    expect(choices).toBe('underline');
  });

  it('let overrides win over the preset', () => {
    const { vars, choices, transition } = resolveStoryTheme({
      preset: 'paper',
      colors: { accent: '#225588' },
      prose: 'sans',
      size: 1.1,
      choices: 'filled',
      transition: 'rise',
    });
    expect(vars['--color-accent']).toBe('#225588');
    expect(vars['--color-bg']).toBe('#f4f1ea');
    expect(vars['--font-prose']).toContain('Inter');
    expect(vars['--theme-scale']).toBe('1.1');
    expect([choices, transition]).toEqual(['filled', 'rise']);
  });

  it('pick a readable accent ink', () => {
    const { vars } = resolveStoryTheme({ preset: 'neon' });
    const accent = vars['--color-accent'] ?? '';
    const ink = vars['--color-accent-ink'] ?? '';
    expect(contrastRatio(accent, ink)).toBeGreaterThan(3);
  });

  it('measure contrast like WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('ship presets that pass their own contrast check', () => {
    for (const preset of THEME_PRESETS) {
      expect(PRESETS[preset]).toBeDefined();
      expect(themeWarnings({ preset }), preset).toEqual([]);
    }
  });

  it('warn about unreadable overrides', () => {
    const warnings = themeWarnings({ preset: 'paper', colors: { ink: '#d8d2c4' } });
    expect(warnings).toEqual([expect.objectContaining({ color: 'ink', needs: 4.5 })]);
  });
});
