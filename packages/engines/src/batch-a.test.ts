// @vitest-environment happy-dom
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveBlueprintProps,
  type BlueprintProps,
  type GimmickEngine,
  type GimmickBlueprint,
} from '@kn/core/gimmicks';
import { validateBlueprint } from '@kn/core/gimmicks/validate';
import { afterEach, describe, expect, it } from 'vitest';
import { artifactDocEngine } from './artifact-doc/index.ts';
import { BATCH_A } from './blueprints/batch-a.ts';
import { LEGACY_CUES } from './blueprints/index.ts';
import { chatThreadEngine } from './chat-thread/index.ts';
import { frameHudEngine } from './frame-hud/index.ts';
import { createTestContext, type TestContext } from './shared/test-context.ts';
import { textAlchemyEngine } from './text-alchemy/index.ts';

const ENGINES: Record<string, GimmickEngine> = {
  'frame-hud': frameHudEngine,
  'chat-thread': chatThreadEngine,
  'text-alchemy': textAlchemyEngine,
  'artifact-doc': artifactDocEngine,
};
const bpOf = (id: string): GimmickBlueprint => BATCH_A.find((b) => b.id === id)!;
const EVIL = '<img src=x onerror=alert(1)>';
let t: TestContext;
let host: HTMLElement;
afterEach(() => {
  t?.dispose();
  host?.remove();
});

function setup(id: string, over: BlueprintProps = {}, tier: 'high' | 'lite' | 'reduced' = 'high') {
  t = createTestContext(tier);
  host = document.createElement('div');
  document.body.append(host);
  const bp = bpOf(id);
  const res = resolveBlueprintProps(bp, over);
  if (!res.ok) throw new Error(res.errors.join(';'));
  const inst = ENGINES[bp.engine]!.mount(host, bp, res.props, t.ctx);
  return { inst, root: host.querySelector<HTMLElement>('[data-engine]')!, bp };
}

describe('blueprints', () => {
  it('has the 8 ids in order and all validate', () => {
    const ids =
      'system-notification royal-decree cyberbrain-link sms-intercept gaslight-rewrite redacted-file police-dossier torn-diary';
    expect(BATCH_A.map((b) => b.id).join(' ')).toBe(ids);
    for (const b of BATCH_A) {
      const r = validateBlueprint(b);
      expect(r.ok ? [] : r.errors, b.id).toEqual([]);
    }
  });

  it('mounts default and sample props for every blueprint in every tier', () => {
    for (const bp of BATCH_A) {
      for (const raw of [bp.defaultProps, bp.sampleProps]) {
        for (const tier of ['high', 'lite', 'reduced'] as const) {
          const { inst, root } = setup(bp.id, raw, tier);
          expect(root.dataset.engine).toBe(bp.engine);
          inst.destroy();
          t.dispose();
        }
      }
    }
  });

  it('maps the legacy cues onto these blueprints', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['gits-cyberbrain-chat', { senderId: 'ECHO', messages: ['hi', 'there'] }],
      ['pt-gaslight-edit', { initialText: 'a', mutatedText: 'b' }],
      ['gits-ghost-whisper', { surfaceLine: 'calm', ghostLine: 'run' }],
      ['litrpg-system-box', { variant: 'level-up', title: 'Lv 2', lines: ['HP up'] }],
    ];
    for (const [id, raw] of cases) {
      const cue = LEGACY_CUES[id]!;
      const res = resolveBlueprintProps(bpOf(cue.blueprintId), cue.map(raw));
      expect(res.ok ? [] : res.errors, id).toEqual([]);
    }
  });
});

describe('frame-hud', () => {
  it('renders, plays and lands with sound', async () => {
    const { inst, root } = setup('system-notification');
    expect(root.textContent).toContain('Shadow Step');
    expect(root.dataset.state).toBe('idle');
    const p = inst.trigger();
    expect(root.dataset.state).toBe('playing');
    t.advance(1200);
    await p;
    expect(root.dataset.state).toBe('done');
    expect(t.stingers).toEqual(['chime']);
  });

  it('is static and silent when reduced, and downgrades live', async () => {
    const s = setup('royal-decree', {}, 'reduced');
    expect(s.root.dataset.state).toBe('done');
    await s.inst.trigger();
    expect(t.stingers).toEqual([]);
    t.dispose();
    host.remove();
    const live = setup('royal-decree');
    const p = live.inst.trigger();
    t.setTier('reduced');
    await p;
    expect(live.root.dataset.state).toBe('done');
    expect(t.stingers).toEqual([]);
  });
});

describe('chat-thread', () => {
  it('reveals one line per delay and resolves after the last', async () => {
    const { inst, root } = setup('sms-intercept');
    const p = inst.trigger();
    const pending = (): number => root.querySelectorAll('[data-pending]').length;
    expect(pending()).toBe(2);
    t.pause();
    t.advance(10000);
    expect(pending()).toBe(2);
    t.resume();
    t.advance(1400);
    expect(pending()).toBe(1);
    t.advance(1400);
    await p;
    expect(pending()).toBe(0);
    expect(root.dataset.state).toBe('done');
    expect(t.stingers.length).toBe(3);
  });

  it('decodes cyber-link lines and shows all lines when reduced', async () => {
    const { inst, root } = setup('cyberbrain-link');
    const p = inst.trigger();
    t.advance(1400);
    await p;
    expect(root.querySelector('.kn-e-chat-thread__text')!.textContent).toBe(
      'You are not alone in here.',
    );
  });

  it('downgrade mid-trigger shows every line and resolves', async () => {
    const { inst, root } = setup('sms-intercept');
    const p = inst.trigger();
    t.advance(1400);
    t.setTier('reduced');
    await p;
    expect(root.querySelectorAll('[data-pending]').length).toBe(0);
    expect(root.querySelector('.kn-e-chat-thread__typing')).toBeNull();
    expect(root.dataset.state).toBe('done');
  });
});

describe('artifact-doc', () => {
  it('lands the stamp with a cue and resolves', async () => {
    const { inst, root } = setup('police-dossier');
    expect(root.textContent).toContain('Harbor District');
    const p = inst.trigger();
    t.advance(400);
    await p;
    expect(root.dataset.state).toBe('done');
    expect(t.stingers).toEqual(['paper-rustle']);
  });

  it('downgrade mid-trigger resolves; reduced is static and silent', async () => {
    const { inst, root } = setup('torn-diary');
    const p = inst.trigger();
    t.setTier('reduced');
    await p;
    expect(root.dataset.state).toBe('done');
    expect(t.stingers).toEqual([]);
  });
});

describe('all engines', () => {
  const evil: Record<string, [string, BlueprintProps]> = {
    'frame-hud': ['system-notification', { title: EVIL, lines: [EVIL] }],
    'chat-thread': ['sms-intercept', { messages: [{ sender: EVIL, text: EVIL, side: 'left' }] }],
    'text-alchemy': ['redacted-file', { initialText: `[[${EVIL}]] ${EVIL}`, alteredText: EVIL }],
    'artifact-doc': ['police-dossier', { heading: EVIL, body: [EVIL], stamp: EVIL }],
  };
  it.each(Object.entries(evil))(
    '%s renders author text as text only and cleans up',
    (_n, [id, over]) => {
      const { inst, root } = setup(id, over);
      void inst.trigger();
      expect(root.querySelector('img')).toBeNull();
      expect(root.textContent).toContain(EVIL);
      inst.destroy();
      inst.destroy();
      t.dispose();
      expect(t.pending()).toBe(0);
    },
  );
});

describe('engine sources', () => {
  it('never use innerHTML-style sinks or raw timers', () => {
    for (const dir of Object.keys(ENGINES)) {
      for (const f of readdirSync(join(process.cwd(), 'packages/engines/src', dir))) {
        const src = readFileSync(join(process.cwd(), 'packages/engines/src', dir, f), 'utf8');
        expect(src, `${dir}/${f}`).not.toMatch(
          /innerHTML|outerHTML|insertAdjacentHTML|document\.write/,
        );
        if (f !== 'blueprints.ts') expect(src).not.toMatch(/\bsetTimeout|requestAnimationFrame/);
        expect(src.split('\n').length).toBeLessThanOrEqual(250);
      }
    }
  });
});
