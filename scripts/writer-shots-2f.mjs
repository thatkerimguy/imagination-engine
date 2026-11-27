// Directive 02F shot pack + gates: calm Search focus, unclipped tab labels, docked toolbar in both
// editors, steady SegmentControls, staggered font previews. Runs after the 2E pass.

/** Collects console warnings/errors raised while `fn` runs. */
async function withConsole(page, fn) {
  const seen = [];
  const on = (m) => ['warning', 'error'].includes(m.type()) && seen.push(m.text().slice(0, 160));
  page.on('console', on);
  try {
    await fn();
  } finally {
    page.off('console', on);
  }
  return seen;
}

/** Every role=tab (and its text descendants) must fit its own box; returns the offenders. */
function clippedTabs(page) {
  return page.locator('[role="tab"]').evaluateAll((tabs) =>
    tabs.flatMap((tab) =>
      [tab, ...tab.querySelectorAll('*')]
        .filter((el) => el === tab || (el.children.length === 0 && el.textContent))
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${tab.textContent}:${el.scrollWidth}>${el.clientWidth}`),
    ),
  );
}

async function tabsUnclipped(page, ok, fail, label, expected) {
  const texts = await page.locator('[role="tab"]').allTextContents();
  const missing = expected.filter((t) => !texts.includes(t));
  const bad = await clippedTabs(page);
  if (!missing.length && !bad.length) ok(`${label} tabs render fully (${expected.join(' | ')})`);
  else fail(`${label} tabs clipped/missing: ${JSON.stringify({ missing, bad })}`);
}

async function searchGates(page, { WRITER, tid, ok, fail, shot }) {
  await page.goto(WRITER);
  await page.waitForLoadState('domcontentloaded');
  const link = page
    .getByRole('tab', { name: 'Search' })
    .or(page.getByRole('link', { name: 'Search' }));
  if (
    await link
      .first()
      .isVisible({ timeout: 8000 })
      .catch(() => false)
  )
    await link.first().click();
  else await page.goto(`${WRITER}search`);
  await tid('search-field').waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  if (focused !== 'search-field') ok('Search tab does not steal focus (no keyboard pop)');
  else fail('Search field is auto-focused');
  await tid('scope-notes').waitFor();
  await tabsUnclipped(page, ok, fail, 'Search', ['All', 'Chapters', 'Notes']);
  const notes = await tid('scope-notes').textContent();
  if (notes === 'Notes') ok('"Notes" scope renders its full label');
  else fail(`Notes tab text is ${JSON.stringify(notes)}`);
  await shot('01-search-calm-unclipped-notes');
}

async function sheetAndGrowthGates(page, { tid, editor, ok, fail }) {
  await editor();
  await tid('stats-pill').click();
  await tid('text-analysis-sheet').waitFor();
  for (const t of ['frequency', 'extract', 'overview']) await tid(`analysis-tab-${t}`).click();
  await tabsUnclipped(page, ok, fail, 'Text Analysis', ['Overview', 'Frequency', 'Extract']);
  await page.getByRole('button', { name: 'Close sheet' }).last().click();
  await tid('editor-menu').click();
  await tid('menu-growth').click();
  await tid('growth-card-words').waitFor({ timeout: 10000 });
  for (const r of ['today', '7d', '30d', '1y', 'lifetime']) await tid(`growth-range-${r}`).click();
  await tabsUnclipped(page, ok, fail, 'Growth', ['1D', '7D', '30D', '1Y', 'All']);
}

async function toolbarGates(page, { WRITER, tid, editor, ok, fail, shot }) {
  const check = async (name) => {
    const h = await tid('formatting-toolbar').evaluate((el) => el.getBoundingClientRect().height);
    if (h >= 44) ok(`${name} toolbar is ${Math.round(h)}px tall (>= 44)`);
    else fail(`${name} toolbar height ${h}px < 44`);
    for (const half of ['format', 'add']) {
      await tid(`toolbar-collapse-${half}`).click();
      await tid(`toolbar-expand-${half}`).waitFor({ timeout: 3000 });
      await tid(`toolbar-expand-${half}`).click();
      await tid(`toolbar-collapse-${half}`).waitFor({ timeout: 3000 });
    }
    ok(`${name} toolbar collapse/expand works for the format and add halves`);
  };
  const seen = await withConsole(page, async () => {
    await editor();
    await tid('formatting-toolbar').waitFor({ timeout: 15000 });
    await check('Chapter editor');
    await page.waitForTimeout(300);
    await shot('02-editor-toolbar-docked-safe');
    await page.goto(`${WRITER}folders/note/d-fog`);
    await tid('formatting-toolbar').waitFor({ timeout: 15000 });
    await check('Note editor');
  });
  if (seen.length === 0) ok('toolbar checks raised zero console errors');
  else fail(`toolbar console output: ${seen.join(' | ')}`);
}

/** Switching segments must update the active state without the control moving. */
async function segmentCheck(page, { tid, ok, fail }, name, id, first, second) {
  const box = () => tid(id).evaluate((el) => JSON.stringify(el.getBoundingClientRect()));
  const before = await box();
  await tid(second).click();
  await page.waitForTimeout(350);
  const on = await tid(second).getAttribute('aria-checked');
  const off = await tid(first).getAttribute('aria-checked');
  const after = await box();
  if (on === 'true' && off === 'false' && before === after) ok(`${name} segments switch in place`);
  else fail(`${name} segments: active=${on}/${off}, box moved=${before !== after}`);
  await tid(first).click();
  await page.waitForTimeout(250);
}

async function controlGates(page, ctx, shot) {
  const { WRITER, tid, ok, fail } = ctx;
  const seen = await withConsole(page, async () => {
    await page.goto(`${WRITER}settings-publishing`);
    await tid('settings-preview-mode').waitFor({ timeout: 15000 });
    await segmentCheck(
      page,
      ctx,
      'Settings',
      'settings-preview-mode',
      'settings-preview-offline',
      'settings-preview-custom',
    );
    await tid('settings-preview-mode').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await shot('03-settings-smooth-controls');
    await page.goto(`${WRITER}appearance`);
    await tid('theme-system').waitFor({ timeout: 15000 });
    if (!(await tid('material-you-style').count())) await tid('theme-system').click();
    await tid('material-you-style').waitFor({ timeout: 3000 });
    await segmentCheck(
      page,
      ctx,
      'Appearance',
      'material-you-style',
      'material-you-style-soft',
      'material-you-style-exact',
    );
    // The font queue loads 3 faces at a time: wait until the loaded-face count stops growing.
    await page.waitForFunction(
      () => {
        const n = document.fonts.size;
        const w = window;
        if (w.__fontN === n) w.__fontStable = (w.__fontStable ?? 0) + 1;
        else [w.__fontN, w.__fontStable] = [n, 0];
        return w.__fontStable >= 6;
      },
      null,
      { timeout: 30000, polling: 250 },
    );
    await tid('theme-system').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await shot('04-appearance-staggered-fonts');
  });
  if (seen.length === 0) ok('Settings and Appearance controls raised zero console warnings');
  else fail(`control console output: ${seen.join(' | ')}`);
}

export async function phase2fPass(page, { WRITER, tid, shotsAt, ok, fail, editor }) {
  const shot = (name) => shotsAt && page.screenshot({ path: `${shotsAt}/${name}.png` });
  const ctx = { WRITER, tid, ok, fail, editor, shot };
  await searchGates(page, ctx);
  await sheetAndGrowthGates(page, ctx);
  await toolbarGates(page, ctx);
  await controlGates(page, ctx, shot);
}
