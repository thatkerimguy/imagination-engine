import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { watchErrors } from './console.ts';
import { SHELF } from './player-helpers.ts';

// Phase 11 (ADR 0022): the bookshelf main menu, credits and the accessibility settings.
test.describe('Player bookshelf', () => {
  test('slides between novels, opens one and comes back', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(SHELF);
    await expect(page).toHaveTitle('Bookshelf');
    const books = page.getByTestId('book');
    await expect(books.first()).toHaveAttribute('data-id', 'rain_alley');
    await expect(books).toHaveCount(14); // the sample and thirteen kit starters
    await expect(books.first()).toHaveAttribute('data-active', 'true');

    await page.getByTestId('shelf-next').click();
    await expect(books.nth(1)).toHaveAttribute('data-active', 'true');
    await page.getByTestId('shelf-prev').click();
    await expect(books.first()).toHaveAttribute('data-active', 'true');

    await books.first().getByTestId('book-open').click();
    await expect(page).toHaveURL(/\?novel=rain_alley/);
    await expect(page.getByTestId('story')).toContainText('Rain. The kind');

    // Credits come from the novel's data; the menu leads back to the shelf.
    await page.getByTestId('menu-zone').click();
    await page.getByTestId('menu-credits').click();
    const credits = page.getByTestId('credits');
    await expect(credits).toContainText('Literata');
    await expect(credits).toContainText('OFL-1.1');
    await page.getByTestId('credits-dialog').getByRole('button', { name: 'Close' }).click();
    await page.getByTestId('menu-zone').click();
    await page.getByTestId('menu-shelf').click();
    await expect(page.getByTestId('shelf')).toBeVisible();
    // The sample has an autosave now, so the shelf offers to continue it.
    await expect(books.first().getByTestId('book-open')).toHaveText('Continue');
    expect(errors).toEqual([]);
  });

  test('adds a novel from a file and removes it again', async ({ page }, info) => {
    const errors = watchErrors(page);
    await page.goto(SHELF);
    const raw = JSON.parse(
      await readFile(
        new URL('../packages/samples/src/rain-alley.story.json', import.meta.url),
        'utf8',
      ),
    ) as { id: string; title: { en: string; tr: string } };
    raw.id = 'my_copy';
    raw.title = { en: 'My Copy', tr: 'Kopyam' };
    const path = info.outputPath('copy.story.json');
    await import('node:fs/promises').then((fs) => fs.writeFile(path, JSON.stringify(raw)));

    await page.getByTestId('shelf-add-file').setInputFiles(path);
    await expect(page.getByTestId('shelf-status')).toHaveText('Added "My Copy" to the shelf.');
    const copy = page.locator('[data-testid="book"][data-id="my_copy"]');
    await expect(copy).toHaveAttribute('data-active', 'true');
    await expect(copy).toContainText('Added by you');

    // Not a novel: nothing changes.
    await page.getByTestId('shelf-add-file').setInputFiles({
      name: 'bad.story.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"format":"imagination.story"}'),
    });
    await expect(page.getByTestId('shelf-status')).toContainText('isn’t a novel');

    await copy.getByTestId('book-remove').click();
    await expect(copy.getByTestId('book-remove')).toHaveText('Tap again to remove');
    await copy.getByTestId('book-remove').click();
    await expect(copy).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('accessibility settings change the page', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(SHELF);
    await page.getByTestId('shelf-settings').click();
    const sheet = page.getByTestId('settings-dialog');
    await sheet
      .getByRole('group', { name: 'Contrast' })
      .getByRole('button', { name: 'High' })
      .click();
    await sheet
      .getByRole('group', { name: 'Letters' })
      .getByRole('button', { name: 'Plain' })
      .click();
    await sheet
      .getByRole('group', { name: 'Motion' })
      .getByRole('button', { name: 'Less' })
      .click();
    await sheet
      .getByRole('group', { name: 'Line spacing' })
      .getByRole('button', { name: 'Wide' })
      .click();
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-contrast', 'high');
    await expect(html).toHaveAttribute('data-letters', 'plain');
    await expect(html).toHaveAttribute('data-motion', 'reduce');
    expect(await html.evaluate((el) => el.style.getPropertyValue('--reader-leading'))).toBe('1.3');
    // Remembered across a reload.
    await page.reload();
    await expect(html).toHaveAttribute('data-contrast', 'high');
    expect(errors).toEqual([]);
  });
});
