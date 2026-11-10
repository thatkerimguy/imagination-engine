import { expect, test } from '@playwright/test';
import { watchErrors } from './console.ts';
import { PLAYER, playToCrossroads, tapUntil } from './player-helpers.ts';

// Phase 10: a minigame launched from the story feeds its result back into it (ADR 0021).
test.describe('Player minigames', () => {
  test('solves the letter lock and the story goes on from the result', async ({
    page,
    isMobile,
  }) => {
    const errors = watchErrors(page);
    await page.goto(PLAYER);
    await playToCrossroads(page);
    await page.getByTestId('choice').filter({ hasText: 'Search the crates first' }).click();

    const game = page.getByTestId('minigame');
    await tapUntil(page, game);
    await expect(game).toHaveAttribute('data-template', 'cipher');
    await expect(game).toContainText('Letter lock');
    await expect(page.getByTestId('minigame-status')).toHaveText('Word 1 of 1');

    // A phone taps the letters; a desktop types them.
    for (const letter of ['R', 'A', 'I', 'N']) {
      if (isMobile) await game.getByRole('button', { name: letter, exact: true }).tap();
      else await page.keyboard.press(letter.toLowerCase());
    }
    const result = page.getByTestId('minigame-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Success');
    await expect(result).toContainText(/Score (9\d|100)/);
    await page.getByTestId('minigame-continue').click();
    await expect(game).toHaveCount(0);

    const story = page.getByTestId('story');
    await expect(story).toContainText(/Letter lock: success · score (9\d|100)/);
    // The won branch ran: one of the crate's finds, then back to the crossroads.
    await tapUntil(page, page.getByTestId('choice').filter({ hasText: 'Draw your blade' }));
    await expect(story).toContainText(/oil lamp|few coins|Nothing but rats/);
    expect(errors).toEqual([]);
  });

  test('a wrong word is cleared, and stepping back replays the same lock', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(PLAYER);
    await playToCrossroads(page);
    await page.getByTestId('choice').filter({ hasText: 'Search the crates first' }).click();
    const game = page.getByTestId('minigame');
    await tapUntil(page, game);
    const letters = game.locator('[data-testid^="minigame-letter-"]');
    const dealt = await letters.allTextContents();

    for (const letter of ['N', 'I', 'A', 'R'])
      await game.getByRole('button', { name: letter, exact: true }).click();
    await expect(game.getByTestId('minigame-answer')).toHaveAttribute('data-wrong', '1');
    await expect(game.getByTestId('minigame-result')).toBeHidden();

    // Stepping back through the menu takes the game down.
    await page.getByTestId('menu-zone').click();
    await page.getByTestId('menu-back').click();
    await expect(game).toHaveCount(0);
    // Back steps to the line before the game; the next tap deals the same lock again.
    await tapUntil(page, game);
    expect(await letters.allTextContents()).toEqual(dealt);
    expect(errors).toEqual([]);
  });
});
