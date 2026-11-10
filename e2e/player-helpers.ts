import { expect, type Locator, type Page } from '@playwright/test';

export const PLAYER = 'http://127.0.0.1:5173/';

/** Taps the empty lower part of the page, like a reader moving on. */
export async function tap(page: Page): Promise<void> {
  const size = page.viewportSize() ?? { width: 800, height: 800 };
  await page.mouse.click(size.width / 2, size.height - 60);
}

/** Taps until `target` appears (finishing each typed line on the way). */
export async function tapUntil(page: Page, target: Locator): Promise<void> {
  await expect(async () => {
    if (!(await target.isVisible())) await tap(page);
    await expect(target).toBeVisible({ timeout: 300 });
  }).toPass({ timeout: 20_000 });
}

/** Plays the prologue up to the crossroads choice, as "Ayşe". */
export async function playToCrossroads(page: Page): Promise<void> {
  await tapUntil(page, page.getByTestId('answer'));
  await page.getByTestId('answer').fill('Ayşe');
  await page.keyboard.press('Enter');
  await tapUntil(page, page.getByTestId('choice').filter({ hasText: 'She' }));
  await page.getByTestId('choice').filter({ hasText: 'She' }).click();
  await tapUntil(page, page.getByTestId('choice').filter({ hasText: 'A quick tongue' }));
  await page.getByTestId('choice').filter({ hasText: 'A quick tongue' }).click();
  await tapUntil(page, page.getByTestId('choice').filter({ hasText: 'Draw your blade' }));
}
