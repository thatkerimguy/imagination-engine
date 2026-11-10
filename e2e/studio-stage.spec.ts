import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

async function open(page: Page, isMobile: boolean, view: 'Stage' | 'Write') {
  await page.goto(STUDIO);
  await expect(page.getByTestId('line-text')).toHaveCount(1);
  if (view === 'Write') return;
  if (isMobile) {
    await page.getByTestId('tab-more').tap();
    await page.getByTestId('more-sheet').getByRole('button', { name: 'Stage' }).tap();
  } else {
    await page.getByTestId('rail-stage').click();
  }
  await expect(page.getByTestId('view-stage')).toBeVisible();
}

test.describe('Studio stage', () => {
  test('the playground draws a background and plays moments on the GPU', async ({
    page,
    isMobile,
  }) => {
    const errors = watchErrors(page);
    await open(page, isMobile, 'Stage');
    const panel = page.getByTestId('stage-panel');
    await expect(panel.locator('canvas.ie-stage')).toHaveCount(1);
    // Rain is on from the start, so frames are drawn and counted.
    await expect(page.getByTestId('stage-stats')).toContainText(/[1-9]\d* sprites/, {
      timeout: 5_000,
    });
    for (const moment of ['stage.shake', 'stage.flash', 'stage.burst', 'stage.title'])
      await page.getByTestId(`moment-${moment}`).first().click();
    await page.getByRole('button', { name: 'Low', exact: true }).click();
    await expect(page.getByTestId('stage-stats')).toContainText('Low', { timeout: 5_000 });
    await page.getByTestId('stage-background').selectOption('none');
    expect(errors).toEqual([]);
  });

  test('stage blocks are sentences and a title needs both languages', async ({ page, isMobile }) => {
    const errors = watchErrors(page);
    await open(page, isMobile, 'Write');

    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-effect').click();
    const effect = page.getByTestId('block-effect');
    await expect(effect).toContainText('with');
    await effect.getByTestId('stage-effect').selectOption('flash');
    await expect(effect.getByRole('combobox', { name: 'Colour' })).toHaveValue('white');

    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-title').click();
    const title = page.getByTestId('block-title');
    await title.getByTestId('stage-title-en').fill('Night falls');
    await expect(page.getByTestId('problems')).toContainText('The title has no Turkish text.');
    await title.getByTestId('stage-title-tr').fill('Gece çöküyor');
    await expect(page.getByTestId('problems')).not.toContainText('The title has no');
    expect(errors).toEqual([]);
  });
});
