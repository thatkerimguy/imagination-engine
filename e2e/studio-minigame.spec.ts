import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

async function openView(page: Page, isMobile: boolean, id: string, label: string): Promise<void> {
  if (!isMobile) {
    await page.getByTestId(`rail-${id}`).click();
  } else if (await page.getByTestId(`tab-${id}`).isVisible()) {
    await page.getByTestId(`tab-${id}`).tap();
  } else {
    await page.getByTestId('tab-more').tap();
    await page.getByTestId('more-sheet').getByRole('button', { name: label }).tap();
  }
  await expect(page.getByTestId(`view-${id}`)).toBeVisible();
}

/** Spells a word in a cipher, always pressing a letter not placed yet. */
async function spell(game: Locator, word: string): Promise<void> {
  for (const letter of word)
    await game
      .locator('[data-testid^="minigame-letter-"]:not([data-used="true"])', { hasText: letter })
      .first()
      .click();
}

test.describe('Studio minigames', () => {
  test('a Minigame block is set up with forms and tried out live', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);

    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-minigame').click();
    const block = page.getByTestId('block-minigame');
    await expect(block.getByTestId('mg-template')).toHaveValue('lockpick');
    await expect(block.getByTestId('mg-param-pins')).toBeVisible();
    await expect(block.getByTestId('mg-win')).toBeVisible();
    await expect(block.getByTestId('mg-lose')).toBeVisible();

    // Dice that can't reach their target are flagged; a reachable target clears the problem.
    await block.getByTestId('mg-template').selectOption('dice');
    await expect(block.getByTestId('mg-store-total')).toBeVisible();
    await block.getByTestId('mg-param-target').fill('40');
    await expect(page.getByTestId('problems')).toContainText('can hardly be lost or won');
    await block.getByTestId('mg-param-target').fill('8');
    await expect(page.getByTestId('problems')).not.toContainText('can hardly be lost or won');

    // A cipher with a word in each language, tried out right under the block.
    await block.getByTestId('mg-template').selectOption('cipher');
    await block.getByTestId('mg-word-0-en').fill('door');
    await block.getByTestId('mg-word-0-tr').fill('kapı');
    await block.getByTestId('mg-title-en').fill('Old lock');
    await block.getByTestId('mg-try').click();
    const game = block.getByTestId('mg-try-box').getByTestId('minigame');
    await expect(game).toContainText('Old lock');
    await spell(game, 'DOOR');
    await expect(game.getByTestId('minigame-result')).toContainText('Success');
    await game.getByTestId('minigame-continue').click();
    await expect(block.getByTestId('mg-try-result')).toContainText(/Success · score \d+/);

    await block.getByTestId('mg-try-close').click();
    await expect(block.getByTestId('mg-try-box')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('the Library keeps an effect, adds it back and moves it in a pack', async ({
    page,
    isMobile,
  }, info) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);
    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-effect').click();
    await expect(page.getByTestId('block-effect')).toHaveCount(1);

    await openView(page, isMobile, 'library', 'Library');
    await expect(page.getByTestId('lib-empty')).toContainText('The Library is empty');
    await expect(page.getByTestId('lib-source')).toContainText('stage.shake');
    await page.getByTestId('lib-save-name').fill('Big shake');
    await page.getByTestId('lib-save').click();
    await expect(page.getByTestId('lib-status')).toHaveText('Saved "Big shake" to the Library.');
    const items = page.getByTestId('lib-item');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveAttribute('data-kind', 'effect');

    // Adding puts a copy at the end of the passage open in Write.
    await items.first().getByTestId('lib-add').click();
    await expect(page.getByTestId('lib-status')).toContainText('at the end of the passage');

    // Export writes a pack; importing it adds its items again under new IDs.
    await page.getByTestId('lib-pack-name').fill('Shakes');
    const downloading = page.waitForEvent('download');
    await page.getByTestId('lib-export').click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('shakes.pack.json');
    const path = info.outputPath('shakes.pack.json');
    await download.saveAs(path);
    const pack = JSON.parse(await readFile(path, 'utf8')) as { format: string; items: unknown[] };
    expect(pack.format).toBe('imagination.pack');
    expect(pack.items).toHaveLength(1);

    const file = page.getByTestId('lib-import-file');
    await file.setInputFiles(path);
    await expect(page.getByTestId('lib-status')).toHaveText('Imported 1 items from "Shakes".');
    await expect(items).toHaveCount(2);

    // A file that isn't a valid pack changes nothing.
    await file.setInputFiles({
      name: 'bad.pack.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'imagination.pack', version: 1, items: [{}] })),
    });
    await expect(page.getByTestId('lib-status')).toContainText('isn’t a valid pack');
    await expect(items).toHaveCount(2);

    // Removing asks once more first.
    await items.first().getByTestId('lib-remove').click();
    await expect(items).toHaveCount(2);
    await items.first().getByTestId('lib-remove').click();
    await expect(items).toHaveCount(1);

    // The copy reached the novel: Write now has two effect blocks.
    await openView(page, isMobile, 'write', 'Write');
    await expect(page.getByTestId('block-effect')).toHaveCount(2);
    expect(errors).toEqual([]);
  });
});
