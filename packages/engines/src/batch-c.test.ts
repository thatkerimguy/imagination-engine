// @vitest-environment happy-dom
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderBlueprintExport,
  type BlueprintProps,
  resolveBlueprintProps,
  type EngineTier,
  type ExportFormat,
} from '@kn/core/gimmicks';
import { validateBlueprint } from '@kn/core/gimmicks/validate';
import { describe, expect, it, vi } from 'vitest';
import { BATCH_C } from './blueprints/batch-c.ts';
import { bpOf, ENGINES, EVIL, fakeCanvas, live, setup } from './batch-c-setup.ts';
import { createTestContext } from './shared/test-context.ts';

const TIERS: EngineTier[] = ['high', 'lite', 'reduced'];
const FORMATS: ExportFormat[] = ['transcript', 'summary', 'epubXhtml', 'royalRoadHtml'];

describe('batch-C blueprints', () => {
  it('has twelve starters, two per engine, all validating', () => {
    expect(BATCH_C.map((b) => b.id)).toEqual([
      'lore-footnote',
      'pov-whisper-note',
      'dual-pov-split',
      'falling-lines-poem',
      'frost-creep-chill',
      'crt-scanline-glitch',
      'cherry-blossom-drift',
      'ember-storm',
      'rain-on-tin',
      'barroom-hum',
      'blade-unsheathe',
      'level-up-chord',
    ]);
    expect(new Set(BATCH_C.map((b) => b.id)).size).toBe(12);
    for (const b of BATCH_C) {
      const r = validateBlueprint(b);
      expect(r.ok ? [] : r.errors).toEqual([]);
      expect(b.version).toBe(1);
    }
  });

  it('exports render non-empty text for default and sample props', () => {
    for (const b of BATCH_C) {
      for (const raw of [b.defaultProps, b.sampleProps]) {
        const r = resolveBlueprintProps(b, raw);
        expect(r.ok).toBe(true);
        if (!r.ok) continue;
        for (const f of FORMATS) {
          expect(
            renderBlueprintExport(b, r.props, f)
              .replace(/<[^>]*>/g, '')
              .trim().length,
          ).toBeGreaterThan(8);
        }
      }
    }
  });

  it('mounts default + sample props in high / lite / reduced without throwing', () => {
    for (const b of BATCH_C) {
      for (const raw of [b.defaultProps, b.sampleProps]) {
        const r = resolveBlueprintProps(b, raw);
        if (!r.ok) throw new Error(b.id);
        for (const tier of TIERS) {
          const t = createTestContext(tier);
          live.push(t);
          const host = document.createElement('div');
          const inst = ENGINES[b.engine]!.mount(host, b, r.props, t.ctx);
          expect(host.firstElementChild?.getAttribute('data-engine')).toBe(b.engine);
          expect(host.querySelector('[onclick],[onerror]')).toBeNull();
          inst.destroy();
          expect(host.childElementCount).toBe(0);
        }
      }
    }
  });

  it('engine sources never use innerHTML', () => {
    const src = dirname(fileURLToPath(import.meta.url));
    for (const dir of Object.keys(ENGINES)) {
      for (const f of readdirSync(join(src, dir))) {
        expect(readFileSync(join(src, dir, f), 'utf8')).not.toMatch(
          /innerHTML|outerHTML|insertAdjacentHTML|document\.write|requestAnimationFrame|setTimeout|setInterval/,
        );
      }
    }
  });

  it('renders author text as text, never markup', () => {
    fakeCanvas();
    const over: Record<string, Record<string, string | string[]>> = {
      'lore-footnote': { anchorText: EVIL, noteTitle: EVIL, noteBody: EVIL, authorLabel: EVIL },
      'dual-pov-split': { leftLabel: EVIL, rightLabel: EVIL },
      'frost-creep-chill': { caption: EVIL },
      'cherry-blossom-drift': { caption: EVIL },
      'rain-on-tin': { label: EVIL },
      'blade-unsheathe': { label: EVIL },
    };
    for (const [id, props] of Object.entries(over)) {
      const { root } = setup(id, 'high', props);
      expect(root.querySelector('img')).toBeNull();
      expect(root.textContent).toContain(EVIL);
    }
    const dual = setup('dual-pov-split', 'high', { entries: [{ col: 'left', text: EVIL }] });
    expect(dual.root.querySelector('img')).toBeNull();
    expect(dual.root.textContent).toContain(EVIL);
    vi.restoreAllMocks();
  });

  it('20x mount / trigger / destroy leaks no DOM and nothing pending', async () => {
    fakeCanvas();
    const before = document.body.childElementCount;
    for (const b of BATCH_C) {
      const t = createTestContext('high');
      t.setAudioUnlocked(true);
      const over: BlueprintProps = b.engine === 'particle-field' ? { fullBleed: true } : {};
      for (let i = 0; i < 20; i++) {
        const host = document.createElement('div');
        document.body.append(host);
        const inst = ENGINES[b.engine]!.mount(host, b, { ...b.defaultProps, ...over }, t.ctx);
        const p = inst.trigger();
        t.frames(2);
        inst.destroy();
        await p;
        host.remove();
      }
      expect(document.body.childElementCount).toBe(before);
      expect(t.pending()).toBe(0);
      t.dispose();
      expect(t.pending()).toBe(0);
    }
    vi.restoreAllMocks();
  });

  it('every id is findable through bpOf', () => {
    expect(bpOf('rain-on-tin').engine).toBe('audio-bed');
    expect(bpOf('barroom-hum').engine).toBe('audio-bed');
  });
});
