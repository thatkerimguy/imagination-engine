// Lazy chunk: the only place the reader itself touches three.js.
import { ACESFilmicToneMapping, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { WorldBounds } from '@kn/core/renderer';
import { LIFECYCLE_EVENT, isAppActive } from './lifecycle.ts';

const FOV = 35;
const DIE_WORLD = 0.9;

// `auto` caps the pixel ratio at 1.5x so mid-range GPUs (Adreno 610) hold 120Hz; only an explicit
// High choice (reader setting, writer preview tier, sandbox `?tier=high`) renders at up to 2x.
const explicitHigh = (): boolean =>
  document.documentElement.dataset.tierPref === 'high' ||
  new URLSearchParams(location.search).get('tier') === 'high';

export interface GLStage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  bounds(): WorldBounds;
  onFrame(cb: (dt: number, t: number) => void): () => void;
  /** True between `webglcontextlost` and `webglcontextrestored`. */
  readonly lost: boolean;
  /** True once the context was lost at least once; the stage replaces it when idle. */
  readonly stale: boolean;
  dispose(): void;
}

export function createGLStage(overlay: HTMLElement): GLStage {
  const canvas = document.createElement('canvas');
  canvas.className = 'kn-stage-gl';
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  // Filmic tone mapping keeps bright materials (ivory) from clipping to flat white.
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  overlay.prepend(canvas);
  canvas.hidden = true;

  // World units per CSS pixel: keeps a die about 15% of the short screen edge (56–96 px).
  let unitsPerPx = 0.015;
  let insets = { x: 0, y: 0 };
  const resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, explicitHigh() ? 2 : 1.5));
    renderer.setSize(w, h, false);
    unitsPerPx = DIE_WORLD / Math.max(56, Math.min(96, Math.min(w, h) * 0.15));
    const height = h * unitsPerPx;
    camera.aspect = w / h;
    camera.position.set(0, 0, height / 2 / Math.tan((FOV * Math.PI) / 360));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const cs = getComputedStyle(overlay);
    const px = (v: string): number => parseFloat(v) || 0;
    insets = {
      x: Math.max(px(cs.paddingLeft), px(cs.paddingRight)) + 8,
      y: Math.max(px(cs.paddingTop), px(cs.paddingBottom)) + 8,
    };
  };
  resize();
  window.addEventListener('resize', resize);

  // Context loss (GPU reset, too many contexts, backgrounded tab on low-memory phones):
  // keep the frame clock running without drawing, so every spectacle still finishes its
  // timeline, hands off to its inline fallback and releases its lease. Once lost, the stage
  // is marked stale and replaced with a fresh context when nothing holds it.
  let lost = false;
  let stale = false;
  let disposing = false;
  const onLost = (e: Event): void => {
    e.preventDefault();
    if (disposing) return;
    lost = stale = true;
    console.warn('[stage] WebGL context lost; spectacles continue without drawing');
  };
  const onRestored = (): void => {
    lost = false;
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  const subscribers = new Set<(dt: number, t: number) => void>();
  let raf = 0;
  let last = 0;
  let start = 0;
  const paused = (): boolean => document.hidden || !isAppActive();
  const frame = (now: number): void => {
    if (paused()) {
      raf = 0; // restarted by `resume` once visible and active
      return;
    }
    const dt = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    for (const cb of [...subscribers]) cb(dt, (now - start) / 1000);
    if (!lost) renderer.render(scene, camera);
    if (subscribers.size > 0) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      // Nothing animating: clear and hide so the compositor skips the layer.
      if (!lost) renderer.clear();
      canvas.hidden = true;
    }
  };

  const resume = (): void => {
    if (raf || paused() || subscribers.size === 0) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener(LIFECYCLE_EVENT, resume);

  return {
    renderer,
    scene,
    camera,
    bounds: () => ({
      halfWidth: (window.innerWidth / 2 - insets.x) * unitsPerPx,
      halfHeight: (window.innerHeight / 2 - insets.y) * unitsPerPx,
    }),
    get lost() {
      return lost;
    },
    get stale() {
      return stale;
    },
    onFrame(cb) {
      subscribers.add(cb);
      if (!raf) {
        canvas.hidden = false;
        last = 0;
        start = performance.now();
        raf = requestAnimationFrame(frame);
      }
      return () => subscribers.delete(cb);
    },
    dispose() {
      disposing = true;
      cancelAnimationFrame(raf);
      subscribers.clear();
      raf = 0;
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener(LIFECYCLE_EVENT, resume);
      window.removeEventListener('resize', resize);
      scene.clear();
      renderer.dispose();
      if (!lost) renderer.forceContextLoss();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      canvas.remove();
    },
  };
}
