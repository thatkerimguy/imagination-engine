// Writer live-preview bridge (DIRECTIVE 02 §5): `?preview=1` must render an unsaved draft
// delivered over postMessage, and refuse an invalid one with a readable message.
const HEADLINE = 'Snake Eyes — unsaved draft headline';
const LINE = 'Unsaved line: the Dealer smiles a little too wide.';

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
    return { line: text.includes(line), tier: document.documentElement.dataset.tier };
  }, LINE);
  if (rendered.line && rendered.tier === 'lite')
    ok('preview bridge rendered an unsaved draft (edited headline + dialogue, tier lite)');
  else fail(`preview bridge did not render the draft: ${JSON.stringify(rendered)}`);
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
  const chat = await page.evaluate(() => ({
    calm: !document.querySelector('.kn-cbc')?.classList.contains('kn-cbc--motion'),
    pending: document.querySelectorAll('.kn-cbc li.pending').length,
    last: document.querySelector('.kn-cbc li:last-child')?.textContent,
  }));
  if (chat.calm && chat.pending === 0 && chat.last === "Don't relax.")
    ok('preview from a mid-chapter block keeps beats sequential (KESTREL-9 before dice)');
  else fail(`preview resume played beats concurrently: ${JSON.stringify(chat)}`);
}
