// Contact sheets for batched visual QA (Playwright shots):
//   ?sheet=batch1&theme=dark|light&tier=high&dna=noir-rain   batch 1 (7 engines, 14 blueprints)
//   ?sheet=batch2&theme=dark|light&tier=high&dna=noir-rain   batch 2 (7 engines, 14 blueprints)
//   ?sheet=dna&theme=dark                                     the SAME frame-hud + artifact-doc
//                                                             blueprints under 4 Book DNA archetypes
//   ?sheet=fixes&theme=dark|light                             OVERHAUL-03 fixes: redaction, stamp,
//                                                             chamfer, wax seal × 4 DNA on page ground
// Sets body[data-ready] once every card has mounted and its beat has landed.
// `window.__knTier(tier, calm)` dispatches a live kn:tier-change for the Calm Mode shot.
import { DNA_ARCHETYPE_NAMES, isDnaArchetypeId, type DnaArchetypeId } from '@kn/core/dna';
import { qualityTiers, type QualityTier } from '@kn/core/renderer';
import { STARTER_BLUEPRINT_LIST, STARTER_BLUEPRINTS_V2 } from '@kn/engines/blueprints';
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import { h } from '../dom.ts';
import { createAudioBus } from '../runtime/audio-bus.ts';
import { BlueprintHost } from '../runtime/blueprint-host.ts';
import { dispatchTierChange, seedTier } from '../runtime/tier-bus.ts';

declare global {
  interface Window {
    __knTier?: (tier: QualityTier, calm: boolean) => void;
  }
}

const q = new URLSearchParams(location.search);
const audio = createAudioBus();
const tier: QualityTier = qualityTiers.find((t) => t === q.get('tier')) ?? 'high';
const dnaParam = q.get('dna');
const baseDna: DnaArchetypeId = isDnaArchetypeId(dnaParam) ? dnaParam : 'noir-rain';
const light = document.documentElement.dataset.theme === 'warm';
seedTier(tier, false);
window.__knTier = (t, calm) => dispatchTierChange(t, calm);
document.body.classList.add('sb-sheet');

const css = document.createElement('style');
css.textContent = `
.sb-sheet{padding:16px}
.sb-sheet h1{font:600 18px/1.3 system-ui,sans-serif;margin:0 0 12px}
.sb-grid{display:grid;grid-template-columns:repeat(auto-fill,360px);gap:18px;align-items:start}
.sb-col{display:flex;flex-direction:column;gap:6px;width:360px}
.sb-col>h2{font:600 15px/1.3 system-ui,sans-serif;margin:4px 0}
.sb-cell{width:360px;padding:0 12px 6px;border-radius:12px;background:var(--bg);outline:1px solid color-mix(in srgb,currentColor 12%,transparent)}
.sb-cell>p{font:500 11px/1.4 ui-monospace,monospace;opacity:.75;margin:8px 0 0}
.sb-cell .kn-module{margin:0}
.sb-fixes .sb-cell{background:var(--dna-page-bg,var(--bg))}`;
document.head.append(css);

const cell = (bp: GimmickBlueprint, dna: DnaArchetypeId, hosts: BlueprintHost[]): HTMLElement => {
  const slot = h('div', { class: 'kn-block kn-module is-in', 'data-sheet-slot': bp.id });
  const root = h('div', { class: 'sb-cell kn-main' }, h('p', {}, `${bp.engine} · ${bp.id}`), slot);
  hosts.push(
    new BlueprintHost(
      { moduleId: 'kn-blueprint', moduleVersion: bp.version, props: { blueprintId: bp.id } },
      slot,
      tier,
      { audio, resolveAsset: (p) => p, dnaRoot: root, visualDna: dna },
    ),
  );
  return root;
};

const hosts: BlueprintHost[] = [];
const mode = q.get('sheet');
const BATCH_2 = new Set([
  'margin-note',
  'spatial-layout',
  'screen-fx',
  'particle-field',
  'audio-bed',
  'audio-stinger',
  'bespoke-3d',
]);
const all = STARTER_BLUEPRINT_LIST.filter((b) => (mode === 'batch2') === BATCH_2.has(b.engine));
const grid = h('div', { class: 'sb-grid' });

if (mode === 'dna' || mode === 'fixes') {
  const ids =
    mode === 'dna'
      ? ['system-notification', 'police-dossier']
      : ['police-dossier', 'redacted-file', 'wax-seal-letter', 'system-notification'];
  const pair = ids.map((id) => STARTER_BLUEPRINTS_V2.get(id)!);
  if (mode === 'fixes') document.body.classList.add('sb-fixes');
  const books: DnaArchetypeId[] = [
    'noir-rain',
    'holographic-system',
    'antique-parchment',
    'classified-dossier',
  ];
  for (const dna of books) {
    grid.append(
      h(
        'div',
        { class: 'sb-col' },
        h('h2', {}, DNA_ARCHETYPE_NAMES[dna]),
        ...pair.map((bp) => cell(bp, dna, hosts)),
      ),
    );
  }
  document.body.append(
    h(
      'h1',
      {},
      `${mode === 'dna' ? 'Same blueprints' : 'OVERHAUL-03 fixes'} · 4 Book Visual DNA · ${light ? 'light · Soft Page Harmony' : 'dark'}`,
    ),
    grid,
  );
} else {
  for (const bp of all) grid.append(cell(bp, baseDna, hosts));
  document.body.append(
    h(
      'h1',
      {},
      `Batch ${mode === 'batch2' ? 2 : 1} · 7 engines · ${all.length} blueprints · ${DNA_ARCHETYPE_NAMES[baseDna]} · ${light ? 'light' : 'dark'} · ${tier}`,
    ),
    grid,
  );
}

void (async () => {
  await Promise.all(hosts.map((host) => host.mount()));
  // Land every beat (interactive engines resolve after their short attention cue).
  await Promise.race([
    Promise.all(hosts.map((host) => host.trigger())),
    new Promise((r) => setTimeout(r, 9000)),
  ]);
  document.body.dataset.ready = '1';
})();
