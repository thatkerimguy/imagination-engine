// Directive 06A writer shots (phone, run last by writer-shots.mjs; pack root):
//   01 Settings: clipped grouped cards (Appearance & Fonts) + the self-contained Test connection row,
//   02 Root tab pager mid-swipe Library → Notes (finger-following, RecentStrip intact),
// plus gates for the 32 dp edge dead zone, RecentStrip yield, tab-bar sync and /folders + /search
// deep links settling on `/`. The tablet rail shot (03) lives in writer-shots-tablet.mjs.

/** Real touch events (the context has hasTouch), so RN-web's responder sees a finger. */
async function touchDrag(page, cdp, from, to, { hold = false, steps = 10 } = {}) {
  const point = (x, y) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(...from) });
  for (let i = 1; i <= steps; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / steps;
    const y = from[1] + ((to[1] - from[1]) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x, y) });
    await page.waitForTimeout(16);
  }
  if (!hold) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const selected = (tid, key) =>
  tid(`tab-${key}`).evaluate((el) => el.getAttribute('aria-selected') === 'true');

const pageX = (tid, i) =>
  tid(`root-page-${i}`).evaluate((el) => Math.round(el.getBoundingClientRect().left));

export async function dir06aPass(page, { WRITER, packAt, tid, ok, fail }) {
  const shot = (name) => packAt && page.screenshot({ path: `${packAt}/${name}.png` });
  const cdp = await page.context().newCDPSession(page);

  // 01 — Settings cards: every rounded card clips its rows; Test connection fills its own box.
  await page.goto(`${WRITER}settings`);
  await tid('card-appearance').waitFor({ timeout: 15000 });
  const cards = await page
    .locator('[data-testid^="card-"]')
    .evaluateAll((els) =>
      els.map((e) => [getComputedStyle(e).overflow, parseFloat(getComputedStyle(e).borderRadius)]),
    );
  if (cards.length >= 4 && cards.every(([o, r]) => o === 'hidden' && r > 0))
    ok(`${cards.length} settings cards are rounded and clip their rows`);
  else fail(`settings card clipping: ${JSON.stringify(cards)}`);
  const row = await tid('open-appearance').evaluate((el) => {
    const card = el.closest('[data-testid="card-appearance"]').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return Math.abs(r.left - card.left) <= 1.5 && Math.abs(r.right - card.right) <= 1.5;
  });
  if (row) ok('Appearance & Fonts row is full-bleed inside its card');
  else fail('Appearance & Fonts row is inset inside its card (floating highlight)');
  // Test connection now lives on Settings › Web Publishing & API (OVERHAUL-02A, 1 tap).
  await tid('open-publishing').click();
  const test = tid('publish-test');
  await test.waitFor({ timeout: 15000 });
  await test.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const testBox = await test.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { overflow: cs.overflow, pad: parseFloat(cs.paddingLeft) };
  });
  if (testBox.overflow === 'hidden' && testBox.pad > 0)
    ok('Test connection clips its own surface with padding inside it');
  else fail(`Test connection shape: ${JSON.stringify(testBox)}`);
  await test.hover();
  await page.waitForTimeout(300);
  await shot('01-settings-card-highlights');
  await page.mouse.move(0, 0);

  // 02 — Root pager on a phone.
  await page.goto(WRITER);
  await tid('novel-card-vertical-slice').waitFor({ timeout: 20000 });
  await tid('root-tabs-pager').waitFor();
  await page.waitForTimeout(1600); // neighbours warm-mount after the first idle
  const y = 600;
  await touchDrag(page, cdp, [10, y], [200, y]);
  await page.waitForTimeout(500);
  await touchDrag(page, cdp, [380, y], [150, y]);
  await page.waitForTimeout(500);
  if ((await selected(tid, 'library')) && (await pageX(tid, 0)) === 0)
    ok('swipes from the 32 dp screen edges are left to system back');
  else fail('an edge swipe switched tabs');
  const strip = tid('recent-strip');
  if (await strip.count()) {
    const box = await strip.first().boundingBox();
    const sy = box.y + box.height - 20;
    await touchDrag(page, cdp, [300, sy], [80, sy]);
    await page.waitForTimeout(500);
    if (await selected(tid, 'library')) ok('dragging the RecentStrip carousel never switches tabs');
    else fail('RecentStrip drag switched tabs');
  }
  await touchDrag(page, cdp, [200, y], [200, y - 260]);
  await page.waitForTimeout(400);
  if (await selected(tid, 'library')) ok('a vertical drag scrolls, never switches tabs');
  else fail('vertical drag switched tabs');
  await tid('root-page-0').evaluate((el) => {
    for (const n of el.querySelectorAll('div'))
      if (/(auto|scroll)/.test(getComputedStyle(n).overflowY)) return n.scrollTo(0, 0);
  });
  await touchDrag(page, cdp, [320, y], [170, y], { hold: true });
  await page.waitForTimeout(200);
  const mid = await pageX(tid, 1);
  if (mid > 0 && mid < 390) ok(`pager follows the finger (Notes at ${mid}px mid-swipe)`);
  else fail(`pager did not track the finger (Notes left ${mid})`);
  await shot('02-root-tabs-library-to-notes');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(600);
  if ((await selected(tid, 'notes')) && (await pageX(tid, 1)) === 0)
    ok('swipe past 25% settles on Notes and syncs the tab bar');
  else fail('swipe did not settle on Notes');
  await tid('folder-row-f-world')
    .waitFor({ timeout: 5000 })
    .catch(() => undefined);
  await touchDrag(page, cdp, [300, y], [120, y]);
  await page.waitForTimeout(600);
  if ((await selected(tid, 'search')) && (await pageX(tid, 2)) === 0)
    ok('Notes → Search swipe settles on Search');
  else fail('swipe did not settle on Search');
  await tid('tab-library').click();
  await page.waitForTimeout(600);
  if ((await pageX(tid, 0)) === 0 && (await selected(tid, 'library')))
    ok('tapping Library animates the pager back');
  else fail('tab tap did not move the pager');
  const path = () => new URL(page.url()).pathname;
  if (path() === '/') ok('tab switching keeps one `/` route (no stacked screens)');
  else fail(`tab switching changed the route to ${path()}`);

  // Deep links focus their tab inside the pager.
  await page.goto(`${WRITER}search`);
  await tid('search-field').waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  if (path() === '/' && (await selected(tid, 'search')) && (await pageX(tid, 2)) === 0)
    ok('/search deep link settles on `/` with Search focused');
  else fail(`/search deep link: path ${path()}`);
  await page.goto(`${WRITER}folders`);
  await tid('notes-sort').waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  if (path() === '/' && (await selected(tid, 'notes')) && (await pageX(tid, 1)) === 0)
    ok('/folders deep link settles on `/` with Notes focused');
  else fail(`/folders deep link: path ${path()}`);
  await tid('tab-library').click();
  await page.waitForTimeout(400);
  await cdp.detach();
}
