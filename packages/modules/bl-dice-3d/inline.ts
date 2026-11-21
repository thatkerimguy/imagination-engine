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

/** Linear acceleration (m/s², gravity removed) above which a motion counts as a shake. */
export const SHAKE_THRESHOLD = 11.5;
/** Low-pass weight for the gravity estimate when only accelerationIncludingGravity exists. */
export const GRAVITY_ALPHA = 0.8;
/** The writer's native preview fires this when expo-sensors sees a shake. */
export const NATIVE_SHAKE_EVENT = 'kn-native-shake';

function shakeSupported(): boolean {
  // The writer's Android/iOS WebView forwards shakes from the native accelerometer.
  if ((window as { __KN_NATIVE_SHAKE__?: boolean }).__KN_NATIVE_SHAKE__) return true;
  const DME = globalThis.DeviceMotionEvent as
    (typeof DeviceMotionEvent & { requestPermission?: unknown }) | undefined;
  // iOS gates motion behind a permission prompt; there the tap is the honest affordance.
  return (
    DME !== undefined && typeof DME.requestPermission !== 'function' && 'ontouchstart' in window
  );
}

/**
 * Linear-acceleration magnitude from a motion event. Android WebViews often report a null
 * `acceleration`; then gravity is tracked with a low-pass filter on accelerationIncludingGravity
 * and subtracted. The first gravity sample only seeds the filter.
 */
export function createShakeMeter(): (
  e: Pick<DeviceMotionEvent, 'acceleration' | 'accelerationIncludingGravity'>,
) => number {
  let g: [number, number, number] | null = null;
  return (e) => {
    const a = e.acceleration;
    if (a && a.x !== null && a.y !== null && a.z !== null) return Math.hypot(a.x, a.y, a.z);
    const r = e.accelerationIncludingGravity;
    if (!r || r.x === null || r.y === null || r.z === null) return 0;
    const raw: [number, number, number] = [r.x, r.y, r.z];
    if (!g) {
      g = raw;
      return 0;
    }
    const k = GRAVITY_ALPHA;
    g = [k * g[0] + (1 - k) * raw[0], k * g[1] + (1 - k) * raw[1], k * g[2] + (1 - k) * raw[2]];
    return Math.hypot(raw[0] - g[0], raw[1] - g[1], raw[2] - g[2]);
  };
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
    const meter = createShakeMeter();
    let done = false;
    const cleanup = (): void => {
      button.remove();
      window.removeEventListener('devicemotion', onMotion);
      window.removeEventListener(NATIVE_SHAKE_EVENT, finish);
    };
    const finish = (): void => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };
    const onMotion = (e: DeviceMotionEvent): void => {
      if (meter(e) > SHAKE_THRESHOLD) finish();
    };
    button.addEventListener('click', finish, { signal });
    if (shake) {
      window.addEventListener('devicemotion', onMotion, { signal });
      window.addEventListener(NATIVE_SHAKE_EVENT, finish, { signal });
    }
    signal.addEventListener('abort', cleanup);
  });
}
