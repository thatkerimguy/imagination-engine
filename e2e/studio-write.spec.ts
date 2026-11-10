import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

/** Each test runs in a fresh browser profile, so the Studio starts with a new empty novel. */
async function openStudio(page: Page) {
  await page.goto(STUDIO);
  await expect(page.getByTestId('line-text')).toHaveCount(1);
}

test.describe('Studio writing', () => {
  test('writes a bilingual passage with a choice and plays it', async ({ page }) => {
    const errors = watchErrors(page);
    await openStudio(page);

    await page.getByTestId('line-text').click();
    await page.keyboard.type('The rain fell.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Nobody came.');
    await expect(page.getByTestId('block-narration')).toHaveCount(2);

    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-choice').click();
    await expect(page.getByTestId('option')).toHaveCount(2);
    await page.keyboard.type('Wait');
    await page.getByTestId('option-text').nth(1).click();
    await page.keyboard.type('Leave');

    // Switch the manuscript to Turkish and write the same lines there.
    await page.locator('.write__lang').getByRole('button', { name: 'TR' }).click();
    await expect(page.getByTestId('line-text').first()).toHaveText('');
    await page.getByTestId('line-text').first().click();
    await page.keyboard.type('Yağmur yağdı.');

    await page.getByRole('button', { name: 'Translate' }).click();
    const rows = page.getByTestId('translation-row');
    // Still missing in Turkish: the second line and both options.
    await expect(rows).toHaveCount(3);

    await page.getByRole('button', { name: 'Manuscript' }).click();
    await page.getByTestId('play-from-here').click();
    const play = page.getByTestId('view-play');
    await expect(play).toBeVisible();
    await expect(play.locator('.story')).toContainText('The rain fell.');

    // Reading in Turkish uses the Turkish text where it exists.
    await play.locator('.play__lang').getByRole('button', { name: 'TR' }).click();
    await expect(play.locator('.story')).toContainText('Yağmur yağdı.');
    expect(errors).toEqual([]);
  });

  test('undo and redo text edits', async ({ page }) => {
    await openStudio(page);
    const line = page.getByTestId('line-text');
    await line.click();
    await page.keyboard.type('A line to take back.');
    await expect(page.getByTestId('undo')).toBeEnabled();

    await page.getByTestId('undo').click();
    await expect(line).toHaveText('');
    await page.getByTestId('redo').click();
    await expect(line).toHaveText('A line to take back.');
  });

  test('keeps the novel after a reload', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('line-text').click();
    await page.keyboard.type('Saved on this device.');
    await expect(page.getByTestId('save-state')).toHaveText('Saved');
    await page.reload();
    await expect(page.getByTestId('line-text')).toHaveText('Saved on this device.');
  });

  test('flow shows a new passage and opens it in Write', async ({ page, isMobile }) => {
    await openStudio(page);
    await page.getByTestId(isMobile ? 'tab-flow' : 'rail-flow').click();
    await page.getByRole('button', { name: 'New passage' }).click();
    await expect(page.getByTestId('flow-node')).toHaveCount(2);

    await page.getByTestId('flow-node').nth(1).click();
    await page.getByTestId('flow-open').click();
    await expect(page.getByTestId('view-write')).toBeVisible();
    await expect(page.getByTestId('passage-name')).toHaveValue('Passage 2');
  });

  test('phone: the passage list is a drawer', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Desktop shows the passage list beside the manuscript.');
    await openStudio(page);
    const list = page.getByTestId('passage-list');
    await expect(list).toBeHidden();
    await page.getByTestId('passages-button').click();
    await expect(list).toBeVisible();
    await list.getByRole('button', { name: /Beginning/ }).click();
    await expect(list).toBeHidden();
  });
});
