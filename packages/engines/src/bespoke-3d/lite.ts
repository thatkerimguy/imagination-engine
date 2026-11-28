// Lite tier dice: a short CSS tumble of 2D pip dice inside the card (no canvas, no WebGL).
import type { EngineRuntimeContext } from '@kn/core/gimmicks';
import { cls, el } from '../shared/dom-safe.ts';
import { PIPS } from './dice/faces.ts';
import { FINISHES, type DiceMaterial } from './dice/palette.ts';
import type { Running } from './types.ts';

const ID = 'bespoke-3d';

export function dieFace(value: number, material: DiceMaterial): HTMLElement {
  const f = FINISHES[material];
  const die = el('span', { class: cls(ID, 'die'), 'aria-hidden': 'true' });
  die.style.setProperty('--kn-e-die', f.body);
  die.style.setProperty('--kn-e-pip', f.pip);
  for (const [x, y] of PIPS[value] ?? []) {
    const pip = el('span', { class: cls(ID, 'pip') });
    pip.style.left = `${50 + x * 30}%`;
    pip.style.top = `${50 + y * 30}%`;
    die.append(pip);
  }
  return die;
}

export function playDiceLite(
  ctx: EngineRuntimeContext,
  tray: HTMLElement,
  values: number[],
  material: DiceMaterial,
): Running {
  tray.replaceChildren(...values.map((v) => dieFace(v, material)));
  let finish: () => void = () => undefined;
  const done = new Promise<void>((r) => (finish = r));
  const cancel = ctx.timeout(
    () => {
      ctx.haptics('tap');
      finish();
    },
    Math.round(900 / ctx.dna.motion.tempo),
  );
  ctx.signal.addEventListener('abort', () => finish(), { once: true });
  const stop = (): void => {
    cancel();
    for (const d of tray.children) (d as HTMLElement).style.animation = 'none';
    finish();
  };
  return { done, stop, values };
}
