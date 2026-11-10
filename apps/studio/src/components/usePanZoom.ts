import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { clamp, distance, midpoint, pinchScale, scrollForZoom, wheelFactor } from './gestures.ts';

export interface PanZoomOptions {
  /** The current zoom; leave out (with `onScale`) for a canvas that only pans. */
  readonly scale?: number;
  readonly onScale?: (scale: number) => void;
  readonly min?: number;
  readonly max?: number;
  /** 'x' when only horizontal scroll follows the zoom (the timeline). */
  readonly axis?: 'x' | 'both';
  /** A plain mouse wheel scrolls sideways (a canvas that never scrolls up and down). */
  readonly wheelScrollsX?: boolean;
  /** Where a left-button drag pans instead of acting: the empty background. */
  readonly panSurface?: (target: Element) => boolean;
}

/** Movement after which a mouse press on the background is a pan, not a click. */
const PAN_PX = 4;

/**
 * Pointer gestures for a scrolling canvas: pinch with two fingers or ctrl+wheel (and trackpad
 * pinch) to zoom around the fingers or cursor, middle-button drag anywhere or left-button drag on
 * the background to pan. One-finger touch scrolling stays native. Listeners are native because
 * wheel and touchmove must be non-passive to stop the page from zooming.
 */
export function usePanZoom(ref: RefObject<HTMLElement | null>, options: PanZoomOptions): void {
  const live = useRef(options);
  useLayoutEffect(() => {
    live.current = options;
  });
  // The scale asked for but maybe not rendered yet, and where to scroll once it is.
  const target = useRef(options.scale ?? 1);
  const pending = useRef<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    target.current = options.scale ?? 1;
    const el = ref.current;
    const next = pending.current;
    if (!el || !next) return;
    pending.current = null;
    el.scrollLeft = next.left;
    if ((live.current.axis ?? 'both') === 'both') el.scrollTop = next.top;
  }, [options.scale, ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /** Zooms to `scale`, keeping what is under the anchor (`ax`, `ay`, in the scroller's box) there. */
    const zoomTo = (scale: number, ax: number, ay: number, from = target.current) => {
      const o = live.current;
      if (!o.onScale) return;
      const next = clamp(scale, o.min ?? 0.25, o.max ?? 4);
      const base = pending.current ?? { left: el.scrollLeft, top: el.scrollTop };
      if (next === target.current) return;
      pending.current = {
        left: scrollForZoom(base.left, ax, from, next),
        top: scrollForZoom(base.top, ay, from, next),
      };
      target.current = next;
      o.onScale(next);
    };

    const onWheel = (e: WheelEvent) => {
      const o = live.current;
      if ((e.ctrlKey || e.metaKey) && o.onScale) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        zoomTo(
          target.current * wheelFactor(e.deltaY, e.deltaMode),
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
        return;
      }
      if (
        o.wheelScrollsX &&
        !e.shiftKey &&
        Math.abs(e.deltaY) > Math.abs(e.deltaX) &&
        el.scrollWidth > el.clientWidth
      ) {
        e.preventDefault();
        el.scrollLeft += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const surface = live.current.panSurface;
      const onBackground =
        e.button === 0 && e.target instanceof Element && surface?.(e.target) === true;
      if (e.button !== 1 && !onBackground) return;
      if (e.button === 1) e.preventDefault(); // no autoscroll cursor
      const x0 = e.clientX;
      const y0 = e.clientY;
      const left0 = el.scrollLeft;
      const top0 = el.scrollTop;
      let moved = false;
      const onMove = (m: PointerEvent) => {
        const dx = m.clientX - x0;
        const dy = m.clientY - y0;
        if (!moved && Math.hypot(dx, dy) < PAN_PX) return;
        if (!moved) {
          // Moves are followed on window, so no pointer capture is needed off the canvas.
          moved = true;
          el.dataset.panning = 'true';
        }
        el.scrollLeft = left0 - dx;
        el.scrollTop = top0 - dy;
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        delete el.dataset.panning;
        if (!moved) return;
        // The press was a pan: the click that follows must not select or add anything.
        const swallow = (c: MouseEvent) => {
          c.stopPropagation();
          c.preventDefault();
        };
        el.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };

    let pinch: { d0: number; s0: number; content: { x: number; y: number } } | null = null;
    const point = (t: Touch) => {
      const rect = el.getBoundingClientRect();
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };
    const onTouchStart = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      if (e.touches.length !== 2 || !a || !b || !live.current.onScale) return;
      const pa = point(a);
      const pb = point(b);
      const mid = midpoint(pa, pb);
      const s0 = target.current;
      pinch = {
        d0: distance(pa, pb),
        s0,
        content: { x: (el.scrollLeft + mid.x) / s0, y: (el.scrollTop + mid.y) / s0 },
      };
    };
    const onTouchMove = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      if (!pinch || e.touches.length !== 2 || !a || !b) return;
      if (e.cancelable) e.preventDefault();
      const o = live.current;
      const pa = point(a);
      const pb = point(b);
      const mid = midpoint(pa, pb);
      const scale = pinchScale(pinch.s0, pinch.d0, distance(pa, pb), o.min ?? 0.25, o.max ?? 4);
      // Keep the content that started under the fingers under them, so a pinch also pans.
      const left = Math.max(0, pinch.content.x * scale - mid.x);
      const top = Math.max(0, pinch.content.y * scale - mid.y);
      if (scale === target.current) {
        el.scrollLeft = left;
        if ((o.axis ?? 'both') === 'both') el.scrollTop = top;
        return;
      }
      pending.current = { left, top };
      target.current = scale;
      o.onScale?.(scale);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [ref]);
}
