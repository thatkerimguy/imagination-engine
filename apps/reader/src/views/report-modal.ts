// Lazy "Report abuse" dialog. Loaded only on click; styles are injected here to keep the
// initial CSS lean. Everything (node, style, listeners) is removed by the returned close().
import { h } from '../dom.ts';

export interface ReportModalOptions {
  endpoint: string;
  novelSlug: string;
  chapterSlug?: string;
  returnFocus?: HTMLElement | null;
}

const REASONS: readonly [string, string][] = [
  ['harassment', 'Harassment or bullying'],
  ['hate', 'Hate speech'],
  ['illegal', 'Illegal or non-consensual content'],
  ['copyright', 'Copyright infringement'],
  ['spam', 'Spam'],
  ['other', 'Something else'],
];

const CSS = `
.kn-report-back{position:fixed;inset:0;z-index:70;display:grid;place-items:center;padding:1rem;background:rgba(0,0,0,.6);font-family:var(--font-ui)}
.kn-report{width:min(26rem,100%);max-height:100%;overflow:auto;display:grid;gap:.8rem;padding:1.2rem;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--fg)}
.kn-report h2{margin:0;font-size:1.1rem}
.kn-report label{display:flex;align-items:center;gap:.6rem;min-height:3rem}
.kn-report fieldset{border:0;margin:0;padding:0}
.kn-report textarea{width:100%;min-height:5rem;box-sizing:border-box;padding:.5rem;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);font:inherit}
.kn-report button{min-height:3rem;padding:0 1rem;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:inherit;cursor:pointer}
.kn-report button[data-testid=report-submit]{background:var(--accent);color:#111;border-color:var(--accent);font-weight:600}
.kn-report button:disabled{opacity:.5}
.kn-report :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.kn-report-actions{display:flex;gap:.6rem;justify-content:flex-end}
.kn-report p{margin:0}
`;

export function openReportModal(opts: ReportModalOptions): () => void {
  const style = h('style');
  style.textContent = CSS;
  const reasonGroup = h('fieldset', { 'data-testid': 'report-reason' });
  REASONS.forEach(([value, text], i) => {
    reasonGroup.append(
      h(
        'label',
        {},
        h('input', { type: 'radio', name: 'kn-report-reason', value, checked: i === 0 }),
        text,
      ),
    );
  });
  const details = h('textarea', {
    maxlength: 1000,
    rows: 4,
    placeholder: 'Details (optional)',
    'aria-label': 'Details (optional)',
    'data-testid': 'report-details',
  });
  const status = h('p', { 'data-testid': 'report-status', role: 'status' });
  const cancel = h('button', { type: 'button', onClick: () => close() }, 'Cancel');
  const submit = h(
    'button',
    { type: 'button', 'data-testid': 'report-submit', onClick: () => void send() },
    'Submit',
  );
  const actions = h('div', { class: 'kn-report-actions' }, cancel, submit);
  const dialog = h(
    'div',
    {
      class: 'kn-report',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'kn-report-title',
      'data-testid': 'report-modal',
    },
    h('h2', { id: 'kn-report-title' }, 'Report abuse'),
    reasonGroup,
    details,
    status,
    actions,
  );
  const back = h('div', { class: 'kn-report-back' }, dialog);
  const returnTo = opts.returnFocus ?? null;
  let closed = false;

  function close(): void {
    if (closed) return;
    closed = true;
    removeEventListener('keydown', onKey, true);
    back.removeEventListener('click', onBack);
    back.remove();
    style.remove();
    returnTo?.focus();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      const items = [
        ...dialog.querySelectorAll<HTMLElement>('input,textarea,button:not(:disabled)'),
      ];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const wrap = e.shiftKey ? document.activeElement === first : document.activeElement === last;
      if (wrap) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    }
  }
  function onBack(e: Event): void {
    if (e.target === back) close();
  }

  async function send(): Promise<void> {
    const reason = dialog.querySelector<HTMLInputElement>('input:checked')?.value ?? 'other';
    const text = details.value.trim();
    const body: Record<string, string> = { novelSlug: opts.novelSlug, reason };
    if (opts.chapterSlug) body.chapterSlug = opts.chapterSlug;
    if (text) body.details = text;
    submit.disabled = true;
    let message = 'Could not send the report. Please try again.';
    let ok = false;
    try {
      const res = await fetch(opts.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 201) {
        ok = true;
        message = 'Thanks — your report was sent to moderators.';
      } else if (res.status === 429) {
        message = 'Too many reports right now. Please try again in a minute.';
      } else if (res.status === 404) {
        message = 'This book could not be found.';
      }
    } catch {
      // network failure keeps the generic message
    }
    if (closed) return;
    status.textContent = message;
    if (ok) {
      const done = h('button', { type: 'button', onClick: () => close() }, 'Close');
      actions.replaceChildren(done);
      done.focus();
    } else {
      submit.disabled = false;
    }
  }

  addEventListener('keydown', onKey, true);
  back.addEventListener('click', onBack);
  document.head.append(style);
  document.body.append(back);
  dialog.querySelector<HTMLElement>('input')?.focus();
  return close;
}
