import { expect, test, type Locator, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';
import { PLAYER, playToCrossroads, tapUntil } from './player-helpers.ts';

async function openSettings(page: Page): Promise<Locator> {
  await page.getByTestId('menu-zone').click();
  await expect(page.getByTestId('menu')).toHaveAttribute('data-open', 'true');
  await page.getByTestId('menu-settings').click();
  const sheet = page.getByTestId('settings-dialog');
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe('Player', () => {
  test('plays the sample story and switches language mid-scene', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(PLAYER);
    const story = page.getByTestId('story');
    await expect(story).toContainText('Rain. The kind that gets into your bones.');
    await expect(page).toHaveTitle('The Rain Alley');

    await playToCrossroads(page);
    await expect(story).toContainText('Your call, Ayşe.');
    await expect(
      page.getByTestId('choice').filter({ hasText: 'Talk them down' }),
    ).not.toHaveAttribute('aria-disabled');
    const coins = page.getByTestId('choice').filter({ hasText: 'Offer coins' });
    await expect(coins).toHaveAttribute('aria-disabled', 'true');
    await expect(coins).toContainText('Not enough Gold');

    const sheet = await openSettings(page);
    await sheet.getByRole('button', { name: 'Türkçe' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr-TR');
    await sheet.getByRole('button', { name: 'Kapat' }).click();

    // Same scene, same choices, now in Turkish, with the suffix harmonized for the name.
    await expect(story).toContainText("Karar Ayşe'nin.");
    await expect(page.getByTestId('choice').filter({ hasText: 'Kılıcını çek' })).toBeVisible();
    await expect(page.getByTestId('choice').filter({ hasText: 'Para teklif et' })).toContainText(
      'Yeterli Altın yok',
    );
    await expect(page).toHaveTitle('Yağmurlu Sokak');
    expect(errors).toEqual([]);
  });

  test('resumes after a reload and steps back', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(PLAYER);
    await playToCrossroads(page);
    await page.reload();
    await expect(page.getByTestId('choice').filter({ hasText: 'Draw your blade' })).toBeVisible();
    await expect(page.getByTestId('story')).toContainText('Your call, Ayşe.');

    // Back returns to the line before the choice; the choice comes again on the next tap.
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('choice')).toHaveCount(0);
    await tapUntil(page, page.getByTestId('choice').filter({ hasText: 'Draw your blade' }));
    expect(errors).toEqual([]);
  });

  test('saves to a slot and plays to an ending', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(PLAYER);
    await playToCrossroads(page);
    await page.getByTestId('menu-zone').click();
    await page.getByTestId('menu-saves').click();
    const saves = page.getByTestId('saves-dialog');
    await saves.getByTestId('save-1').click();
    await expect(saves.getByTestId('load-1')).toBeEnabled();
    await expect(saves).toContainText('Your call, Ayşe.');
    await saves.getByRole('button', { name: 'Close' }).click();

    await page.getByTestId('choice').filter({ hasText: 'Talk them down' }).click();
    await tapUntil(page, page.getByTestId('story-end'));
    await expect(page.getByTestId('story-end')).toContainText('Ending: Words, not steel');

    await page.getByTestId('menu-zone').click();
    await page.getByTestId('menu-saves').click();
    await saves.getByTestId('load-1').click();
    await expect(page.getByTestId('choice').filter({ hasText: 'Draw your blade' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('switches to Turkish from the settings sheet', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(PLAYER);
    const sheet = await openSettings(page);
    await sheet.getByRole('button', { name: 'Türkçe' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr-TR');
    await expect(sheet.getByRole('button', { name: 'Kâğıt' })).toBeVisible();
    await expect(page.getByTestId('story')).toContainText('Yağmur. İliklerine işleyen cinsten.');
    expect(errors).toEqual([]);
  });

  test('remembers the music volume', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(PLAYER);
    let sheet = await openSettings(page);
    const music = sheet.getByRole('slider', { name: 'Music' });
    await expect(music).toHaveValue('100');
    await music.fill('40');
    await page.reload();
    sheet = await openSettings(page);
    await expect(sheet.getByRole('slider', { name: 'Music' })).toHaveValue('40');
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
