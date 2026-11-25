// POST /api/reports: public abuse reports (JSON or the HTML takedown form).
import type { HandlerConfig } from './config.ts';
import { escapeHtml, htmlResponse, pageShell } from './html.ts';
import { fail, isRecord, json, readCappedText } from './http.ts';
import { isSlugId } from './protocol.ts';
import { clientKey } from './rate-limit.ts';
import { readNovelDoc } from './takedown.ts';
import { notifyModerationReport } from './moderation-notify.ts';
import type { WaitUntilContext } from './worker.ts';

export const REPORT_REASONS = [
  'harassment',
  'hate',
  'illegal',
  'copyright',
  'spam',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportRecord {
  id: string;
  novelSlug: string;
  chapterSlug?: string;
  reason: ReportReason;
  details?: string;
  createdAt: string;
  ipHash?: string;
}

const MAX_REPORT_BYTES = 8 * 1024;
const MAX_DETAILS = 1000;

type Parsed =
  | { ok: true; value: Omit<ReportRecord, 'id' | 'createdAt' | 'ipHash'> }
  | { ok: false; error: string };

function parseReport(raw: Record<string, unknown>): Parsed {
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v !== '' ? v : undefined;
  const { novelSlug, chapterSlug, reason, details } = raw;
  if (!isSlugId(novelSlug)) return { ok: false, error: 'Invalid novelSlug' };
  const chapter = str(chapterSlug);
  if (chapterSlug !== undefined && chapterSlug !== '' && !isSlugId(chapterSlug)) {
    return { ok: false, error: 'Invalid chapterSlug' };
  }
  const okReason = REPORT_REASONS.find((r) => r === reason);
  if (!okReason) return { ok: false, error: 'Invalid reason' };
  if (details !== undefined && typeof details !== 'string')
    return { ok: false, error: 'Invalid details' };
  if (typeof details === 'string' && details.length > MAX_DETAILS) {
    return { ok: false, error: `details must be at most ${MAX_DETAILS} characters` };
  }
  const detail = str(details);
  return {
    ok: true,
    value: {
      novelSlug,
      reason: okReason,
      ...(chapter ? { chapterSlug: chapter } : {}),
      ...(detail ? { details: detail } : {}),
    },
  };
}

async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function handleReport(
  request: Request,
  config: HandlerConfig,
  ctx?: WaitUntilContext,
): Promise<Response> {
  const isForm = (request.headers.get('content-type') ?? '').includes(
    'application/x-www-form-urlencoded',
  );
  const reply = (status: number, message: string): Response =>
    isForm
      ? htmlResponse(
          pageShell({
            title: status === 201 ? 'Report received' : 'Report not sent',
            body: `<h1>${status === 201 ? 'Report received' : 'Report not sent'}</h1><p>${escapeHtml(message)}</p>`,
          }),
          status,
          'no-store',
        )
      : fail(message, status);

  const text = await readCappedText(request, MAX_REPORT_BYTES);
  if (text instanceof Response) return isForm ? reply(413, 'Report is too large') : text;
  let raw: unknown;
  if (isForm) {
    raw = Object.fromEntries(new URLSearchParams(text));
  } else {
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      return reply(400, 'Body is not valid JSON');
    }
  }
  if (!isRecord(raw)) return reply(400, 'Body must be an object');
  const parsed = parseReport(raw);
  if (!parsed.ok) return reply(400, parsed.error);
  if (!(await readNovelDoc(config.store, parsed.value.novelSlug))) {
    return reply(404, 'Novel not found');
  }

  const ip = clientKey(request);
  const now = (config.now ?? (() => new Date()))();
  const id = crypto.randomUUID();
  const record: ReportRecord = {
    id,
    ...parsed.value,
    createdAt: now.toISOString(),
    ...(ip === 'anon' ? {} : { ipHash: await hashIp(ip) }),
  };
  const stamp = record.createdAt.replace(/[:.]/g, '-');
  await config.store.put(
    `reports/pending/${stamp}-${id}.json`,
    new TextEncoder().encode(JSON.stringify(record)),
    'application/json; charset=utf-8',
  );
  const hook = config.moderationWebhookUrl?.trim();
  if (hook) {
    const alert = notifyModerationReport(hook, record);
    if (ctx) ctx.waitUntil(alert);
    else void alert;
  }
  return isForm
    ? reply(201, 'Thank you. Our moderators will review your report.')
    : json({ ok: true, reportId: id }, 201);
}
