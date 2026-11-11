/** A reader action and when it happened, on the `performance.now()` clock in milliseconds. */
export interface FightAction {
  readonly action: 'tap' | 'swipe';
  readonly at: number;
}

/**
 * Keys by physical position, so Turkish Q and F layouts play the same (ADR 0016). Z and X sit
 * under the left hand the way rhythm games on desktop usually have them.
 */
const TAP_KEYS = new Set(['KeyZ', 'KeyX', 'KeyF', 'KeyJ', 'Space', 'Enter']);
const SWIPE_KEYS = new Set(['KeyD', 'KeyK', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
/** Gamepad buttons in the standard mapping: A and B strike; X, Y and the shoulders dodge. */
const TAP_BUTTONS = [0, 1];
const SWIPE_BUTTONS = [2, 3, 4, 5];

/** How far a finger must travel to count as a swipe, and how long a press may wait to become one. */
const SWIPE_PX = 28;
const SWIPE_WAIT_MS = 180;

export interface FightInputOptions {
  readonly target: HTMLElement;
  readonly onAction: (action: FightAction) => void;
  /** Whether a swipe is likely now; if so a press waits briefly to see if it becomes one. */
  readonly expectsSwipe: () => boolean;
}

/**
 * Touch, mouse, keyboard and gamepad input for a fight. A tap acts at once, from the moment the
 * finger lands. When a dodge is due, a press waits up to 180 ms to see whether it turns into a
 * swipe, and is still timed from when it landed.
 */
export class FightInput {
  private press: { id: number; x: number; y: number; at: number; timer: number } | null = null;
  private pads = new Map<number, boolean[]>();

  constructor(private readonly options: FightInputOptions) {
    const t = options.target;
    t.addEventListener('pointerdown', this.onDown);
    t.addEventListener('pointermove', this.onMove);
    t.addEventListener('pointerup', this.onUp);
    t.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
  }

  /** Reads gamepads; call once a frame. */
  poll(): void {
    if (typeof navigator.getGamepads !== 'function') return;
    for (const pad of navigator.getGamepads()) {
      if (!pad) continue;
      const before = this.pads.get(pad.index) ?? [];
      const now = pad.buttons.map((b) => b.pressed);
      const rose = (i: number) => now[i] === true && before[i] !== true;
      const at = performance.now();
      if (TAP_BUTTONS.some(rose)) this.options.onAction({ action: 'tap', at });
      else if (SWIPE_BUTTONS.some(rose)) this.options.onAction({ action: 'swipe', at });
      this.pads.set(pad.index, now);
    }
  }

  dispose(): void {
    const t = this.options.target;
    t.removeEventListener('pointerdown', this.onDown);
    t.removeEventListener('pointermove', this.onMove);
    t.removeEventListener('pointerup', this.onUp);
    t.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    if (this.press) clearTimeout(this.press.timer);
  }

  private readonly onDown = (e: PointerEvent) => {
    if (e.button > 0) return;
    e.preventDefault();
    if (this.press) this.settle('tap');
    if (!this.options.expectsSwipe()) {
      this.options.onAction({ action: 'tap', at: e.timeStamp });
      return;
    }
    const timer = window.setTimeout(() => this.settle('tap'), SWIPE_WAIT_MS);
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp, timer };
  };

  private readonly onMove = (e: PointerEvent) => {
    const p = this.press;
    if (!p || p.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) >= SWIPE_PX) this.settle('swipe');
  };

  private readonly onUp = (e: PointerEvent) => {
    if (this.press?.id === e.pointerId) this.settle('tap');
  };

  private settle(action: 'tap' | 'swipe'): void {
    const p = this.press;
    if (!p) return;
    clearTimeout(p.timer);
    this.press = null;
    this.options.onAction({ action, at: p.at });
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const action = TAP_KEYS.has(e.code) ? 'tap' : SWIPE_KEYS.has(e.code) ? 'swipe' : null;
    if (!action) return;
    e.preventDefault();
    this.options.onAction({ action, at: e.timeStamp });
  };
}
