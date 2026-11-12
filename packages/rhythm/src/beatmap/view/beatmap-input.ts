/** The four inputs a play counts: two keys and two mouse buttons (fingers count as buttons). */
export type InputKey = 'k1' | 'k2' | 'm1' | 'm2';
export type InputAction = 'pause' | 'skip';

export interface BeatmapInputOptions {
  /** Takes pointer events (the field's canvas). */
  readonly target: HTMLElement;
  /** Client coordinates to a field point. */
  readonly toField: (clientX: number, clientY: number) => { x: number; y: number };
  /** Only while this is true do taps and keys count. */
  readonly live: () => boolean;
  /** `x`/`y` are where the tap landed; keys tap where the cursor is. `stamp` is the event time. */
  readonly press: (key: InputKey, stamp: number, x?: number, y?: number) => void;
  readonly release: (key: InputKey) => void;
  readonly move: (x: number, y: number, mouse: boolean) => void;
  readonly action: (action: InputAction) => void;
}

const KEYS: Readonly<Record<string, InputKey>> = { KeyZ: 'k1', KeyX: 'k2' };
const MOUSE_BITS: readonly (readonly [number, InputKey])[] = [
  [1, 'm1'],
  [2, 'm2'],
];

/**
 * Mouse, touch, pen and keyboard for a beatmap. Each finger is its own tap where it lands, and
 * the latest finger to move aims sliders and spinners. Handled keys stop here, so the story under
 * the play never sees them.
 */
export class BeatmapInput {
  private readonly pointers = new Map<number, InputKey>();
  private readonly keys = new Set<string>();
  private buttons = 0;
  private readonly detach: () => void;

  constructor(private readonly o: BeatmapInputOptions) {
    const t = o.target;
    const down = (e: PointerEvent) => this.down(e);
    const move = (e: PointerEvent) => this.moved(e);
    const up = (e: PointerEvent) => this.up(e);
    const menu = (e: Event) => e.preventDefault();
    const keydown = (e: KeyboardEvent) => this.keydown(e);
    const keyup = (e: KeyboardEvent) => this.keyup(e);
    const blur = () => this.releaseAll();
    t.addEventListener('pointerdown', down);
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
    t.addEventListener('contextmenu', menu);
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('keyup', keyup, true);
    window.addEventListener('blur', blur);
    this.detach = () => {
      t.removeEventListener('pointerdown', down);
      t.removeEventListener('pointermove', move);
      t.removeEventListener('pointerup', up);
      t.removeEventListener('pointercancel', up);
      t.removeEventListener('contextmenu', menu);
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup, true);
      window.removeEventListener('blur', blur);
    };
  }

  dispose(): void {
    this.detach();
  }

  /** Lets go of everything held (a pause, a lost focus). */
  releaseAll(): void {
    for (const key of this.pointers.values()) this.o.release(key);
    this.pointers.clear();
    for (const [bit, key] of MOUSE_BITS) if (this.buttons & bit) this.o.release(key);
    this.buttons = 0;
    for (const code of this.keys) {
      const key = KEYS[code];
      if (key) this.o.release(key);
    }
    this.keys.clear();
  }

  private down(e: PointerEvent): void {
    if (!this.o.live()) return;
    e.preventDefault();
    this.o.target.setPointerCapture?.(e.pointerId);
    if (e.pointerType === 'mouse') {
      this.mouse(e);
      return;
    }
    const key: InputKey = [...this.pointers.values()].includes('m1') ? 'm2' : 'm1';
    this.pointers.set(e.pointerId, key);
    const p = this.o.toField(e.clientX, e.clientY);
    this.o.move(p.x, p.y, false);
    this.o.press(key, e.timeStamp, p.x, p.y);
  }

  /**
   * Mouse buttons by their bit mask: a second button pressed while one is held arrives as a
   * pointermove, not a pointerdown.
   */
  private mouse(e: PointerEvent): void {
    const p = this.o.toField(e.clientX, e.clientY);
    this.o.move(p.x, p.y, true);
    const now = e.buttons & 3;
    const changed = now ^ this.buttons;
    this.buttons = now;
    for (const [bit, key] of MOUSE_BITS) {
      if (!(changed & bit)) continue;
      if (now & bit) {
        if (this.o.live()) this.o.press(key, e.timeStamp, p.x, p.y);
      } else {
        this.o.release(key);
      }
    }
  }

  private moved(e: PointerEvent): void {
    if (e.pointerType === 'mouse') {
      this.mouse(e);
      return;
    }
    // A finger aims only while it is down.
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.o.toField(e.clientX, e.clientY);
    this.o.move(p.x, p.y, false);
  }

  private up(e: PointerEvent): void {
    if (e.pointerType === 'mouse') {
      this.mouse(e);
      return;
    }
    const key = this.pointers.get(e.pointerId);
    if (!key) return;
    this.pointers.delete(e.pointerId);
    this.o.release(key);
  }

  private keydown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.o.action('pause');
      return;
    }
    if (!this.o.live()) return;
    if (e.code === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) this.o.action('skip');
      return;
    }
    const key = KEYS[e.code];
    if (!key) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat || this.keys.has(e.code)) return;
    this.keys.add(e.code);
    this.o.press(key, e.timeStamp);
  }

  private keyup(e: KeyboardEvent): void {
    const key = KEYS[e.code];
    if (!key || !this.keys.has(e.code)) return;
    e.preventDefault();
    e.stopPropagation();
    this.keys.delete(e.code);
    this.o.release(key);
  }
}
