// The quiet in-column parts of the dice block: the reader's throw button and the result chip
// that stays behind so the outcome is still readable when scrolling back.
import { PIPS, describeRoll } from './faces.ts';
import { FINISHES } from './palette.ts';
import type { DiceMaterial } from './schema.ts';

const SVG = 'http://www.w3.org/2000/svg';

function dieFace(value: number, material: DiceMaterial): SVGSVGElement {
  const f = FINISHES[material];
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '-12 -12 24 24');
  svg.setAttribute('class', 'kn-dice-face');
  svg.setAttribute('aria-hidden', 'true');
  const rect = document.createElementNS(SVG, 'rect');
  Object.entries({ x: -11, y: -11, width: 22, height: 22, rx: 4.5, fill: f.body }).forEach(
    ([k, v]) => rect.setAttribute(k, String(v)),
  );
  rect.setAttribute('stroke', 'rgba(127,127,127,0.45)');
  svg.append(rect);
  for (const [x, y] of PIPS[value] ?? []) {
    const pip = document.createElementNS(SVG, 'circle');
    pip.setAttribute('cx', String(x * 6.8));
    pip.setAttribute('cy', String(y * 6.8));
    pip.setAttribute('r', value === 1 ? '2.6' : '2');
    pip.setAttribute('fill', f.pip);
    svg.append(pip);
  }
  return svg;
}

export function renderResultChip(
  host: HTMLElement,
  values: readonly number[],
  material: DiceMaterial,
  animate: boolean,
): HTMLElement {
  const chip = document.createElement('div');
  chip.className = `kn-dice-result${animate ? ' kn-dice-result--in' : ''}`;
  chip.setAttribute('role', 'status');
  const label = describeRoll(values);
  chip.setAttribute('aria-label', `Dice: ${values.join(', ')}. ${label}.`);
  const faces = document.createElement('span');
  faces.className = 'kn-dice-faces';
  faces.append(...values.map((v) => dieFace(v, material)));
  const text = Object.assign(document.createElement('span'), { textContent: label });
  chip.append(faces, text);
  host.append(chip);
  return chip;
}

function shakeSupported(): boolean {
  const DME = globalThis.DeviceMotionEvent as
    (typeof DeviceMotionEvent & { requestPermission?: unknown }) | undefined;
  // iOS gates motion behind a permission prompt; there the tap is the honest affordance.
  return (
    DME !== undefined && typeof DME.requestPermission !== 'function' && 'ontouchstart' in window
  );
}

/** Resolves when the reader taps the button or shakes the phone. */
export function waitForThrow(host: HTMLElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const shake = shakeSupported();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kn-dice-throw';
    button.textContent = shake ? '🎲 Tap or shake to throw' : '🎲 Tap to throw';
    host.append(button);
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      button.remove();
      window.removeEventListener('devicemotion', onMotion);
      resolve();
    };
    const onMotion = (e: DeviceMotionEvent): void => {
      const a = e.acceleration;
      if (a && Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0) > 14) finish();
    };
    button.addEventListener('click', finish, { signal });
    if (shake) window.addEventListener('devicemotion', onMotion, { signal });
    signal.addEventListener('abort', () => {
      button.remove();
      window.removeEventListener('devicemotion', onMotion);
    });
  });
}
