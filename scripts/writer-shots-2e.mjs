// Directive 02E shot pack + gates: grouped Settings cards (no layout jump), Material You picker,
// unclipped metrics ribbon, dark-theater Live Preview from a Day theme with the native-shake
// prompt, and Note Editor parity. Runs last in writer-shots.mjs (it changes the dice trigger).

/** Records the settings-haptics row's top on every frame for 1.5 s after navigation. */
async function settingsJump(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page.evaluate(
    () =>
      new Promise((done) => {
        const ys = [];
        const t0 = performance.now();
        const tick = () => {
          const el = document.querySelector('[data-testid="settings-haptics"]');
          if (el) ys.push(Math.round(el.getBoundingClientRect().top));
          if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
          else done(ys);
        };
        tick();
      }),
  );
}

/** Unscrolled ribbon: the last metric label must end inside the strip's visible area. */
function ribbonClearance(page) {
  return page.getByTestId('metrics-ribbon').evaluate((bar) => {
    const labels = [...bar.querySelectorAll('[data-testid^="metric-"]')];
    // The strip ends at the 1px separator just left of the customise button.
    const button = bar.querySelector('[data-testid="metrics-customize"]');
    const edge = (button?.getBoundingClientRect().left ?? 0) - 1;
    const box = labels.at(-1)?.getBoundingClientRect();
    return box ? { right: Math.round(box.right), edge: Math.round(edge) } : null;
  });
}

export async function phase2ePass(page, { WRITER, ID, tid, shotsAt, ok, fail, editor }) {
  const shot = (name) => shotsAt && page.screenshot({ path: `${shotsAt}/${name}.png` });
  const settle = (ms = 400) => page.waitForTimeout(ms);

  // 01 Settings: grouped inset cards, first frame already final.
  const ys = await settingsJump(page, `${WRITER}settings`);
  const distinct = [...new Set(ys)];
  if (ys.length && distinct.length === 1) ok(`Settings renders with zero layout jump (y=${ys[0]})`);
  else fail(`Settings rows moved after first paint: ${distinct.join(' → ') || 'never shown'}`);
  const cards = await page.locator('[data-testid^="card-"]').count();
  if (cards >= 4) ok(`Settings groups sections into ${cards} inset cards`);
  else fail(`expected >= 4 Settings cards, found ${cards}`);
  await settle();
  await shot('01-settings-grouped-cards');

  // 02 Appearance: Match phone theme on, swatch dots and Soft tint | Exact wallpaper.
  await page.goto(`${WRITER}appearance`);
  await tid('theme-system').waitFor({ timeout: 15000 });
  if (!(await tid('material-you-style').count())) await tid('theme-system').click();
  await tid('material-you-style').waitFor({ timeout: 3000 });
  await tid('material-you-swatch').waitFor();
  ok('Match phone theme shows wallpaper dots and the Soft tint | Exact wallpaper control');
  await tid('theme-system').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await settle();
  await shot('02-appearance-material-you-picker');

  // 03 Editor: ribbon scrolled to its end, last label clear of the customise button.
  await editor();
  await tid('metrics-ribbon').waitFor();
  const clip = await ribbonClearance(page);
  if (clip && clip.right <= clip.edge)
    ok(`metrics ribbon fits at rest, last label ${clip.edge - clip.right}px clear`);
  else fail(`metrics ribbon label clipped at rest: ${JSON.stringify(clip)}`);
  await tid('toolbar-collapse-format').waitFor();
  await tid('toolbar-collapse-add').waitFor();
  await shot('03-editor-metrics-unclipped');

  // 04 Live Preview from Paper Daylight: dark theater + native-shake prompt, then a shake throws.
  await page.addInitScript(() => {
    window.__KN_NATIVE_SHAKE__ = true;
  });
  await page.goto(`${WRITER}appearance`);
  await tid('theme-paper-daylight').scrollIntoViewIfNeeded();
  await tid('theme-paper-daylight').click();
  await editor();
  await tid(`pill-${ID.dice}`).scrollIntoViewIfNeeded();
  await tid(`pill-${ID.dice}`).click();
  await tid('gimmick-sheet').waitFor({ timeout: 5000 });
  await tid('field-trigger-tap-or-shake').scrollIntoViewIfNeeded();
  await tid('field-trigger-tap-or-shake').click();
  await tid('gimmick-save').click();
  await tid('gimmick-sheet').waitFor({ state: 'detached', timeout: 5000 });
  await tid(`dialogue-text-${ID.dialogue}`).click();
  await tid('preview-button').click();
  await tid('preview-screen').waitFor({ timeout: 10000 });
  const frame = page.frameLocator('iframe[title="Reader preview"]');
  await frame.getByRole('button', { name: 'Silent' }).click({ timeout: 15000 });
  const prompt = frame.getByRole('button', { name: '🎲 Tap or shake to throw' });
  await prompt.waitFor({ timeout: 30000 });
  ok('offline reader offers "🎲 Tap or shake to throw" under __KN_NATIVE_SHAKE__');
  const bg = await tid('preview-screen').evaluate((el) => getComputedStyle(el).backgroundColor);
  if (bg === 'rgb(14, 15, 18)') ok('Live Preview sits in the #0E0F12 dark theater on a Day theme');
  else fail(`Live Preview surround is ${bg}, expected rgb(14, 15, 18)`);
  await prompt.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await settle(600);
  await shot('04-preview-dark-theater-shake');
  const reader = page.frames().find((f) => f.url() === 'about:srcdoc');
  await reader.evaluate(() => {
    window.__settled = 0;
    window.dispatchEvent(new Event('kn-native-shake'));
  });
  await reader.waitForFunction(() => window.__settled > 0, null, { timeout: 30000 });
  ok('a kn-native-shake event throws the dice');

  // 05 Standalone Note Editor: toolbar halves + metrics ribbon.
  await page.goto(`${WRITER}folders/note/d-fog`);
  await tid('metrics-ribbon').waitFor({ timeout: 15000 });
  await tid('toolbar-collapse-format').waitFor();
  await tid('toolbar-collapse-add').click();
  await tid('toolbar-expand-add').waitFor({ timeout: 3000 });
  ok('Note Editor has the metrics ribbon and collapsible toolbar halves');
  const noteClip = await ribbonClearance(page);
  if (noteClip && noteClip.right <= noteClip.edge) ok('Note Editor ribbon fits at rest');
  else fail(`Note Editor ribbon clipped at rest: ${JSON.stringify(noteClip)}`);
  await settle();
  await shot('05-note-editor-parity');
  await tid('toolbar-expand-add').click();
}
