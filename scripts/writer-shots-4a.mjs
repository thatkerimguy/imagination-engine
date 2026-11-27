// Directive 04A writer shots (regression): 04 Settings → Publishing with "Connected" (the verify
// call is answered by a local route). The v1 gimmick-picker shots retired with the v1 modules in
// OVERHAUL-04 (the Catalog Browser is covered by writer-shots-ov04.mjs).
const MOCK_API = 'http://127.0.0.1:8099/__mock-publish-api';

export async function phase4aPass(page, { WRITER, packAt, tid, ok, fail }) {
  const shot = (name) => packAt && page.screenshot({ path: `${packAt}/${name}.png` });

  // 04 Settings → Publishing → Test connection, answered locally (no network).
  await page.route(`${MOCK_API}/api/verify`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '{"ok":true}',
    }),
  );
  await page.goto(`${WRITER}settings-publishing`);
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
