import { expect, test } from '@playwright/test';
import { watchErrors } from './console.ts';

const PLAYER = 'http://127.0.0.1:5173/';

test.describe('Player', () => {
  test('reveals the page line by line', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(PLAYER);
    const lines = page.locator('.reader__line');
    await expect(lines).toHaveCount(3);
    await expect(lines.nth(0)).toHaveAttribute('data-shown', 'true');
    await expect(lines.nth(1)).toHaveAttribute('data-shown', 'false');

    await page.getByTestId('reader').click({ position: { x: 150, y: 400 } });
    await expect(lines.nth(1)).toHaveAttribute('data-shown', 'true');
    expect(errors).toEqual([]);
  });

  test('switches to Turkish from the settings sheet', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(PLAYER);
    await page.getByTestId('menu-zone').click();
    await expect(page.getByTestId('menu')).toHaveAttribute('data-open', 'true');
    await page.getByTestId('menu-settings').click();

    const sheet = page.getByTestId('settings-dialog');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Türkçe' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr-TR');
    await expect(sheet.getByRole('button', { name: 'Kâğıt' })).toBeVisible();
    await expect(page).toHaveTitle('Hikâye yok');
    expect(errors).toEqual([]);
  });

  test('shows the device report', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${PLAYER}#diagnostics`);
    const sheet = page.getByTestId('diagnostics-dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.ie-report')).toBeVisible({ timeout: 10_000 });
    await expect(sheet.getByText('WebGL2', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
