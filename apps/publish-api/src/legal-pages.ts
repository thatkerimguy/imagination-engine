// Static legal pages: terms, privacy, takedown form. Zero JS; strict CSP via htmlResponse.
import { REPORT_REASONS } from './reports.ts';
import { escapeHtml, htmlResponse, pageShell } from './html.ts';

const NAV =
  '<nav><a href="/legal/terms">Terms</a><a href="/legal/privacy">Privacy</a>' +
  '<a href="/legal/takedown">Report content</a></nav>';

const TERMS = `<h1>Terms of Use</h1>
<p class="muted">Imagination Engine &middot; version 2026-11</p>
<h2>Prohibited content</h2>
<p>You may not publish any of the following through Imagination Engine:</p>
<ul>
<li>Hate speech or content that attacks people for who they are.</li>
<li>Harassment, threats or targeted abuse.</li>
<li>Illegal content, including sexual content involving minors and non-consensual intimate imagery.</li>
<li>Spam or deceptive mass content.</li>
<li>Material that infringes someone else's copyright.</li>
</ul>
<h2>Public by URL</h2>
<p>Published chapters are publicly accessible to anyone who has the URL. Do not publish anything you want to keep private.</p>
<h2>Moderation and takedown</h2>
<p>Published content is subject to moderation. We may remove a novel, or block it from being published again, if it breaks these terms.</p>
<h2>Your control</h2>
<p>Authors can unpublish their novels at any time from the writer app.</p>
<h2>Reporting</h2>
<p>To report content, use the <a href="/legal/takedown">report form</a>.</p>`;

const PRIVACY = `<h1>Privacy</h1>
<p class="muted">Imagination Engine &middot; version 2026-11</p>
<h2>Stored on your device</h2>
<p>The writer app is local-first: your drafts and settings live on your device. There are no accounts in v1.0.</p>
<h2>Publishing</h2>
<p>When you publish, only the book you choose to publish is uploaded to our hosting (Cloudflare R2).</p>
<h2>Reading</h2>
<p>Reader progress stays in your browser's localStorage and is never sent to us.</p>
<h2>Abuse reports</h2>
<p>When you submit a report we store the fields you send (novel, chapter, reason, details). We do not store your raw IP address.</p>
<h2>Ads and trackers</h2>
<p>There are no ads and no trackers.</p>`;

function takedownForm(novel: string): string {
  const options = REPORT_REASONS.map((r) => `<option value="${r}">${r}</option>`).join('');
  return `<h1>Report content</h1>
<p>Tell us about a novel that breaks the <a href="/legal/terms">Terms of Use</a>.</p>
<form method="post" action="/api/reports">
<label for="novelSlug">Novel slug</label>
<input id="novelSlug" name="novelSlug" type="text" required maxlength="64" pattern="[a-z0-9][a-z0-9\\-]{0,63}" value="${escapeHtml(novel)}">
<label for="chapterSlug">Chapter slug (optional)</label>
<input id="chapterSlug" name="chapterSlug" type="text" maxlength="64" pattern="[a-z0-9][a-z0-9\\-]{0,63}">
<label for="reason">Reason</label>
<select id="reason" name="reason" required>${options}</select>
<label for="details">Details (optional)</label>
<textarea id="details" name="details" rows="5" maxlength="1000"></textarea>
<button type="submit">Send report</button>
</form>`;
}

export function legalPage(name: string, url: URL): Response {
  let title = 'Terms of Use';
  let content = TERMS;
  if (name === 'privacy') {
    title = 'Privacy';
    content = PRIVACY;
  } else if (name === 'takedown') {
    title = 'Report content';
    content = takedownForm(url.searchParams.get('novel')?.slice(0, 64) ?? '');
  }
  return htmlResponse(pageShell({ title: `${title} - Imagination Engine`, body: NAV + content }));
}
