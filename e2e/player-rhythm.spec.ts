import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { watchErrors } from './console.ts';
import { SHELF, tapUntil } from './player-helpers.ts';

/** A short chart with no song (a click track plays the beat): four circles and a slider. */
const BEATMAP = {
  id: 'bm_steps',
  name: { en: 'Lantern Steps', tr: 'Fener Adımları' },
  difficulty: { size: 4, approach: 6, accuracy: 5, drain: 4 },
  timing: [{ t: 1000, bpm: 120 }],
  objects: [
    { id: 'n1', kind: 'circle', t: 1000, x: 0.5, y: 0.375, combo: true },
    { id: 'n2', kind: 'circle', t: 1500, x: 0.7, y: 0.375 },
    { id: 'n3', kind: 'circle', t: 2000, x: 0.7, y: 0.55 },
    {
      id: 'n4',
      kind: 'slider',
      t: 2500,
      x: 0.3,
      y: 0.55,
      curve: 'line',
      path: [{ x: 0.3, y: 0.2 }],
      slides: 1,
      end: 3000,
    },
    { id: 'n5', kind: 'circle', t: 3500, x: 0.5, y: 0.2 },
  ],
};

const line = (id: string, en: string, tr: string) => ({ id, type: 'narration', text: { id, en, tr } });

interface StoryFile {
  id: string;
  title: { en: string; tr: string };
  beatmaps?: unknown[];
  chapters: { passages: { blocks: unknown[] }[] }[];
}

/** The sample story with a Rhythm block first, added to the shelf and opened at that block. */
async function openRhythmStory(page: Page, isMobile: boolean, info: TestInfo) {
  const story = JSON.parse(
    await readFile(new URL('../packages/samples/src/rain-alley.story.json', import.meta.url), 'utf8'),
  ) as StoryFile;
  story.id = 'rhythm_alley';
  story.title = { en: 'Rhythm Alley', tr: 'Ritim Sokağı' };
  story.beatmaps = [BEATMAP];
  story.chapters[0]?.passages[0]?.blocks.unshift({
    id: 'rh1',
    type: 'rhythm',
    beatmap: BEATMAP.id,
    pass: 80,
    win: [line('rh_won', 'The lanterns sway with you.', 'Fenerler seninle sallanıyor.')],
    lose: [line('rh_lost', 'You lose the beat.', 'Ritmi kaçırıyorsun.')],
  });
  const path = info.outputPath('rhythm.story.json');
  await writeFile(path, JSON.stringify(story));

  await page.goto(SHELF);
  await page.getByTestId('shelf-add-file').setInputFiles(path);
  await expect(page.getByTestId('shelf-status')).toHaveText('Added "Rhythm Alley" to the shelf.');
  const book = page.locator('[data-testid="book"][data-id="rhythm_alley"]');
  await expect(book).toHaveAttribute('data-active', 'true');
  if (isMobile) await book.getByTestId('book-cover').dispatchEvent('click');
  else await book.getByTestId('book-cover').click();

  const start = page.getByTestId('beatmap-start');
  await tapUntil(page, start);
  await expect(start).toContainText('Lantern Steps');
  await expect(start).toContainText('No song');
  return start;
}

// A Rhythm block read in the Player feeds its result back into the story (ADR 0033).
test.describe('Player rhythm', () => {
  test('the help setting plays a Rhythm block and the story goes on from the result', async ({
    page,
    isMobile,
  }, info) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    // The reader's 'auto' help setting turns Watch on, and then it settles the block.
    await page.addInitScript(() => localStorage.setItem('ie.player.fightAssist', 'auto'));
    const start = await openRhythmStory(page, isMobile, info);
    const watch = start.locator('[data-mod="auto"]');
    await expect(watch).toHaveAttribute('aria-pressed', 'true');
    await expect(watch).toBeDisabled();
    // The card's main action has the focus, so Enter starts.
    await expect(start.getByTestId('beatmap-go')).toBeFocused();
    await start.getByTestId('beatmap-go').click();
    await expect(page.getByTestId('beatmap')).toHaveAttribute('data-phase', 'playing');

    const result = page.getByTestId('beatmap-result');
    await expect(result).toBeVisible({ timeout: 20_000 });
    await expect(result).toHaveAttribute('data-won', 'true');
    await expect(result.getByTestId('beatmap-rank')).toHaveText('S+');
    await expect(result.getByTestId('beatmap-done')).toBeFocused();
    await result.getByTestId('beatmap-done').click();
    await expect(page.getByTestId('beatmap')).toHaveCount(0);

    const text = page.getByTestId('story');
    await expect(text).toContainText('Lantern Steps: cleared · accuracy 100%');
    await tapUntil(page, text.locator('.ie-sr-only', { hasText: 'The lanterns sway with you.' }));
    expect(errors).toEqual([]);
  });

  test('Watch picked on the start card shows the chart but settles nothing', async ({
    page,
    isMobile,
  }, info) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    const start = await openRhythmStory(page, isMobile, info);
    await start.locator('[data-mod="auto"]').click();
    await expect(start.locator('[data-mod="auto"]')).toHaveAttribute('aria-pressed', 'true');
    await start.getByTestId('beatmap-go').click();

    const result = page.getByTestId('beatmap-result');
    await expect(result).toBeVisible({ timeout: 20_000 });
    await expect(result).toHaveAttribute('data-won', 'false');
    await expect(result).toContainText('Watched');
    await expect(result.getByTestId('beatmap-done')).toHaveCount(0);
    // Playing it yourself turns Watch off and starts again; Watch isn't remembered either.
    await result.getByTestId('beatmap-play-yourself').click();
    await expect(page.getByTestId('beatmap')).toHaveAttribute('data-phase', 'playing');
    const stored = await page.evaluate(() => localStorage.getItem('ie.player.rhythm'));
    expect(stored).not.toContain('auto');
    expect(errors).toEqual([]);
  });
});
