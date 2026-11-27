// Writer live-preview bridge (DIRECTIVE 02 §5): `?preview=1` must render an unsaved draft
// delivered over postMessage, and refuse an invalid one with a readable message.
import { chatState } from './lib/chat-state.mjs';

const HEADLINE = 'Snake Eyes — unsaved draft headline';
const LINE =
  'Unsaved line: the Dealer smiles **a little** too *wide* ==tonight== <script>window.__xss=1</script>';
const LINE_TEXT = 'Unsaved line: the Dealer smiles a little too wide tonight <script>';

export async function previewPass(page, base, { ok, fail, shot }) {
  await page.goto(`${base}?preview=1`);
  await page.getByText('Waiting for the writer…').waitFor({ timeout: 10000 });
  const post = (mutate) =>
    page.evaluate(
      async ({ headline, line, mutate, start }) => {
        const get = (p) => fetch(`novels/vertical-slice/${p}`).then((r) => r.json());
        const [novel, season, chapter] = await Promise.all([
          get('novel.json'),
          get('seasons/s01/season.json'),
          get('seasons/s01/ch01.json'),
        ]);
        chapter.title = headline;
        chapter.status = 'draft';
        chapter.blocks.find((b) => b.kind === 'dialogue').text = line;
        if (mutate === 'invalid') chapter.blocks[2].text = '';
        const dialogue = chapter.blocks.find((b) => b.kind === 'dialogue');
        const extra = start ? { startBlockId: dialogue.id, tier: 'auto' } : { tier: 'lite' };
        window.postMessage({ type: 'kn-preview-load', novel, season, chapter, ...extra }, '*');
      },
      { headline: HEADLINE, line: LINE, mutate, start: mutate === 'from-dialogue' },
    );

  await post('valid');
  await page.getByRole('button', { name: 'Silent' }).click({ timeout: 10000 });
  await page.locator('.kn-hero h1', { hasText: HEADLINE }).waitFor({ timeout: 10000 });
  const rendered = await page.evaluate((line) => {
    const text = document.querySelector('.kn-chapter')?.textContent ?? '';
    const el = document.querySelector('.kn-dialogue .kn-line');
    return {
      line: text.includes(line),
      tier: document.documentElement.dataset.tier,
      spans: ['strong', 'em', 'mark'].map((t) => el?.querySelectorAll(t).length ?? 0),
      inert: !el?.querySelector('script') && !('__xss' in window),
    };
  }, LINE_TEXT);
  if (rendered.line && rendered.tier === 'lite')
    ok('preview bridge rendered an unsaved draft (edited headline + dialogue, tier lite)');
  else fail(`preview bridge did not render the draft: ${JSON.stringify(rendered)}`);
  if (rendered.spans.every((n) => n === 1) && rendered.inert)
    ok('preview renders inline bold / italic / highlight; raw <script> stays inert text');
  else fail(`inline formatting in preview: ${JSON.stringify(rendered)}`);
  if (await page.evaluate(() => localStorage.getItem('kn:bookmark:vertical-slice')))
    fail('preview wrote a reader bookmark');
  await page.waitForTimeout(400);
  await shot(page, '09-reader-preview-bridge');

  // A second load replaces the first without a second curtain (audio already unlocked).
  await post('invalid');
  await page.getByText('This draft cannot be previewed yet:').waitFor({ timeout: 5000 });
  ok('preview bridge rejects an invalid draft with a readable message');

  // Starting mid-chapter (the writer's focused block) replays earlier beats on the same queue:
  // KESTREL-9 must be complete before the dice below the resume point settle.
  await page.goto(`${base}?preview=1`);
  await page.getByText('Waiting for the writer…').waitFor({ timeout: 10000 });
  await post('from-dialogue');
  await page.getByRole('button', { name: 'Silent' }).click({ timeout: 10000 });
  await page.waitForFunction(() => window.__settled, null, { timeout: 20000 });
  const state = await chatState(page);
  const chat = { ...state, calm: state.tier === 'reduced' };
  if (chat.calm && chat.pending === 0 && chat.last === "Don't relax.")
    ok('preview from a mid-chapter block keeps beats sequential (KESTREL-9 before dice)');
  else fail(`preview resume played beats concurrently: ${JSON.stringify(chat)}`);
}
