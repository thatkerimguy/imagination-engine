// The throw prompt under a minimal fake DOM (vitest runs in node; no jsdom in the workspace).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createShakeMeter, NATIVE_SHAKE_EVENT, SHAKE_THRESHOLD, waitForThrow } from './inline.ts';

class FakeEl extends EventTarget {
  textContent = '';
  className = '';
  type = '';
  removed = false;
  readonly children: FakeEl[] = [];
  append(...nodes: FakeEl[]): void {
    this.children.push(...nodes);
  }
  remove(): void {
    this.removed = true;
  }
}

type FakeWindow = EventTarget & { __KN_NATIVE_SHAKE__?: boolean; ontouchstart?: null };
const g = globalThis as unknown as { window?: FakeWindow; document?: unknown };

const motion = (
  acceleration: { x: number; y: number; z: number } | null,
  withGravity: { x: number; y: number; z: number } | null,
): Event =>
  Object.assign(new Event('devicemotion'), {
    acceleration,
    accelerationIncludingGravity: withGravity,
  });

let settled = false;
const track = (p: Promise<void>): Promise<void> =>
  p.then(() => {
    settled = true;
  });
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  settled = false;
  g.window = new EventTarget() as FakeWindow;
  g.document = { createElement: () => new FakeEl() };
});

afterEach(() => {
  delete g.window;
  delete g.document;
});

describe('waitForThrow', () => {
  it('offers tap only without motion support', () => {
    const host = new FakeEl();
    void waitForThrow(host as unknown as HTMLElement, new AbortController().signal);
    expect(host.children[0]!.textContent).toBe('🎲 Tap to throw');
  });

  it('offers shake when the native writer preview bridges the accelerometer', () => {
    g.window!.__KN_NATIVE_SHAKE__ = true;
    const host = new FakeEl();
    void waitForThrow(host as unknown as HTMLElement, new AbortController().signal);
    expect(host.children[0]!.textContent).toBe('🎲 Tap or shake to throw');
  });

  it('resolves on the kn-native-shake event and removes the button', async () => {
    g.window!.__KN_NATIVE_SHAKE__ = true;
    const host = new FakeEl();
    const done = track(waitForThrow(host as unknown as HTMLElement, new AbortController().signal));
    await flush();
    expect(settled).toBe(false);
    g.window!.dispatchEvent(new Event(NATIVE_SHAKE_EVENT));
    await done;
    expect(host.children[0]!.removed).toBe(true);
  });

  it('shakes via accelerationIncludingGravity when acceleration is null (Android WebView)', async () => {
    g.window!.__KN_NATIVE_SHAKE__ = true;
    const host = new FakeEl();
    const done = track(waitForThrow(host as unknown as HTMLElement, new AbortController().signal));
    // Resting phone: gravity only, never a shake.
    for (let i = 0; i < 10; i++) g.window!.dispatchEvent(motion(null, { x: 0, y: 9.81, z: 0 }));
    await flush();
    expect(settled).toBe(false);
    g.window!.dispatchEvent(motion(null, { x: 70, y: 9.81, z: 0 }));
    await done;
    expect(settled).toBe(true);
  });

  it('stops listening after abort', async () => {
    g.window!.__KN_NATIVE_SHAKE__ = true;
    const host = new FakeEl();
    const ctrl = new AbortController();
    void track(waitForThrow(host as unknown as HTMLElement, ctrl.signal));
    ctrl.abort();
    g.window!.dispatchEvent(new Event(NATIVE_SHAKE_EVENT));
    await flush();
    expect(settled).toBe(false);
    expect(host.children[0]!.removed).toBe(true);
  });
});

describe('createShakeMeter', () => {
  it('uses linear acceleration when the browser provides it', () => {
    const meter = createShakeMeter();
    expect(meter({ acceleration: { x: 3, y: 4, z: 12 } } as DeviceMotionEvent)).toBe(13);
  });

  it('filters gravity out of accelerationIncludingGravity', () => {
    const meter = createShakeMeter();
    const still = { acceleration: null, accelerationIncludingGravity: { x: 0, y: 9.81, z: 0 } };
    expect(meter(still as unknown as DeviceMotionEvent)).toBe(0);
    expect(meter(still as unknown as DeviceMotionEvent)).toBeLessThan(0.01);
    const jolt = { acceleration: null, accelerationIncludingGravity: { x: 40, y: 9.81, z: 0 } };
    expect(meter(jolt as unknown as DeviceMotionEvent)).toBeGreaterThan(SHAKE_THRESHOLD);
  });
});
