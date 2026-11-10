import { expect, test } from '@playwright/test';
import { watchErrors } from './console.ts';
import { PLAYER, playToCrossroads, tapUntil } from './player-helpers.ts';

// Milestone B: a conversation, a choice, a fight to the music, then a branch on the result.
test.describe('Player fights', () => {
  test('plays a fight that plays itself and branches on the win', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await page.addInitScript(() => localStorage.setItem('ie.player.fightAssist', 'auto'));
    await page.goto(PLAYER);
    await playToCrossroads(page);
    await page.getByTestId('choice').filter({ hasText: 'Draw your blade' }).click();
    const duel = page.getByTestId('choice').filter({ hasText: 'Meet them blow for blow' });
    await tapUntil(page, duel);
    await duel.click();

    const fight = page.getByTestId('fight');
    await tapUntil(page, fight);
    await expect(fight).toContainText('The stranger');
    // The count-in, then the first turn.
    await expect(page.getByTestId('fight-cue')).toHaveText(/Defend|Strike/, { timeout: 15_000 });

    const result = page.getByTestId('fight-result');
    await expect(result).toBeVisible({ timeout: 60_000 });
    await expect(result).toContainText('Victory');
    await expect(result).toContainText('Score 100');
    await page.getByTestId('fight-continue').click();
    await expect(fight).toHaveCount(0);

    const story = page.getByTestId('story');
    await expect(story).toContainText('You beat The stranger · score 100');
    await tapUntil(page, page.getByTestId('story-end'));
    await expect(story).toContainText('Your score: 100.');
    await expect(page.getByTestId('story-end')).toContainText('In time with the rain');
    expect(errors).toEqual([]);
  });
});
