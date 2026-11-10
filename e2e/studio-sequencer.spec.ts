import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';
const NOTE_KIND = 'New notes';

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

/** Taps an empty lane at a fraction of its width, where a tap adds a clip or note. */
async function tapLane(page: Page, kind: string, fraction: number): Promise<void> {
  const lane = page.locator(`[data-testid="seq-lane"][data-track="${kind}"]`);
  await lane.scrollIntoViewIfNeeded();
  const box = await lane.boundingBox();
  if (!box) throw new Error(`no ${kind} lane`);
  await lane.click({ position: { x: box.width * fraction, y: box.height / 2 } });
}

test.describe('Studio sequencer', () => {
  test('makes a scene on the timeline and plays it', async ({ page, isMobile }, info) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);

    await openView(page, isMobile, 'sequencer', 'Sequences');
    await expect(page.getByTestId('seq-empty')).toBeVisible();
    await page.getByTestId('seq-new-scene').click();
    await expect(page.getByTestId('seq-bench')).toBeVisible();
    await expect(page.getByTestId('seq-lane')).toHaveCount(3);

    // A tap on the stage lane adds an effect; a tap on the text lane adds a title.
    await tapLane(page, 'stage', 0.05);
    await expect(page.getByTestId('seq-clip')).toHaveCount(1);
    await expect(page.getByTestId('seq-inspector')).toBeVisible();
    await page.getByTestId('seq-clip-kind').selectOption('background');
    await tapLane(page, 'text', 0.3);
    await expect(page.getByTestId('seq-clip')).toHaveCount(2);
    await expect(page.getByTestId('seq-length')).toBeVisible();

    // The inspector moves the selected clip, snapped beats counted from 1.
    await page.getByTestId('seq-at').fill('3');
    await expect(page.getByTestId('seq-at')).toHaveValue('3');
    await page.getByTestId('seq-duplicate').click();
    await expect(page.getByTestId('seq-clip')).toHaveCount(3);
    await page.getByTestId('seq-remove').click();
    await expect(page.getByTestId('seq-clip')).toHaveCount(2);

    // A notes track can be added; a scene may hold strikes.
    await page.getByTestId('seq-add-track').selectOption('notes');
    await expect(page.getByTestId('seq-lane')).toHaveCount(4);
    await expect(
      page.getByRole('group', { name: NOTE_KIND }).getByRole('button', { name: 'Strike' }),
    ).toHaveCount(1);
    await tapLane(page, 'notes', 0.5);
    await expect(page.getByTestId('seq-note')).toHaveCount(1);

    // Play runs on a silent clock (no song): the playhead moves, then pause.
    const position = page.getByTestId('seq-position');
    const before = await position.textContent();
    await page.getByTestId('seq-play').click();
    await expect(page.getByTestId('seq-play')).toHaveAttribute('aria-pressed', 'true');
    await expect(position).not.toHaveText(before ?? '');
    await page.getByTestId('seq-play').click();
    await expect(page.getByTestId('seq-play')).toHaveAttribute('aria-pressed', 'false');

    await page.screenshot({ path: info.outputPath('sequencer.png'), fullPage: true });
    // Nothing on the page scrolls sideways; only the timeline does.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('a Sequence block makes a scene and opens it on the timeline', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);

    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-sequence').click();
    const block = page.getByTestId('block-sequence');
    await expect(block).toBeVisible();
    await block.getByTestId('sequence-block-pick').selectOption('__new__');
    await expect(block.getByTestId('sequence-block-pick')).toHaveValue(/^sq/);
    await expect(block.getByTestId('sequence-block-wait')).toBeChecked();
    await block.getByTestId('sequence-block-edit').click();
    await expect(page.getByTestId('view-sequencer')).toBeVisible();
    await expect(page.getByTestId('seq-bench')).toBeVisible();
    await expect(page.getByTestId('seq-pick')).toHaveValue(/^sq/);
    expect(errors).toEqual([]);
  });

  test('an enemy move is authored on the timeline', async ({ page, isMobile }) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);

    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-fight').click();
    await page.getByTestId('block-fight').getByTestId('fight-enemy').selectOption('__new__');

    await openView(page, isMobile, 'data', 'Data');
    await page.getByRole('button', { name: 'Enemies' }).click();
    const move = page.getByTestId('enemy-move').first();
    await move.getByTestId('move-rhythm').selectOption('__newTimeline__');
    await expect(move.getByTestId('move-rhythm')).toHaveValue(/^seq:/);
    await move.getByTestId('move-edit-timeline').click();

    await expect(page.getByTestId('view-sequencer')).toBeVisible();
    await expect(page.locator('[data-testid="seq-lane"][data-track="notes"]')).toHaveCount(1);
    // A move is the enemy's turn: parries and dodges only.
    await expect(
      page.getByRole('group', { name: NOTE_KIND }).getByRole('button', { name: 'Strike' }),
    ).toHaveCount(0);
    await tapLane(page, 'notes', 0.25);
    await expect(page.getByTestId('seq-note')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});
