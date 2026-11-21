import type { ModuleRenderer, RendererContext } from '@kn/core/renderer';
import type { GaslightProps } from './schema.ts';
import { initialState, step, type GaslightState } from './state.ts';
import { retainStyles } from './styles.ts';

type Ctx = RendererContext<GaslightProps>;

// Every tier does the same silent swap: it happens off-screen, so it must never animate.
// The ink-bruise tint is static on the mutated span (hidden until the swap), so no transition
// is needed and reduced motion is trivially respected.
export default function createRenderer(): ModuleRenderer<GaslightProps> {
  let root: HTMLElement | null = null;
  let releaseStyles: (() => void) | null = null;
  let abort: AbortController | null = null;
  let observer: IntersectionObserver | null = null;
  let raf = 0;
  let state: GaslightState = initialState();

  const build = (c: Ctx): void => {
    cleanup();
    state = initialState();
    releaseStyles = retainStyles();
    const p = c.props;
    const el = document.createElement('p');
    el.className = p.tone === 'ink-bruise' ? 'kn-gl kn-gl--bruise' : 'kn-gl';
    const a = document.createElement('span');
    a.className = 'kn-gl-a';
    a.textContent = p.initialText;
    const b = document.createElement('span');
    b.className = 'kn-gl-b';
    b.textContent = p.mutatedText;
    el.append(a, b);
    root = el;
    paint();
    c.host.append(el);
    track(c);
  };

  const paint = (): void => {
    if (!root) return;
    const [a, b] = Array.from(root.children) as HTMLElement[];
    const showA = state.showing === 'initial';
    a?.setAttribute('aria-hidden', String(!showA));
    b?.setAttribute('aria-hidden', String(showA));
    root.dataset.knState = state.phase;
  };

  const track = (c: Ctx): void => {
    const ac = new AbortController();
    abort = ac;
    let lastY = window.scrollY;
    let up = false;
    const evaluate = (): void => {
      raf = 0;
      if (!root) return;
      const y = window.scrollY;
      if (y !== lastY) up = y < lastY;
      lastY = y;
      const rect = root.getBoundingClientRect();
      const next = step(
        state,
        { top: rect.top, bottom: rect.bottom, viewportH: window.innerHeight, scrollingUp: up },
        c.props,
      );
      if (next.phase !== state.phase || next.showing !== state.showing) {
        state = next;
        paint();
      }
    };
    const schedule = (): void => {
      if (raf === 0) raf = window.requestAnimationFrame(evaluate);
    };
    window.addEventListener('scroll', schedule, { passive: true, signal: ac.signal });
    if (typeof IntersectionObserver !== 'undefined' && root) {
      observer = new IntersectionObserver(schedule);
      observer.observe(root);
    }
    c.signal.addEventListener('abort', cleanup, { once: true, signal: ac.signal });
    if (c.signal.aborted) cleanup();
  };

  function cleanup(): void {
    abort?.abort();
    abort = null;
    observer?.disconnect();
    observer = null;
    if (raf !== 0) window.cancelAnimationFrame(raf);
    raf = 0;
    root?.remove();
    root = null;
    releaseStyles?.();
    releaseStyles = null;
  }

  return {
    mount: build,
    reducedMotionFallback: build,
    // The beat is the scroll-back itself; never hold up pacing.
    trigger: () => Promise.resolve(),
    dispose: cleanup,
  };
}
