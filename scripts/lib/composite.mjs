// Side-by-side composite of 390×844 @2× panels, rendered in a scratch tab (QA packs).
export async function composite(page, panels, path) {
  const tab = await page.context().browser().newPage({ deviceScaleFactor: 2 });
  await tab.setViewportSize({ width: 390 * panels.length + 12 * (panels.length + 1), height: 868 });
  const imgs = panels.map((b) => `data:image/png;base64,${b.toString('base64')}`);
  await tab.setContent(
    `<body style="margin:0;padding:12px;display:flex;gap:12px;background:#0b0c10">${imgs
      .map((src) => `<img src="${src}" style="width:390px;height:844px">`)
      .join('')}</body>`,
  );
  await tab.waitForTimeout(200);
  await tab.screenshot({ path });
  await tab.close();
}
