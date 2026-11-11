import { expect, test } from '@playwright/test';
import { watchErrors } from './console.ts';
import { SHELF, tapUntil } from './player-helpers.ts';
import { swipe } from './touch.ts';

const line = (id: string, en: string, tr: string) => ({
  id: `b_${id}`,
  type: 'narration',
  text: { id: `l_${id}`, en, tr },
});

/** Two rooms joined east–west, and a map to the left of the story (ADR 0031). */
const HOUSE = {
  format: 'imagination.story',
  schemaVersion: 1,
  id: 'house',
  title: { en: 'The House', tr: 'Ev' },
  author: 'Tests',
  languages: ['en', 'tr'],
  start: 'p_hall',
  layout: 'page',
  variables: [],
  characters: [],
  chapters: [
    {
      id: 'ch_house',
      title: { en: 'House', tr: 'Ev' },
      passages: [
        {
          id: 'p_hall',
          name: 'Hall',
          blocks: [line('hall', 'A cold hall.', 'Soğuk bir hol.'), { id: 'b_hx', type: 'exits' }],
        },
        {
          id: 'p_garden',
          name: 'Garden',
          blocks: [
            line('garden', 'A wet garden.', 'Islak bir bahçe.'),
            { id: 'b_gx', type: 'exits' },
          ],
        },
      ],
    },
  ],
  world: {
    rooms: [
      {
        id: 'rm_hall',
        name: { en: 'Hall', tr: 'Hol' },
        passage: 'p_hall',
        x: 0,
        y: 0,
        exits: [{ id: 'ex_he', dir: 'e', to: 'rm_garden' }],
      },
      {
        id: 'rm_garden',
        name: { en: 'Garden', tr: 'Bahçe' },
        passage: 'p_garden',
        x: 1,
        y: 0,
        exits: [{ id: 'ex_gw', dir: 'w', to: 'rm_hall' }],
      },
    ],
  },
  spaces: [{ id: 'sp_map', name: { en: 'Map', tr: 'Harita' }, side: 'left', kind: 'map' }],
};

test.describe('Player world and spaces', () => {
  test('walks through an exit, opens the map space and travels back', async ({
    page,
    isMobile,
  }) => {
    const errors = watchErrors(page);
    await page.goto(SHELF);
    await page.getByTestId('shelf-add-file').setInputFiles({
      name: 'house.story.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(HOUSE)),
    });
    const book = page.locator('[data-testid="book"][data-id="house"]');
    await expect(book).toHaveAttribute('data-active', 'true');
    await book.getByTestId('book-cover').click();
    await expect(page.getByTestId('story')).toContainText('A cold hall.');

    const east = page.getByTestId('exit').filter({ hasText: 'East · Garden' });
    await tapUntil(page, east);
    await east.click();
    await expect(page.getByTestId('story')).toContainText('A wet garden.');
    await tapUntil(page, page.getByTestId('exit').filter({ hasText: 'West · Hall' }));

    const space = page.getByTestId('space-map');
    if (isMobile) await swipe(page, page.getByTestId('spaces'), 'right');
    else await page.getByTestId('space-edge-left').click();
    await expect(space).toHaveAttribute('aria-hidden', 'false');
    await expect(space.locator('[aria-current="location"]')).toContainText('Garden');

    if (!isMobile) {
      // Escape is the way home from a space on a keyboard.
      await page.keyboard.press('Escape');
      await expect(space).toHaveAttribute('aria-hidden', 'true');
      await page.getByTestId('space-edge-left').click();
      await expect(space).toHaveAttribute('aria-hidden', 'false');
    }
    await space.getByTestId('map-room').filter({ hasText: 'Hall' }).click();
    await expect(space).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('story')).toContainText('A cold hall.');
    expect(errors).toEqual([]);
  });
});
