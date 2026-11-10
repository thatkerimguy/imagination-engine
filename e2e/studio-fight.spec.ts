import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

async function openData(page: Page, isMobile: boolean): Promise<void> {
  if (!isMobile) {
    await page.getByTestId('rail-data').click();
  } else if (await page.getByTestId('tab-data').isVisible()) {
    await page.getByTestId('tab-data').tap();
  } else {
    await page.getByTestId('tab-more').tap();
    await page.getByTestId('more-sheet').getByRole('button', { name: 'Data' }).tap();
  }
  await expect(page.getByTestId('view-data')).toBeVisible();
}

test.describe('Studio fights', () => {
  test('a Fight block makes its enemy, which the Data view then edits', async ({
    page,
    isMobile,
  }) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);

    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-fight').click();
    const fight = page.getByTestId('block-fight');
    await expect(fight).toContainText('Fight');
    await expect(page.getByTestId('problems')).toContainText('This fight needs an enemy.');

    await fight.getByTestId('fight-enemy').selectOption('__new__');
    await expect(fight.getByTestId('fight-enemy')).toHaveValue(/^en/);
    await expect(page.getByTestId('problems')).not.toContainText('This fight needs an enemy.');
    await fight.getByTestId('fight-difficulty').selectOption('hard');
    await fight.getByTestId('fight-bars').selectOption('8');
    await expect(fight.getByTestId('fight-win')).toBeVisible();
    await expect(fight.getByTestId('fight-lose')).toBeVisible();

    await openData(page, isMobile);
    await page.getByRole('button', { name: 'Enemies' }).click();
    const enemy = page.getByTestId('enemy');
    await expect(enemy).toHaveCount(1);
    await expect(enemy.getByTestId('enemy-move')).toHaveCount(3);
    await expect(enemy).toContainText('Used in 1 ');
    await enemy.getByTestId('add-move').click();
    await expect(enemy.getByTestId('enemy-move')).toHaveCount(4);
    expect(errors).toEqual([]);
  });
});
