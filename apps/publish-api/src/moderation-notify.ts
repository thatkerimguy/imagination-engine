// Optional, non-blocking moderation alert (Discord/Slack-compatible webhook). Never throws.
import type { ReportRecord } from './reports.ts';

const PREVIEW_MAX = 240;

const preview = (details: string | undefined): string => {
  if (!details) return '';
  return details.length <= PREVIEW_MAX ? details : `${details.slice(0, PREVIEW_MAX - 1)}…`;
};

/** Posts a compact alert. The reporter IP / ipHash are deliberately never included. */
export async function notifyModerationReport(
  url: string,
  report: ReportRecord,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    const detailsPreview = preview(report.details);
    const where = report.chapterSlug
      ? `${report.novelSlug} / ${report.chapterSlug}`
      : report.novelSlug;
    const summary =
      `New abuse report (${report.reason}) on ${where}` +
      (detailsPreview ? `\n${detailsPreview}` : '') +
      `\nReport id: ${report.id}`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: summary,
        text: summary,
        reportId: report.id,
        novelSlug: report.novelSlug,
        ...(report.chapterSlug ? { chapterSlug: report.chapterSlug } : {}),
        reason: report.reason,
        detailsPreview,
        createdAt: report.createdAt,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`moderation webhook responded ${res.status}`);
  } catch (error) {
    console.warn('moderation webhook failed', error instanceof Error ? error.message : 'unknown');
  }
}
