// Glare gate for the four dice finishes (DIRECTIVE 02D): renders each material in the sandbox at
// High tier with scripted [6, 6], then measures the settled die pixels. Decoding happens inside
// a blank page (screenshot -> <img> -> canvas -> getImageData), so no PNG library is needed.
const MATERIALS = [
  { id: 'ivory', label: 'Ivory', chip: 'Ivory' },
  { id: 'casino-red', label: 'Casino Red', chip: 'Casino Red' },
  { id: 'brass', label: 'Brushed Brass', chip: 'Brushed Brass' },
  { id: 'obsidian', label: 'Obsidian', chip: 'Obsidian' },
];

// Runs in the analysis page. `a.base` is the sandbox without dice, `a.dice` with settled dice.
async function analyse(a) {
  const load = (src) =>
    new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('screenshot failed to decode'));
      i.src = src;
    });
  const [base, dice] = await Promise.all([load(a.base), load(a.dice)]);
  const { width: w, height: h } = dice;
  const read = (img) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, w, h).data;
  };
  const p0 = read(base);
  const p1 = read(dice);
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const R = [];
  const G = [];
  const B = [];
  const L = [];
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d =
        Math.abs(p1[i] - p0[i]) + Math.abs(p1[i + 1] - p0[i + 1]) + Math.abs(p1[i + 2] - p0[i + 2]);
      if (d < a.threshold) continue;
      R.push(p1[i]);
      G.push(p1[i + 1]);
      B.push(p1[i + 2]);
      L.push(lum(p1[i], p1[i + 1], p1[i + 2]));
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  const n = L.length;
  if (n === 0) return { n: 0 };
  const mean = (v) => v.reduce((s, t) => s + t, 0) / v.length;
  const sorted = (v) => [...v].sort((p, q) => p - q);
  const at = (v, q) => sorted(v)[Math.min(v.length - 1, Math.floor(v.length * q))];
  const mL = mean(L);
  const sd = Math.sqrt(mean(L.map((t) => (t - mL) ** 2)));
  const pad = 10;
  const cx = Math.max(0, x0 - pad);
  const cy = Math.max(0, y0 - pad);
  const cw = Math.min(w - cx, x1 - x0 + pad * 2);
  const ch = Math.min(h - cy, y1 - y0 + pad * 2);
  const crop = document.createElement('canvas');
  crop.width = cw;
  crop.height = ch;
  crop.getContext('2d').drawImage(dice, cx, cy, cw, ch, 0, 0, cw, ch);
  return {
    n,
    meanRGB: [mean(R), mean(G), mean(B)].map(Math.round),
    medianRGB: [at(R, 0.5), at(G, 0.5), at(B, 0.5)],
    meanLum: mL,
    stddev: sd,
    spread: at(L, 0.95) - at(L, 0.05),
    nearWhitePct: (100 * L.filter((t) => t > 240).length) / n,
    crop: crop.toDataURL('image/png'),
  };
}

async function setField(page, label, run) {
  const field = page.locator('.sb-field', { has: page.locator('.sb-label', { hasText: label }) });
  await run(field.first());
}

async function measure(newPage, base, shot, mat) {
  const page = await newPage(1);
  await page.goto(`${base}sandbox/?module=bl-dice-3d&tier=high`);
  await page.getByRole('radio', { name: mat.chip, exact: true }).click({ timeout: 15000 });
  // Scripted [6, 6]: two dice are the default, so only the face numbers change.
  for (const i of [0, 1])
    await setField(page, 'Faces that land up', async (f) => {
      await f.locator('input[type=number]').nth(i).fill('6');
      await f.locator('input[type=number]').nth(i).blur();
    });
  await setField(page, 'Hold result', (f) =>
    f.locator('input[type=range]').evaluate((el) => {
      el.value = '8';
      el.dispatchEvent(new Event('change'));
    }),
  );
  // Hide the live telemetry dock so only the dice differ between the two frames.
  await page.addStyleTag({ content: '.sb-dock{visibility:hidden!important}' });
  await page.waitForTimeout(800);
  const baseline = (await page.screenshot()).toString('base64');
  await page.evaluate(() => {
    window.__settled = 0;
    document.querySelector('.sb-trigger').click();
  });
  await page.waitForFunction(() => window.__settled, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  const dice = (await page.screenshot()).toString('base64');
  await shot(page, `01-dice-${mat.id}-settled`);
  await page.close();
  return { baseline, dice };
}

export async function diceMaterialsPass(newPage, base, { ok, fail, shot }) {
  const analysis = await newPage(1);
  await analysis.goto('about:blank');
  const results = [];
  for (const mat of MATERIALS) {
    const { baseline, dice } = await measure(newPage, base, shot, mat);
    const m = await analysis.evaluate(analyse, {
      base: `data:image/png;base64,${baseline}`,
      dice: `data:image/png;base64,${dice}`,
      threshold: 120,
    });
    results.push({ mat, m });
    if (!m.n || m.n < 1500) {
      fail(`dice glare: ${mat.id} - die not found (${m.n} changed pixels)`);
      continue;
    }
    console.log(
      `  glare ${mat.id}: px ${m.n} meanRGB ${m.meanRGB} medianRGB ${m.medianRGB} ` +
        `meanLum ${m.meanLum.toFixed(1)} stddev ${m.stddev.toFixed(1)} spread ${m.spread.toFixed(1)} ` +
        `nearWhite ${m.nearWhitePct.toFixed(2)}%`,
    );
    const problems = [];
    if (m.stddev < 8) problems.push(`flat shading (stddev ${m.stddev.toFixed(1)} < 8)`);
    if (m.spread < 60) problems.push(`pips not distinct (spread ${m.spread.toFixed(1)} < 60)`);
    if (mat.id === 'casino-red') {
      const [r, g, b] = m.medianRGB;
      if (!(r > g + 45 && r > b + 45)) problems.push(`lost crimson chroma (median ${r},${g},${b})`);
      if (m.meanLum >= 225) problems.push(`blown out (mean luminance ${m.meanLum.toFixed(1)})`);
    }
    if (problems.length) fail(`dice glare: ${mat.id} - ${problems.join('; ')}`);
    else ok(`dice glare: ${mat.id} top face reads cleanly`);
  }
  const good = results.filter((r) => r.m.crop);
  if (good.length) {
    await analysis.setViewportSize({ width: 820, height: 640 });
    await analysis.setContent(
      `<body style="margin:0;background:#111;color:#eee;font:600 18px sans-serif">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px">
      ${good
        .map(
          ({ mat, m }) =>
            `<figure style="margin:0;background:#222;height:290px;display:flex;flex-direction:column">
            <figcaption style="padding:8px 12px">${mat.label}</figcaption>
            <img src="${m.crop}" style="flex:1;min-height:0;object-fit:contain"></figure>`,
        )
        .join('')}</div></body>`,
    );
    await analysis.waitForFunction(() => [...document.images].every((i) => i.complete));
    await shot(analysis, '01-dice-4-materials-glare-check');
  }
  await analysis.close();
}
