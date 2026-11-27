// Legacy sandbox mode (`?module=`): the 3 temporary v1 arms (dice, lighter, ambient bed).
import { qualityTiers, type QualityTier } from '@kn/core/renderer';
import { h } from '../dom.ts';
import { createAudioBus } from '../runtime/audio-bus.ts';
import { ModuleHost } from '../runtime/module-host.ts';
import {
  LEGACY_MODULE_IDS,
  loadModuleEntry,
  type AnyProps,
  type ModuleEntry,
} from '../engine-loader.ts';
import { createStage } from '../runtime/stage.ts';
import { renderForm } from './form.ts';
import { SAMPLE_AFTER, SAMPLE_BEFORE } from './sample-prose.ts';
import { runStress, statsLine } from './stress.ts';

const audio = createAudioBus();
const stage = createStage();
const ids: string[] = [...LEGACY_MODULE_IDS];
const params = new URLSearchParams(location.search);

let moduleId = ids.includes(params.get('module') ?? '') ? params.get('module')! : (ids[0] ?? '');
let tier: QualityTier = qualityTiers.includes(params.get('tier') as QualityTier)
  ? (params.get('tier') as QualityTier)
  : 'high';
let entry: ModuleEntry | null = null;
let props: AnyProps = {};
let host: ModuleHost | null = null;

const slot = h('div', { class: 'kn-block kn-module is-in', 'data-block': 'sandbox' });
const select = h(
  'select',
  { 'aria-label': 'Module' },
  ...ids.map((id) => h('option', { value: id, selected: id === moduleId }, id)),
);
const tiers = h('div', { class: 'kn-chips', role: 'radiogroup', 'aria-label': 'Quality tier' });
const controls = h('div', { class: 'sb-controls' });
const card = h('div', { class: 'sb-card' });
const stats = h('p', { class: 'sb-stats', 'aria-live': 'polite' });
const trigger = h('button', { type: 'button', class: 'sb-trigger' }, 'Trigger Beat');
const stress = h('button', { type: 'button', class: 'sb-stress' }, '×20');

document.body.append(
  h(
    'header',
    { class: 'sb-head' },
    h('h1', {}, 'Gimmick Sandbox'),
    h('a', { class: 'sb-mode', href: '?blueprint=system-notification' }, 'v2 gimmicks →'),
    h('label', { class: 'sb-pick' }, h('span', {}, 'Module'), select),
    tiers,
  ),
  h(
    'main',
    { class: 'kn-main' },
    h(
      'article',
      { class: 'kn-chapter' },
      ...SAMPLE_BEFORE.map((t) => h('p', { class: 'kn-block kn-prose is-in' }, t)),
      slot,
      ...SAMPLE_AFTER.map((t) => h('p', { class: 'kn-block kn-prose is-in' }, t)),
    ),
    h('details', { class: 'sb-panel', open: true }, h('summary', {}, 'Controls'), card, controls),
  ),
  h('footer', { class: 'sb-dock' }, trigger, stress, stats),
);

function syncUrl(): void {
  history.replaceState(null, '', `?module=${moduleId}&tier=${tier}`);
  document.documentElement.dataset.tier = tier;
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
          onClick: () => ((tier = t), syncUrl(), renderTiers(), remount()),
        },
        t[0]!.toUpperCase() + t.slice(1),
      ),
    ),
  );
}

function validProps(): AnyProps | null {
  if (!entry) return null;
  const r = entry.schema.validate(props);
  return r.ok ? r.props : null;
}

function renderControls(): void {
  if (!entry) return;
  const r = entry.schema.validate(props);
  const summary = r.ok ? entry.formatCardSummary(r.props) : null;
  card.replaceChildren(
    summary
      ? h(
          'div',
          { class: 'sb-pill' },
          h('strong', {}, summary.title),
          h('span', {}, summary.subtitle),
          summary.badge ? h('em', {}, summary.badge) : null,
        )
      : h('ul', { class: 'sb-errors' }, ...(r.ok ? [] : r.errors).map((e) => h('li', {}, e))),
  );
  trigger.disabled = !r.ok;
  controls.replaceChildren(
    renderForm(entry.schema.fields, props, (key, value) => {
      props = { ...props, [key]: value };
      renderControls();
      remount();
    }),
  );
}

function newHost(): ModuleHost | null {
  const valid = validProps();
  if (!entry || !valid) return null;
  return new ModuleHost(
    { moduleId, moduleVersion: entry.schema.meta.version, props: valid },
    slot,
    tier,
    {
      stage,
      audio,
      resolveAsset: (p) => new URL(`../novels/vertical-slice/${p}`, location.href).href,
    },
  );
}

function remount(): void {
  host?.dispose();
  host = newHost();
  void host?.mount();
}

async function selectModule(id: string): Promise<void> {
  host?.dispose();
  host = null;
  audio.stopAmbient(0.5);
  moduleId = id;
  entry = await loadModuleEntry(id);
  props = entry ? structuredClone(entry.schema.defaults) : {};
  syncUrl();
  renderControls();
  remount();
}

const unlock = (): void => {
  if (!audio.unlocked) audio.unlock(true);
};

trigger.addEventListener('click', () => {
  unlock();
  remount();
  void host?.trigger();
});

stress.addEventListener('click', () => {
  unlock();
  host?.dispose();
  host = null;
  stress.disabled = trigger.disabled = true;
  verdict = '';
  void runStress(20, newHost, stage, (line) => (stats.textContent = verdict = line)).finally(() => {
    stress.disabled = false;
    trigger.disabled = !validProps();
  });
});

select.addEventListener('change', () => {
  verdict = '';
  void selectModule(select.value);
});
// The last ×20 verdict stays pinned above the live telemetry until the next run.
let verdict = '';
setInterval(() => {
  if (stress.disabled) return;
  const live = `now: ${statsLine(stage.stats())}`;
  stats.textContent = verdict ? `${verdict}\n${live}` : live;
}, 1000);
renderTiers();
void selectModule(moduleId);
