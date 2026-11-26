// Directive 04A writer shots (Gimmick Pack 1 + Phase 3 polish), run last by writer-shots.mjs:
//   02 gimmick picker listing all 6 modules, 03 editor with the 3 new cue cards + a schema sheet,
//   04 Settings → Publishing with "Connected" (the verify call is answered by a local route).
const PACK = ['pt-gaslight-edit', 'gits-ghost-whisper', 'bl-lighter-flick'];
const ALL = ['core-ambient-bed', 'gits-cyberbrain-chat', 'bl-dice-3d', ...PACK];
const MOCK_API = 'http://127.0.0.1:8099/__mock-publish-api';

export async function phase4aPass(page, { WRITER, packAt, tid, ok, fail, editor }) {
  const shot = (name) => packAt && page.screenshot({ path: `${packAt}/${name}.png` });

  // Enable the pack for the sample novel through Novel settings (schema-driven toggles).
  await page.goto(`${WRITER}novel/vertical-slice/settings`);
  await tid(`module-toggle-${PACK[0]}`).waitFor({ timeout: 15000 });
  for (const id of PACK) {
    const sw = tid(`module-toggle-${id}`);
    await sw.scrollIntoViewIfNeeded();
    if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
  }
  await tid('novel-settings-save').click();
  await page.waitForTimeout(400);
  ok('Gimmick Pack 1 enabled in Novel settings');

  // 02 Gimmick picker with all 6 modules.
  await editor();
  // OVERHAUL-02: prose edits as continuous runs (`run-*`); select the last one as insert point.
  const last = page.locator('textarea[data-testid^="prose-text-"]').last();
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await tid('tool-addGimmick').click();
  await tid('gimmick-picker').waitFor({ timeout: 5000 });
  const listed = [];
  for (const id of ALL) if (await tid(`pick-${id}`).count()) listed.push(id);
  if (listed.length === 6) ok('gimmick picker lists all 6 modules');
  else fail(`gimmick picker lists ${listed.length}/6: ${listed.join(', ')}`);
  await page.waitForTimeout(400);
  await shot('02-writer-gimmick-picker-6-modules');

  // Insert the 3 new gimmicks; each opens its schema-driven sheet, which we save.
  for (const [i, id] of PACK.entries()) {
    if (i > 0) {
      await tid('tool-addGimmick').click();
      await tid('gimmick-picker').waitFor({ timeout: 5000 });
    }
    await tid(`pick-${id}`).click();
    const sheet = tid('gimmick-sheet');
    if (await sheet.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tid('gimmick-save').click();
      await sheet.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  }
  const pills = await page.locator('[data-testid^="pill-"]').allTextContents();
  const cues = ['Gaslight', 'Ghost', 'Ignite'].filter((w) => pills.some((t) => t.includes(w)));
  if (cues.length === 3) ok('3 new cue cards render inline (gaslight, ghost line, lighter)');
  else fail(`new cue cards missing: found ${cues.join(', ')} in ${pills.length} pills`);

  // 03 Editor with the new cues inline (left) + the gaslight sheet open (right).
  const gaslight = page.locator('[data-testid^="pill-"]', { hasText: 'Gaslight' }).last();
  await gaslight.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => scrollBy(0, -140));
  await page.waitForTimeout(400);
  const cuesPanel = await page.screenshot();
  await gaslight.click();
  await tid('gimmick-sheet').waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  const sheetPanel = await page.screenshot();
  if (packAt)
    await sideBySide(
      page,
      [cuesPanel, sheetPanel],
      `${packAt}/03-writer-editor-new-gimmick-cues.png`,
    );
  await page.getByRole('button', { name: 'Close sheet' }).last().click();
  ok('pt-gaslight-edit schema sheet opens');

  // 04 Settings → Publishing → Test connection, answered locally (no network).
  await page.route(`${MOCK_API}/api/verify`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '{"ok":true}',
    }),
  );
  await page.goto(`${WRITER}settings`);
  await tid('publish-api-url').waitFor({ timeout: 15000 });
  await tid('publish-api-url').fill(MOCK_API);
  await tid('publish-token').fill('qa-token');
  await tid('publish-reader-url').fill('http://127.0.0.1:8099/reader');
  await tid('publish-reader-url').blur();
  await tid('publish-test').click();
  const status = tid('publish-test-status');
  await status.filter({ hasText: 'Connected' }).waitFor({ timeout: 8000 });
  const inset = await page.evaluate(() => {
    const row = document.querySelector('[data-testid="publish-test"]')?.getBoundingClientRect();
    const label = document
      .querySelector('[data-testid="publish-test-status"]')
      ?.getBoundingClientRect();
    return row && label ? Math.round(row.right - label.right) : -1;
  });
  if (inset >= 12) ok(`"Connected" sits ${inset}px in from the row edge`);
  else fail(`"Connected" label is only ${inset}px from the row edge`);
  await tid('card-publishing').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot('04-settings-publishing-connected-fixed');
}

/** Two 390×844 @2× panels side by side, composed in a scratch tab of the same browser. */
async function sideBySide(page, panels, path) {
  const tab = await page.context().browser().newPage();
  await tab.setViewportSize({ width: 390 * panels.length + 12 * (panels.length + 1), height: 868 });
  const imgs = panels.map((b) => `data:image/png;base64,${b.toString('base64')}`);
  await tab.setContent(
    `<body style="margin:0;padding:12px;display:flex;gap:12px;background:#0b0c10">${imgs
      .map((src) => `<img src="${src}" width="390" height="844" style="border-radius:10px">`)
      .join('')}</body>`,
  );
  await tab.waitForTimeout(200);
  await tab.screenshot({ path });
  await tab.close();
}
