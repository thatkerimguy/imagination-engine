// Directive 04A sandbox smoke for Gimmick Pack 1: exercises each module's core behaviour, runs ×20
// on every tier asserting "No leaks", and composes 01-sandbox-pack1-trio.png from 390×844 panels.
// Chained from smoke.mjs; `newPage(scale)` records console errors for the caller.

const sandbox = (BASE, id, tier) => `${BASE}sandbox/?module=${id}&tier=${tier}`;

async function setRange(page, label, value) {
  await page
    .locator('.sb-field', { has: page.locator('.sb-label', { hasText: label }) })
    .locator('input[type="range"]')
    .evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
}

async function gaslight(page, BASE, { ok, fail }) {
  await page.goto(sandbox(BASE, 'pt-gaslight-edit', 'high'));
  const root = page.locator('[data-kn-state]');
  await root.waitFor({ timeout: 10000 });
  // Room to scroll the passage well past the viewport top, as a real chapter would.
  await page.evaluate(() =>
    document.querySelector('.kn-chapter').style.setProperty('padding-bottom', '200vh'),
  );
  const state = () => root.getAttribute('data-kn-state');
  const before = await state();
  await page.waitForTimeout(300);
  const panelBefore = await page.screenshot();
  await root.evaluate((el) => scrollBy(0, el.getBoundingClientRect().bottom + 420));
  await page.waitForTimeout(400);
  const armed = await state();
  await page.evaluate(() => scrollBy(0, -60)); // first upward nudge, passage still off-screen
  await page.waitForTimeout(400);
  const mutated = await state();
  await root.evaluate((el) => scrollBy(0, el.getBoundingClientRect().top - 260));
  await page.waitForTimeout(400);
  const shown = await root.evaluate((el) =>
    [...el.querySelectorAll('*')]
      .filter((n) => n.children.length === 0 && getComputedStyle(n).visibility !== 'hidden')
      .map((n) => n.textContent)
      .join(' '),
  );
  const panelAfter = await page.screenshot();
  const seq = `${before} → ${armed} → ${mutated}`;
  if (seq === 'initial → armed → mutated' && /already off/.test(shown))
    ok(`pt-gaslight-edit scroll-back mutation: ${seq} (“${shown.trim()}”)`);
  else fail(`pt-gaslight-edit sequence ${seq}, visible “${shown}”`);
  return [panelBefore, panelAfter];
}

async function ghost(page, BASE, { ok, fail }) {
  await page.goto(sandbox(BASE, 'gits-ghost-whisper', 'high'));
  const box = page.locator('[data-kn-revealed]');
  await box.waitFor({ timeout: 10000 });
  await box.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const resting = await box.getAttribute('data-kn-revealed');
  const panelRest = await page.screenshot();
  const r = await box.boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  const held = await box.getAttribute('data-kn-revealed');
  const panelHeld = await page.screenshot();
  await page.mouse.up();
  await page.waitForTimeout(200);
  const released = await box.getAttribute('data-kn-revealed');
  if (resting === 'false' && held === 'true' && released === 'false')
    ok('gits-ghost-whisper pointer hold reveals and release restores');
  else fail(`gits-ghost-whisper hold: rest ${resting}, held ${held}, released ${released}`);
  // Reduced tier: a tap toggles crisply.
  await page.goto(sandbox(BASE, 'gits-ghost-whisper', 'reduced'));
  await box.waitFor({ timeout: 10000 });
  await box.click();
  const toggled = await box.getAttribute('data-kn-revealed');
  await box.click();
  const back = await box.getAttribute('data-kn-revealed');
  if (toggled === 'true' && back === 'false') ok('gits-ghost-whisper reduced tier tap-toggles');
  else fail(`gits-ghost-whisper reduced toggle: ${toggled} / ${back}`);
  return [panelRest, panelHeld];
}

async function lighter(page, BASE, { ok, fail }) {
  await page.goto(sandbox(BASE, 'bl-lighter-flick', 'high'));
  await page.getByRole('button', { name: 'Trigger Beat' }).waitFor();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Trigger Beat' }).click();
  const flame = page.locator('.kn-lighter');
  await flame.and(page.locator('[data-kn-lighter="lit"]')).waitFor({ timeout: 5000 });
  const canvas = await flame.locator('canvas').count();
  // The sandbox's fixed control dock sits over the bottom corner; the reader has none.
  await page.evaluate(() => (document.querySelector('.sb-dock').style.visibility = 'hidden'));
  await page.waitForTimeout(900);
  const panel = await page.screenshot();
  await page.evaluate(() => (document.querySelector('.sb-dock').style.visibility = ''));
  ok(`bl-lighter-flick ignites on High (${canvas ? 'canvas flame' : 'no canvas!'})`);
  if (!canvas) fail('bl-lighter-flick High tier has no canvas flame');
  // Lifecycle: auto-extinguish snaps the lid shut and the overlay empties.
  await setRange(page, 'Burns for', 1500);
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Trigger Beat' }).click();
  await flame.and(page.locator('[data-kn-lighter="lit"]')).waitFor({ timeout: 5000 });
  const t0 = Date.now();
  await flame.waitFor({ state: 'detached', timeout: 6000 });
  const out = Date.now() - t0;
  if (out >= 1000) ok(`bl-lighter-flick ignite → extinguish lifecycle (out after ${out} ms)`);
  else fail(`bl-lighter-flick went out too early (${out} ms)`);
  return [panel];
}

async function systemBox(page, BASE, { ok, fail }) {
  for (const tier of ['high', 'lite', 'reduced']) {
    await page.goto(sandbox(BASE, 'litrpg-system-box', tier));
    const box = page.locator(`[data-kn-tier="${tier}"][data-kn-variant]`);
    await box.waitFor({ timeout: 10000 });
    const text = (await box.textContent()) ?? '';
    const lines = await box.locator('li').count();
    if (text.includes('Class Evolution Unlocked') && lines === 3)
      ok(`litrpg-system-box renders title + ${lines} lines on ${tier}`);
    else fail(`litrpg-system-box on ${tier}: “${text.slice(0, 60)}” (${lines} lines)`);
  }
}

async function stress(page, BASE, id, { ok, fail }) {
  const stats = page.locator('.sb-stats');
  for (const tier of ['high', 'lite', 'reduced']) {
    await page.goto(sandbox(BASE, id, tier));
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: '×20' }).click();
    await stats.filter({ hasText: /leak/i }).waitFor({ timeout: 120000 });
    const after = (await stats.textContent()) ?? '';
    const lingering = await page.evaluate(
      (m) => document.querySelectorAll(`style[data-module="${m}"]`).length,
      id,
    );
    if (after.includes('No leaks') && lingering === 0) ok(`${id} ×20 on ${tier}: No leaks`);
    else fail(`${id} ×20 on ${tier}: ${after.split('\n')[0]} · styles left ${lingering}`);
  }
}

async function composite(newPage, panels, shotsAt) {
  const page = await newPage(1);
  const labels = [
    'Gaslight · first read',
    'Gaslight · after scroll-back',
    'Ghost line · resting',
    'Ghost line · held',
    'Lighter · High tier',
  ];
  await page.setViewportSize({
    width: 390 * panels.length + 16 * (panels.length + 1),
    height: 900,
  });
  const imgs = panels.map((b) => `data:image/png;base64,${b.toString('base64')}`);
  await page.setContent(
    `<body style="margin:0;background:#0b0c10;display:flex;gap:16px;padding:16px;font:600 14px system-ui;color:#cfd3dc">${imgs
      .map(
        (src, i) =>
          `<figure style="margin:0"><figcaption style="height:24px">${labels[i]}</figcaption><img src="${src}" width="390" height="844" style="display:block;border-radius:12px"></figure>`,
      )
      .join('')}</body>`,
  );
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${shotsAt}/01-sandbox-pack1-trio.png`, fullPage: true });
  await page.close();
}

export async function pack1Pass(newPage, BASE, { ok, fail, shotsAt }) {
  const page = await newPage(1);
  const panels = [
    ...(await gaslight(page, BASE, { ok, fail })),
    ...(await ghost(page, BASE, { ok, fail })),
    ...(await lighter(page, BASE, { ok, fail })),
  ];
  await systemBox(page, BASE, { ok, fail });
  for (const id of [
    'pt-gaslight-edit',
    'gits-ghost-whisper',
    'bl-lighter-flick',
    'litrpg-system-box',
  ])
    await stress(page, BASE, id, { ok, fail });
  await page.close();
  if (shotsAt) await composite(newPage, panels, shotsAt);
}
