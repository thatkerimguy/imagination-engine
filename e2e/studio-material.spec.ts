import { expect, test, type Page } from '@playwright/test';
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

/** Material programs that a driver rejects are reported as console warnings (ADR 0020). */
function watchMaterialWarnings(page: Page): string[] {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('could not be built'))
      warnings.push(message.text());
  });
  return warnings;
}

test.describe('Studio materials', () => {
  test('builds text and post materials from nodes', async ({ page, isMobile }, info) => {
    const errors = watchErrors(page);
    const warnings = watchMaterialWarnings(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);

    await openView(page, isMobile, 'materials', 'Materials');
    await expect(page.getByTestId('mat-empty')).toBeVisible();

    // A new text material starts from a working graph and previews on the stage.
    await page.getByTestId('mat-new-text').click();
    await expect(page.getByTestId('mg-node-output')).toBeVisible();
    await expect(page.getByTestId('mat-problems')).toContainText('The graph compiles.');
    await expect(page.getByTestId('mat-preview').locator('canvas')).toHaveCount(1);

    // A post material: tap an output, then an input, to connect them.
    await page.getByTestId('mat-new-post').click();
    await expect(page.getByTestId('mat-pick')).toHaveValue(/^mt/);
    await page.getByTestId('mat-add-node').selectOption('noise');
    await expect(page.getByTestId('mg-node-noise')).toBeVisible();
    await page.getByTestId('mg-out-noise-out').click();
    await expect(page.getByTestId('mat-armed')).toBeVisible();
    await page.getByTestId('mg-in-output-alpha').click();
    await expect(page.getByTestId('mat-armed')).toHaveCount(0);
    await expect(page.getByTestId('mat-problems')).toContainText('The graph compiles.');

    // The inspector edits an unlinked input; a parameter can be added.
    await page.getByTestId('mg-node-noise').getByRole('button', { name: 'Noise', exact: true }).click();
    await expect(page.getByTestId('mat-inspector')).toBeVisible();
    await page.getByTestId('mat-input-scale').fill('3');
    await expect(page.getByTestId('mg-node-noise')).toContainText('3');
    const params = page.getByTestId('mat-param');
    const before = await params.count();
    await page.getByTestId('mat-add-param').click();
    await expect(params).toHaveCount(before + 1);

    // Removing a node drops its link; undo brings it back.
    await page.getByTestId('mat-remove-node').click();
    await expect(page.getByTestId('mg-node-noise')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('mg-node-noise')).toHaveCount(1);

    await page.screenshot({ path: info.outputPath('materials.png'), fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(warnings).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('titles use a text material and the sequencer ramps a parameter', async ({
    page,
    isMobile,
  }) => {
    const errors = watchErrors(page);
    const warnings = watchMaterialWarnings(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);

    await openView(page, isMobile, 'materials', 'Materials');
    await page.getByTestId('mat-new-text').click();
    const material = await page.getByTestId('mat-pick').inputValue();

    // A title block picks the material.
    await openView(page, isMobile, 'write', 'Write');
    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-title').click();
    const title = page.getByTestId('block-title');
    await title.getByTestId('stage-title-material').selectOption(material);
    await expect(title.getByTestId('stage-title-material')).toHaveValue(material);

    // A material track's clip starts on the first material's first parameter, ramping.
    await openView(page, isMobile, 'sequencer', 'Sequences');
    await page.getByTestId('seq-new-scene').click();
    await page.getByTestId('seq-add-track').selectOption('material');
    const lane = page.locator('[data-testid="seq-lane"][data-track="material"]');
    await lane.scrollIntoViewIfNeeded();
    const box = await lane.boundingBox();
    if (!box) throw new Error('no material lane');
    await lane.click({ position: { x: box.width * 0.1, y: box.height / 2 } });
    await expect(page.getByTestId('seq-clip')).toHaveCount(1);
    await expect(page.getByTestId('stage-param-material')).toHaveValue(material);
    await expect(page.getByTestId('stage-param-ramp')).toBeChecked();

    // It plays on a silent clock without errors.
    await page.getByTestId('seq-play').click();
    await expect(page.getByTestId('seq-play')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('seq-play').click();
    expect(warnings).toEqual([]);
    expect(errors).toEqual([]);
  });
});
