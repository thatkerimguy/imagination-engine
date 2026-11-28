// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { AUDIO_BED_BLUEPRINTS } from './audio-bed/blueprints.ts';
import { AUDIO_STINGER_BLUEPRINTS } from './audio-stinger/blueprints.ts';
import { setup, ENGINES } from './batch-c-setup.ts';
import { SCENE_IDS } from './audio-bed/scenes.ts';
import { FOLEYS } from './audio-stinger/synth.ts';

const PICTO = /\p{Extended_Pictographic}/u;
function strings(root: Element): string[] {
  const out: string[] = [];
  for (const n of [root, ...root.querySelectorAll('*')]) {
    out.push(n.textContent ?? '');
    for (const a of Array.from(n.attributes)) out.push(a.value);
  }
  return out;
}

describe('audio pills carry no emoji (04A)', () => {
  const cases: [string, Record<string, string>][] = [
    ...AUDIO_BED_BLUEPRINTS.flatMap((b) => [
      [b.id, {}] as [string, Record<string, string>],
      ...SCENE_IDS.map((scene) => [b.id, { scene }] as [string, Record<string, string>]),
    ]),
    ...AUDIO_STINGER_BLUEPRINTS.flatMap((b) => [
      [b.id, {}] as [string, Record<string, string>],
      ...FOLEYS.map((foley) => [b.id, { foley }] as [string, Record<string, string>]),
    ]),
  ];
  it('covers both engines', () => {
    expect(ENGINES['audio-bed']).toBeDefined();
    expect(cases.length).toBeGreaterThan(10);
  });
  it.each(cases)('%s %j: zero pictographs, one 14px Feather svg', (id, over) => {
    const { root } = setup(id, 'high', over);
    for (const s of strings(root)) expect(PICTO.test(s)).toBe(false);
    const svg = root.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.childElementCount).toBeGreaterThan(0);
  });
});
