// Warm-theme dice shots and a frame helper, split out of smoke.mjs to keep it under 250 lines.

export async function warmPass(page, shot, settled, BASE) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'kn:prefs',
      JSON.stringify({ fontScale: 1, theme: 'warm', tier: 'auto', sound: true }),
    ),
  );
  await page.goto(`${BASE}sandbox/?module=bl-dice-3d&tier=high`);
  await page.getByRole('button', { name: 'Trigger Beat' }).click();
  await page.locator('.kn-stage-gl:not([hidden])').waitFor({ timeout: 10000 });
  await page.waitForTimeout(150);
  await shot(page, '02a-warm-theme-dice-midroll');
  await settled(page);
  await page.waitForTimeout(200);
  await shot(page, '02-warm-theme-dice-shadows');
}

export function nextFrames(page, n) {
  return page.evaluate(
    (count) =>
      new Promise((resolve) => {
        const step = (left) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
        step(count);
      }),
    n,
  );
}
