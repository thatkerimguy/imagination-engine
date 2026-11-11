import type { Locator, Page } from '@playwright/test';

/** A real finger drag across `area` (through CDP, so the browser makes the pointer events). */
export async function swipe(page: Page, area: Locator, direction: 'left' | 'right'): Promise<void> {
  const box = await area.boundingBox();
  if (!box) throw new Error('nothing to swipe on');
  const y = box.y + box.height / 2;
  const from = direction === 'right' ? box.x + box.width * 0.2 : box.x + box.width * 0.8;
  const to = direction === 'right' ? box.x + box.width * 0.8 : box.x + box.width * 0.2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  await touch('touchStart', from);
  for (let i = 1; i <= 8; i++) await touch('touchMove', from + ((to - from) * i) / 8);
  await touch('touchEnd', to);
  await cdp.detach();
}
