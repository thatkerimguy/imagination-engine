import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyModerationReport } from './moderation-notify.ts';
import { handleRequest } from './worker.ts';
import { setup } from './test-helpers.ts';
import type { ReportRecord } from './reports.ts';

const HOOK = 'https://hooks.example.test/abc';
const valid = {
  novelSlug: 'my-novel',
  chapterSlug: 'c1',
  reason: 'spam',
  details: 'x'.repeat(500),
};

afterEach(() => vi.restoreAllMocks());

function fakeCtx() {
  const pending: Promise<unknown>[] = [];
  return { pending, ctx: { waitUntil: (p: Promise<unknown>) => void pending.push(p) } };
}

async function run(hook: string | undefined, fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const h = setup(hook === undefined ? {} : { moderationWebhookUrl: hook });
  await h.publish();
  const { pending, ctx } = fakeCtx();
  const res = await handleRequest(
    new Request('http://x.test/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
      body: JSON.stringify(valid),
    }),
    h.config,
    ctx,
  );
  await Promise.all(pending);
  return { res, pending };
}

describe('moderation webhook', () => {
  it('posts compact JSON without any ip data', async () => {
    const f = vi.fn().mockResolvedValue(new Response('ok'));
    const { res, pending } = await run(HOOK, f);
    expect(res.status).toBe(201);
    expect(pending).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(HOOK);
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(init.signal).toBeDefined();
    const raw = String(init.body);
    expect(raw).not.toMatch(/ip|203\.0\.113/i);
    const body = JSON.parse(raw) as Record<string, string>;
    expect(body).toMatchObject({
      novelSlug: 'my-novel',
      chapterSlug: 'c1',
      reason: 'spam',
      createdAt: '2026-01-02T03:04:05.678Z',
    });
    expect(body.reportId).toBeTruthy();
    expect(body.content).toBe(body.text);
    expect(body.content).toContain('spam');
    expect(body.detailsPreview?.length).toBe(240);
    expect(body.detailsPreview?.endsWith('…')).toBe(true);
  });
  it('is a silent no-op when unset or blank', async () => {
    for (const hook of [undefined, '', '   ']) {
      const f = vi.fn();
      const { res, pending } = await run(hook, f);
      expect(res.status).toBe(201);
      expect(pending).toHaveLength(0);
      expect(f).not.toHaveBeenCalled();
    }
  });
  it('still returns 201 when the webhook throws or answers 500', async () => {
    for (const f of [
      vi.fn().mockRejectedValue(new Error('boom')),
      vi.fn().mockResolvedValue(new Response('no', { status: 500 })),
    ]) {
      const { res } = await run(HOOK, f);
      expect(res.status).toBe(201);
      expect(f).toHaveBeenCalledTimes(1);
    }
  });
  it('fires detached without a ctx and never throws', async () => {
    const f = vi.fn().mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rec: ReportRecord = {
      id: 'r1',
      novelSlug: 'n',
      reason: 'other',
      createdAt: 't',
      ipHash: 'deadbeef',
    };
    await expect(notifyModerationReport(HOOK, rec, f)).resolves.toBeUndefined();
    expect(String((f.mock.calls[0] as [string, RequestInit])[1].body)).not.toContain('deadbeef');
  });
});
