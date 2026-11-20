// Lazy chunk: the only place the reader itself touches three.js.
import { PCFShadowMap, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { WorldBounds } from '@kn/core/renderer';

const FOV = 35;
const DIE_WORLD = 0.9;

export interface GLStage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  bounds(): WorldBounds;
  onFrame(cb: (dt: number, t: number) => void): () => void;
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

  const subscribers = new Set<(dt: number, t: number) => void>();
  let raf = 0;
  let last = 0;
  let start = 0;
  const frame = (now: number): void => {
    const dt = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    for (const cb of [...subscribers]) cb(dt, (now - start) / 1000);
    renderer.render(scene, camera);
    if (subscribers.size > 0) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      // Nothing animating: clear and hide so the compositor skips the layer.
      renderer.clear();
      canvas.hidden = true;
    }
  };

  return {
    renderer,
    scene,
    camera,
    bounds: () => ({
      halfWidth: (window.innerWidth / 2 - insets.x) * unitsPerPx,
      halfHeight: (window.innerHeight / 2 - insets.y) * unitsPerPx,
    }),
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
      cancelAnimationFrame(raf);
      subscribers.clear();
      window.removeEventListener('resize', resize);
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
