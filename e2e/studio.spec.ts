import { expect, test } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

test.describe('Studio', () => {
  test('opens on the Write workspace', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('view-write')).toBeVisible();
    // A first visit makes a new novel with one empty passage, ready to write in.
    await expect(page.getByTestId('passage-list')).toContainText('Beginning');
    await expect(page.getByTestId('line-text')).toHaveCount(1);
    await expect(page).toHaveTitle('Write · Studio');
    expect(errors).toEqual([]);
  });

  test('command palette finds commands in Turkish', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard shortcut; the phone opens the palette from the top bar.');
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    // Shortcuts are listened for once the Studio has rendered, which is after the load event.
    await expect(page.getByTestId('line-text')).toHaveCount(1);
    await page.keyboard.press('Control+K');
    const palette = page.getByTestId('palette');
    await expect(palette).toBeVisible();

    await page.keyboard.type('türkçe');
    await page.keyboard.press('Enter');
    await expect(palette).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr-TR');

    await page.getByTestId('palette-button').click();
    await page.keyboard.type('akis');
    await expect(palette.getByRole('option')).toHaveText(['Akış görünümüne git']);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('view-flow')).toBeVisible();
    await expect(page.getByTestId('flow-node')).toHaveText(/Başlangıç|Beginning/);
    expect(errors).toEqual([]);
  });

  test('desktop rail switches workspaces', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The rail is hidden on phones.');
    await page.goto(STUDIO);
    await expect(page.locator('.tabbar')).toBeHidden();
    await page.getByTestId('rail-settings').click();
    await expect(page.getByTestId('view-settings')).toBeVisible();
    await expect(page.getByTestId('rail-settings')).toHaveAttribute('aria-current', 'page');
  });

  test('phone tab bar and More sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'The tab bar only shows on phones.');
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.locator('.rail')).toBeHidden();
    await page.getByTestId('tab-flow').tap();
    await expect(page.getByTestId('view-flow')).toBeVisible();

    await page.getByTestId('tab-more').tap();
    const sheet = page.getByTestId('more-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Diagnostics' }).tap();
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('view-diagnostics').locator('.ie-report')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('tab-more')).toHaveAttribute('aria-current', 'page');
    expect(errors).toEqual([]);
  });
});
