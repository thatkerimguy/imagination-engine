// v2 sandbox mode (`?blueprint=<id>&tier=&dna=&theme=`): one starter blueprint with controls
// generated from its `fields`, a live tier switch (kn:tier-change, no remount), Calm Mode,
// 6 Visual DNA archetypes, light/dark, Trigger Beat and the ×20 leak run.
import {
  DNA_ARCHETYPE_IDS,
  DNA_ARCHETYPE_NAMES,
  isDnaArchetypeId,
  type DnaArchetypeId,
} from '@kn/core/dna';
import { resolveBlueprintProps, type BlueprintProps } from '@kn/core/gimmicks';
import { qualityTiers, type QualityTier } from '@kn/core/renderer';
import { STARTER_BLUEPRINTS_V2 } from '@kn/engines/blueprints';
import { h } from '../dom.ts';
import { createAudioBus } from '../runtime/audio-bus.ts';
import { BlueprintHost } from '../runtime/blueprint-host.ts';
import { dispatchTierChange, seedTier } from '../runtime/tier-bus.ts';
import { renderBlueprintForm } from './blueprint-form.ts';
import { SAMPLE_AFTER, SAMPLE_BEFORE } from './sample-prose.ts';
import { runStress, statsLine } from './stress.ts';

const audio = createAudioBus();
const q = new URLSearchParams(location.search);
const all = [...STARTER_BLUEPRINTS_V2.values()];
let bp = STARTER_BLUEPRINTS_V2.get(q.get('blueprint') ?? '') ?? all[0]!;
let tier: QualityTier = qualityTiers.find((t) => t === q.get('tier')) ?? 'high';
let dna: DnaArchetypeId = isDnaArchetypeId(q.get('dna'))
  ? (q.get('dna') as DnaArchetypeId)
  : 'noir-rain';
let calm = false;
let props: BlueprintProps = structuredClone(bp.defaultProps);
let host: BlueprintHost | null = null;

const slot = h('div', { class: 'kn-block kn-module is-in', 'data-block': 'sandbox' });
const main = h('main', { class: 'kn-main' });
const pick = h(
  'select',
  { 'aria-label': 'Blueprint' },
  ...[...new Set(all.map((b) => b.engine))].map((engine) => {
    const group = h('optgroup', { label: engine });
    for (const b of all.filter((x) => x.engine === engine))
      group.append(h('option', { value: b.id, selected: b.id === bp.id }, b.name));
    return group;
  }),
);
const dnaPick = h(
  'select',
  { 'aria-label': 'Visual DNA' },
  ...DNA_ARCHETYPE_IDS.map((id) =>
    h('option', { value: id, selected: id === dna }, DNA_ARCHETYPE_NAMES[id]),
  ),
);
const tiers = h('div', { class: 'kn-chips', role: 'radiogroup', 'aria-label': 'Quality tier' });
const calmBtn = h(
  'button',
  { type: 'button', class: 'kn-chip sb-calm', 'aria-pressed': 'false' },
  'Calm',
);
const controls = h('div', { class: 'sb-controls' });
const stats = h('p', { class: 'sb-stats', 'aria-live': 'polite' });
const trigger = h('button', { type: 'button', class: 'sb-trigger' }, 'Trigger Beat');
const stress = h('button', { type: 'button', class: 'sb-stress' }, '×20');

main.append(
  h(
    'article',
    { class: 'kn-chapter' },
    ...SAMPLE_BEFORE.map((t) => h('p', { class: 'kn-block kn-prose is-in' }, t)),
    slot,
    ...SAMPLE_AFTER.map((t) => h('p', { class: 'kn-block kn-prose is-in' }, t)),
  ),
  h('details', { class: 'sb-panel', open: true }, h('summary', {}, 'Controls'), controls),
);
document.body.append(
  h(
    'header',
    { class: 'sb-head' },
    h('h1', {}, 'Gimmick Sandbox v2'),
    h('label', { class: 'sb-pick' }, h('span', {}, 'Blueprint'), pick),
    h('label', { class: 'sb-pick' }, h('span', {}, 'Book DNA'), dnaPick),
    tiers,
    calmBtn,
    h('a', { class: 'sb-mode', href: '?module=bl-dice-3d' }, 'v1 arms →'),
  ),
  main,
  h('footer', { class: 'sb-dock' }, trigger, stress, stats),
);

function syncUrl(): void {
  const theme = document.documentElement.dataset.theme === 'warm' ? 'light' : 'dark';
  history.replaceState(null, '', `?blueprint=${bp.id}&tier=${tier}&dna=${dna}&theme=${theme}`);
}

function renderTiers(): void {
  tiers.replaceChildren(
    ...qualityTiers.map((t) =>
      h(
        'button',
        {
          type: 'button',
          class: 'kn-chip',
          role: 'radio',
          'aria-checked': String(t === tier),
          // Live: the mounted engine switches in place via kn:tier-change (no remount).
          onClick: () => ((tier = t), syncUrl(), renderTiers(), dispatchTierChange(tier, calm)),
        },
        t[0]!.toUpperCase() + t.slice(1),
      ),
    ),
  );
}

function newHost(): BlueprintHost | null {
  const r = resolveBlueprintProps(bp, props);
  if (!r.ok) return null;
  seedTier(tier, calm);
  return new BlueprintHost(
    {
      moduleId: 'kn-blueprint',
      moduleVersion: bp.version,
      props: { blueprintId: bp.id, ...r.props },
    },
    slot,
    tier,
    { audio, resolveAsset: (p) => p, dnaRoot: main, visualDna: dna },
  );
}

function remount(): void {
  host?.dispose();
  host = newHost();
  void host?.mount();
}

function renderControls(): void {
  const r = resolveBlueprintProps(bp, props);
  trigger.disabled = !r.ok;
  controls.replaceChildren(
    r.ok
      ? h('p', { class: 'sb-pill' }, h('strong', {}, bp.name), h('span', {}, bp.tagline))
      : h('ul', { class: 'sb-errors' }, ...r.errors.map((e) => h('li', {}, e))),
    renderBlueprintForm(bp.fields, props, (key, value) => {
      props = { ...props, [key]: value };
      renderControls();
      remount();
    }),
  );
}

const unlock = (): void => {
  if (!audio.unlocked) audio.unlock(true);
};
pick.addEventListener('change', () => {
  bp = STARTER_BLUEPRINTS_V2.get(pick.value) ?? bp;
  props = structuredClone(bp.defaultProps);
  syncUrl();
  renderControls();
  remount();
});
dnaPick.addEventListener('change', () => {
  dna = isDnaArchetypeId(dnaPick.value) ? dnaPick.value : dna;
  syncUrl();
  remount();
});
calmBtn.addEventListener('click', () => {
  calm = !calm;
  calmBtn.setAttribute('aria-pressed', String(calm));
  dispatchTierChange(tier, calm);
});
trigger.addEventListener('click', () => {
  unlock();
  remount();
  void host?.trigger();
});
let verdict = '';
stress.addEventListener('click', () => {
  unlock();
  host?.dispose();
  host = null;
  stress.disabled = trigger.disabled = true;
  verdict = '';
  void runStress(20, newHost, (line) => (stats.textContent = verdict = line)).finally(() => {
    stress.disabled = false;
    trigger.disabled = false;
  });
});
setInterval(() => {
  if (stress.disabled) return;
  const live = `now: ${statsLine()}`;
  stats.textContent = verdict ? `${verdict}\n${live}` : live;
}, 1000);

syncUrl();
renderTiers();
renderControls();
remount();
