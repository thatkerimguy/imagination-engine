// DIRECTIVE-04 UGC gates for smoke-publish.mjs: the non-skippable Publishing Terms of Use gate in
// the writer, and Report abuse + Calm Mode dimming on the published reader.
import { readSetting } from './lib/writer-v2.mjs';

export const MOD_TOKEN = 'smoke-moderation-token';

/** Publish now must be blocked until the author accepts the Terms; then accept them. */
export async function passTosGate(writer, { tid, check, shot, API }) {
  await tid('publish-tos-gate').waitFor({ timeout: 15000 });
  check(true, 'Publishing Terms of Use gate shown before first publish');
  const disabled = async (id) => (await tid(id).getAttribute('aria-disabled')) === 'true';
  check(await disabled('publish-now'), 'Publish now disabled before Terms are accepted');
  check(await disabled('publish-tos-accept'), 'Accept Terms disabled until the consent toggle');
  check((await writer.getByText('Skip', { exact: true }).count()) === 0, 'gate has no skip button');
  await tid('publish-now').click({ force: true });
  await writer.waitForTimeout(600);
  const index = await fetch(`${API}/novels/index.json`);
  check(
    index.status === 404 && (await tid('publish-toast').count()) === 0,
    'tapping Publish now before acceptance publishes nothing',
  );
  await tid('publish-tos-gate').scrollIntoViewIfNeeded();
  await shot(writer, '01-publish-tos-gate.png');
  await tid('publish-tos-check').click();
  await writer.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="publish-tos-accept"]')
        ?.getAttribute('aria-disabled') !== 'true',
    null,
    { timeout: 5000 },
  );
  await tid('publish-tos-accept').click();
  await tid('publish-tos-gate').waitFor({ state: 'detached', timeout: 10000 });
  check(!(await disabled('publish-now')), 'Publish now enabled after accepting the Terms');
  const stored = await readSetting(writer, 'setting/publish-tos');
  check(Boolean(stored?.includes('"tosAcceptedVersion":"2026-11"')), 'consent persisted (2026-11)');
}

/** Report abuse (lazy modal) → POST /api/reports → visible in the moderation queue. */
export async function reportAbuse(reader, { check, shot, API }) {
  check(
    (await reader.getByTestId('report-abuse').count()) === 1,
    'Report abuse present in the published chapter footer',
  );
  const lazy = [];
  reader.on('request', (r) => r.url().includes('report-modal') && lazy.push(r.url()));
  check(lazy.length === 0, 'report modal chunk not loaded up front');
  await reader.getByRole('button', { name: 'Reading settings' }).click();
  const button = reader.getByTestId('settings-report-abuse');
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  check(Boolean(box && box.height >= 44), `Report abuse button >= 44px (${box?.height ?? 0}px)`);
  await button.click();
  const modal = reader.getByTestId('report-modal');
  await modal.waitFor({ timeout: 10000 });
  check(lazy.length > 0, 'report modal chunk lazy-loaded on click');
  await reader.getByTestId('report-reason').locator('input[value="spam"]').check();
  await reader.getByTestId('report-details').fill('Smoke test report: please ignore.');
  await shot(reader, '02-reader-report-abuse-modal.png');
  const posted = reader.waitForResponse((r) => r.url() === `${API}/api/reports`);
  await reader.getByTestId('report-submit').click();
  const res = await posted;
  check(res.status() === 201, `POST /api/reports answered ${res.status()}`);
  await reader
    .getByTestId('report-status')
    .getByText(/Thanks/)
    .waitFor({ timeout: 10000 });
  check(true, 'report confirmation shown');
  const queue = await fetch(`${API}/api/moderation/reports`, {
    headers: { authorization: `Bearer ${MOD_TOKEN}` },
  }).then((r) => r.json());
  check(
    queue.reports?.some((r) => r.reason === 'spam' && r.novelSlug === 'vertical-slice'),
    'report lands in the moderation queue',
  );
  await reader.keyboard.press('Escape');
  await modal.waitFor({ state: 'detached', timeout: 5000 });
  check(true, 'Escape closes the report modal');
}

/** Calm Mode On dims the SPECTACLE / SOUND drawer sections; Off restores them. */
export async function calmModeDimming(reader, { check }) {
  const open = reader.getByRole('button', { name: 'Reading settings' });
  await open.first().click();
  const calm = reader.getByTestId('calm-mode');
  await calm.waitFor({ timeout: 5000 });
  const dimmed = () =>
    reader.evaluate(() =>
      ['settings-spectacle', 'settings-sound'].map((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        return (
          Boolean(el?.classList.contains('kn-overridden')) && el?.getAttribute('aria-disabled')
        );
      }),
    );
  await calm.click();
  check(
    (await dimmed()).every((v) => v === 'true'),
    'Calm Mode On dims SPECTACLE + SOUND (aria-disabled)',
  );
  await reader.getByTestId('calm-mode').click();
  check(
    (await dimmed()).every((v) => v === false),
    'Calm Mode Off restores full opacity',
  );
  await reader.keyboard.press('Escape');
}
