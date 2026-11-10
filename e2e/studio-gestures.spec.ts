import { expect, test } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

// Mouse buttons and the wheel on the Studio's canvases (usePanZoom).
test.describe('Studio canvas gestures', () => {
  test.skip(({ isMobile }) => isMobile, 'Mouse buttons and the wheel are desktop input.');

  test('Ctrl+wheel zooms the Flow and a right-click plays from a passage', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);
    await page.getByTestId('rail-flow').click();
    await page.getByRole('button', { name: 'New passage' }).click();
    await expect(page.getByTestId('flow-node')).toHaveCount(2);

    const canvas = page.getByTestId('flow-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -300);
    await page.keyboard.up('Control');
    await expect(page.locator('.flow__scale')).not.toHaveText('100%');

    await page.getByTestId('flow-node').nth(1).click({ button: 'right' });
    await expect(page.getByTestId('view-play')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Ctrl+wheel zooms the timeline; a drag on an empty lane adds nothing', async ({ page }) => {
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);
    await page.getByTestId('rail-sequencer').click();
    await page.getByTestId('seq-new-scene').click();
    const content = page.locator('.tl__content');
    const before = await content.evaluate((el) => el.getBoundingClientRect().width);

    const lane = page.getByTestId('seq-lane').first();
    const box = await lane.boundingBox();
    if (!box) throw new Error('no lane');
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 120, y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -300);
    await page.keyboard.up('Control');
    await expect
      .poll(() => content.evaluate((el) => el.getBoundingClientRect().width))
      .toBeGreaterThan(before);

    await page.mouse.move(box.x + 300, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, y, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByTestId('seq-clip')).toHaveCount(0);
  });
});
