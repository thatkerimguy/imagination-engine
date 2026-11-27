// Cue text for every exporter comes from the blueprint's own export templates (no per-gimmick
// code): all 28 starters, inline-blueprint precedence, summary / omit, and the pre-v2 fallback.
import type { ModuleBlock } from '@kn/core';
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import { STARTER_BLUEPRINT_LIST, starterBlueprint } from '@kn/engines/blueprints';
import { describe, expect, it } from 'vitest';
import { getWriterModule } from '../modules/registry.ts';
import { cueBlueprint, gimmickLines, renderCue } from './gimmick-text.ts';

const ID = '01HZZZZZZZZZZZZZZZZZZZZZZZ';
const cue = (blueprintId: string, props: Record<string, unknown> = {}): ModuleBlock => {
  const bp = starterBlueprint(blueprintId);
  return {
    id: ID,
    kind: 'module',
    moduleId: bp?.engine ?? 'frame-hud',
    moduleVersion: 1,
    props: { blueprintId, ...(bp?.defaultProps ?? {}), ...props },
  };
};

describe('gimmickLines (template-driven)', () => {
  it('every starter blueprint prints transcript lines and a one-line bracketed summary', () => {
    expect(STARTER_BLUEPRINT_LIST).toHaveLength(28);
    for (const bp of STARTER_BLUEPRINT_LIST) {
      const lines = gimmickLines(cue(bp.id), 'transcript');
      expect(lines.length, bp.id).toBeGreaterThan(0);
      expect(
        lines.every((l) => l.text.trim() !== ''),
        bp.id,
      ).toBe(true);
      const [summary, ...rest] = gimmickLines(cue(bp.id), 'summary');
      expect(rest).toEqual([]);
      expect(summary?.text, bp.id).toMatch(
        new RegExp(`^\\[${bp.name.replace(/[()]/g, '.')}: .+\\]$`),
      );
      expect(gimmickLines(cue(bp.id), 'omit')).toEqual([]);
    }
  });

  it('renders the author props, not the defaults', () => {
    const lines = gimmickLines(
      cue('cyberbrain-link', { channel: 'ECHO', messages: [{ sender: 'ECHO', text: 'Run.' }] }),
      'transcript',
    );
    expect(lines.map((l) => l.text)).toEqual(['[ECHO]', 'ECHO: Run.']);
  });

  it('the chapter inline blueprint wins over the bundled starter copy', () => {
    const base = starterBlueprint('system-notification')!;
    const custom: GimmickBlueprint = {
      ...base,
      name: 'House System',
      exports: { ...base.exports, transcript: 'HOUSE: {{title}}', summary: '{{title}}' },
    };
    const block = cue('system-notification', { title: 'Door opens' });
    const inline = { 'system-notification': custom };
    expect(cueBlueprint(block, inline)?.name).toBe('House System');
    expect(gimmickLines(block, 'transcript', inline)).toEqual([{ text: 'HOUSE: Door opens' }]);
    expect(gimmickLines(block, 'summary', inline)).toEqual([
      { text: '[House System: Door opens]' },
    ]);
    // A tampered inline blueprint is rejected by the guard and the starter is used instead.
    const bad = { 'system-notification': { ...custom, engine: 'not-an-engine' } };
    expect(cueBlueprint(block, bad)?.name).toBe(base.name);
  });

  it('HTML formats escape every interpolated value', () => {
    const r = renderCue(cue('system-notification', { title: '<script>x</script>' }), 'epubXhtml');
    expect(r?.text).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(r?.text).not.toContain('<script');
  });

  it('pre-v2 module blocks and unknown blueprints degrade to a readable line', () => {
    const v1: ModuleBlock = {
      id: ID,
      kind: 'module',
      moduleId: 'litrpg-system-box',
      moduleVersion: 1,
      props: { ...getWriterModule('litrpg-system-box')!.schema.defaults },
    };
    const name = getWriterModule('litrpg-system-box')!.meta.name;
    expect(gimmickLines(v1, 'transcript')[0]?.text).toMatch(new RegExp(`^${name}: `));
    expect(gimmickLines(v1, 'summary')[0]?.text).toMatch(new RegExp(`^\\[${name}: .+\\]$`));
    expect(renderCue(cue('nope-404'), 'transcript')).toBeNull();
  });
});
