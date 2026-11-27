// @vitest-environment happy-dom
// text-alchemy engine tests (split from batch-a.test.ts to keep each file <= 250 lines).
import { resolveBlueprintProps, type BlueprintProps } from '@kn/core/gimmicks';
import { afterEach, describe, expect, it } from 'vitest';
import { BATCH_A } from './blueprints/batch-a.ts';
import { createTestContext, type TestContext } from './shared/test-context.ts';
import { textAlchemyEngine } from './text-alchemy/index.ts';

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
  const bp = BATCH_A.find((b) => b.id === id)!;
  const res = resolveBlueprintProps(bp, over);
  if (!res.ok) throw new Error(res.errors.join(';'));
  const inst = textAlchemyEngine.mount(host, bp, res.props, t.ctx);
  return { inst, root: host.querySelector<HTMLElement>('[data-engine]')!, bp };
}

describe('text-alchemy', () => {
  it('gaslight swaps on Look again, and is a toggle when reduced', () => {
    const { root } = setup('gaslight-rewrite');
    const txt = (): string => root.querySelector('.kn-e-text-alchemy__text')!.textContent ?? '';
    expect(txt()).toContain('locked');
    root.querySelector<HTMLButtonElement>('button[aria-label="Look again"]')!.click();
    t.advance(300);
    expect(txt()).toContain('open when I left');
    t.dispose();
    host.remove();
    const calm = setup('gaslight-rewrite', {}, 'reduced');
    const btn = calm.root.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    btn.click();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(calm.root.textContent).toContain('open when I left');
  });

  it('whisper toggles the ghost layer through an accessible button', () => {
    const { root } = setup('gaslight-rewrite', { mode: 'whisper', hint: 'Hold to listen' });
    const btn = root.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    btn.click();
    expect(root.dataset.ghost).toBe('on');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('redact bars peel on click and show final text when reduced', () => {
    const { root } = setup('redacted-file');
    const bars = root.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Reveal redacted text"]',
    );
    expect(bars.length).toBe(3);
    bars[0]!.click();
    expect(bars[0]!.hasAttribute('data-revealed')).toBe(true);
    t.setTier('reduced');
    expect(root.querySelectorAll('button[aria-label="Reveal redacted text"]').length).toBe(0);
    expect(root.textContent).toContain('Pier 9');
  });

  it('cipher decodes within 600 ms and resolves; downgrade finishes instantly', async () => {
    const { inst, root } = setup('gaslight-rewrite', { mode: 'cipher' });
    const txt = (): string => root.querySelector('.kn-e-text-alchemy__text')!.textContent ?? '';
    const p = inst.trigger();
    t.advance(600);
    await p;
    expect(txt()).toContain('open when I left');
    t.dispose();
    host.remove();
    const b = setup('gaslight-rewrite', { mode: 'cipher' });
    const p2 = b.inst.trigger();
    t.advance(90);
    t.setTier('reduced');
    await p2;
    expect(b.root.textContent).toContain('open when I left');
    expect(t.pending()).toBe(0);
  });
});
