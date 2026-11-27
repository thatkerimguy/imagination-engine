// Contact sheets with 360 px overflow checks (chained from smoke.mjs) and the OVERHAUL-04 QA
// shots 01 (batch 2 engines, dark | light) and 02 (OVERHAUL-03 visual fixes, dark | light).

/** Every card must fit its 360 px cell: no horizontal overflow, nothing clipped on the right. */
async function overflow(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-sheet-slot]')].flatMap((slot) => {
      const cell = slot.parentElement.getBoundingClientRect();
      const bad = [...slot.querySelectorAll('*')].some((n) => {
        const r = n.getBoundingClientRect();
        if (n instanceof SVGElement && n.ownerSVGElement) return false;
        return r.width > 0 && r.right > cell.right + 1 && !n.classList.contains('kn-e-orn');
      });
      return bad || slot.scrollWidth > slot.clientWidth + 1 ? [slot.dataset.sheetSlot] : [];
    }),
  );
}

async function sheetShot(page, BASE, sheet, theme, { ok, fail }) {
  await page.goto(`${BASE}sandbox/?sheet=${sheet}&theme=${theme}&tier=high`);
  await page.locator('body[data-ready]').waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  const cards = await page.locator('[data-sheet-slot] [data-engine]').count();
  const bad = await overflow(page);
  if (bad.length) fail(`${sheet}/${theme}: overflow/clipping in ${bad.join(', ')}`);
  else ok(`${sheet}/${theme}: ${cards} cards, 0 overflow at 360 px`);
  return page.screenshot({ fullPage: true });
}

/** Two full-page shots side by side (dark | light) in a scratch tab. */
async function pair(page, a, b, path) {
  const tab = await page.context().browser().newPage({ deviceScaleFactor: 1 });
  await tab.setViewportSize({ width: 1600, height: 900 });
  const src = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
  await tab.setContent(
    `<body style="margin:0;display:flex;gap:16px;background:#0b0c10;align-items:flex-start">` +
      `<img src="${src(a)}" style="width:50%"><img src="${src(b)}" style="width:50%"></body>`,
  );
  await tab.waitForTimeout(300);
  await tab.screenshot({ path, fullPage: true });
  await tab.close();
}

/** Facts behind shot 02, measured in the page (dark redaction, chamfer ornament, stamp colour). */
async function fixFacts(page, BASE, theme, { ok, fail }) {
  await page.goto(`${BASE}sandbox/?sheet=fixes&theme=${theme}&tier=high`);
  await page.locator('body[data-ready]').waitFor({ timeout: 60000 });
  const f = await page.evaluate(() => {
    const lum = (c) => {
      const m = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
      return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
    };
    const bar = document.querySelector('.kn-e-text-alchemy__bar:not([data-revealed])');
    const stamps = [...document.querySelectorAll('.kn-e-artifact-doc__stamp')].map(
      (s) => getComputedStyle(s).color,
    );
    return {
      bar: bar ? lum(getComputedStyle(bar).backgroundColor) : -1,
      // The censored words must be invisible (transparent ink) in every theme.
      hidden: bar ? /rgba\(.*,\s*0\)|transparent/.test(getComputedStyle(bar).color) : false,
      chamfer: document.querySelectorAll('.kn-e-orn--chamfer-tech').length,
      stamps: new Set(stamps).size,
      emboss: document.querySelectorAll('radialGradient[id^="kn-tr-emboss"]').length,
    };
  });
  if (theme === 'dark') {
    if (f.bar >= 0 && f.bar < 0.12)
      ok(`dark redaction bars are obsidian (luminance ${f.bar.toFixed(3)})`);
    else fail(`dark redaction bar luminance ${f.bar}`);
  }
  if (f.hidden) ok(`${theme}: redacted words stay hidden under the bar (transparent ink)`);
  else fail(`${theme}: redacted words are readable through the bar`);
  if (f.chamfer > 0 && f.stamps >= 3 && f.emboss > 0)
    ok(
      `${theme}: chamfer-tech ornaments ${f.chamfer}, ${f.stamps} distinct stamp colours, wax emboss ${f.emboss}`,
    );
  else fail(`${theme} fixes sheet facts: ${JSON.stringify(f)}`);
}

export async function sheetsPass(newPage, BASE, ctx) {
  const page = await newPage(1);
  await page.setViewportSize({ width: 1542, height: 1000 });
  const shots = ctx.shotsAt;
  await sheetShot(page, BASE, 'batch1', 'dark', ctx);
  const b2d = await sheetShot(page, BASE, 'batch2', 'dark', ctx);
  const b2l = await sheetShot(page, BASE, 'batch2', 'light', ctx);
  if (shots) await pair(page, b2d, b2l, `${shots}/01-engines-batch2-dark-and-light.png`);
  await fixFacts(page, BASE, 'dark', ctx);
  await fixFacts(page, BASE, 'light', ctx);
  const fd = await sheetShot(page, BASE, 'fixes', 'dark', ctx);
  const fl = await sheetShot(page, BASE, 'fixes', 'light', ctx);
  if (shots) await pair(page, fd, fl, `${shots}/02-overhaul03-visual-fixes-verified.png`);
  await page.close();
}
