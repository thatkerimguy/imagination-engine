// The single shared WebGL stage for `bespoke-3d` (CLAUDE.md §3.5): ONE renderer on ONE
// transparent fixed overlay canvas, created on first lease and reused by every cue, so 20
// consecutive mount/destroy cycles never approach Chromium's 16-context limit. The stage owns no
// frame loop: engines drive it from `ctx.raf` and call `lease.render()`, so pause, Calm Mode and
// unmount stop drawing through the runtime context. Only bespoke-3d imports this file (three.js
// must never reach the initial reader chunk or any other engine chunk).
import { ACESFilmicToneMapping, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

export interface WorldBounds {
  halfWidth: number;
  halfHeight: number;
}

export interface StageLease {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Visible world rectangle at z = 0, inset from the safe areas. */
  bounds(): WorldBounds;
  /** Draws one frame (no-op while the context is lost or after release). */
  render(): void;
  /** True between `webglcontextlost` and `webglcontextrestored`. */
  readonly lost: boolean;
  /** Hides + clears the canvas and frees the lease; the renderer idles, then is disposed. */
  release(): void;
}

export interface StageStats {
  contextsCreated: number;
  live: boolean;
  leases: number;
  lost: boolean;
  geometries: number;
  textures: number;
  programs: number;
}

const FOV = 35;
const DIE_WORLD = 0.9;
const IDLE_DISPOSE_MS = 8000;

interface Stage {
  canvas: HTMLCanvasElement;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  unitsPerPx: number;
  inset: { x: number; y: number };
  lost: boolean;
  stale: boolean;
  resize(): void;
}

let stage: Stage | null = null;
let leases = 0;
let contextsCreated = 0;
let idle: ReturnType<typeof setTimeout> | undefined;

function create(): Stage {
  const canvas = document.createElement('canvas');
  canvas.className = 'kn-stage-gl';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100dvh;pointer-events:none;z-index:30;display:none';
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping; // keeps ivory from clipping to flat white
  const s: Stage = {
    canvas,
    renderer,
    scene: new Scene(),
    camera: new PerspectiveCamera(FOV, 1, 0.1, 100),
    unitsPerPx: 0.015,
    inset: { x: 8, y: 8 },
    lost: false,
    stale: false,
    resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const hi = document.documentElement.dataset.tierPref === 'high';
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 2 : 1.5));
      renderer.setSize(w, h, false);
      // A die is about 15% of the short screen edge (56–96 px), as in the v1 stage.
      s.unitsPerPx = DIE_WORLD / Math.max(56, Math.min(96, Math.min(w, h) * 0.15));
      s.camera.aspect = w / h;
      s.camera.position.set(0, 0, (h * s.unitsPerPx) / 2 / Math.tan((FOV * Math.PI) / 360));
      s.camera.lookAt(0, 0, 0);
      s.camera.updateProjectionMatrix();
      const top = parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0;
      s.inset = { x: 8, y: Math.max(8, top + 8) };
    },
  };
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    s.lost = s.stale = true;
    console.warn('[stage] WebGL context lost; the spectacle finishes without drawing');
  });
  canvas.addEventListener('webglcontextrestored', () => (s.lost = false));
  window.addEventListener('resize', s.resize);
  document.body.append(canvas);
  s.resize();
  contextsCreated++;
  return s;
}

function destroy(): void {
  clearTimeout(idle);
  if (!stage) return;
  const s = stage;
  stage = null;
  window.removeEventListener('resize', s.resize);
  s.scene.clear();
  s.renderer.dispose();
  if (!s.lost) s.renderer.forceContextLoss();
  s.canvas.remove();
}

/** Leases the shared stage (creating its single context on first use). Throws without WebGL. */
export function acquireStage(): StageLease {
  clearTimeout(idle);
  if (stage?.stale && leases === 0) destroy();
  stage ??= create();
  const s = stage;
  leases++;
  let released = false;
  s.canvas.style.display = 'block';
  return {
    renderer: s.renderer,
    scene: s.scene,
    camera: s.camera,
    bounds: () => ({
      halfWidth: (window.innerWidth / 2 - s.inset.x) * s.unitsPerPx,
      halfHeight: (window.innerHeight / 2 - s.inset.y) * s.unitsPerPx,
    }),
    get lost() {
      return s.lost;
    },
    render() {
      if (!released && !s.lost && stage === s) s.renderer.render(s.scene, s.camera);
    },
    release() {
      if (released) return;
      released = true;
      if (--leases > 0 || stage !== s) return;
      if (!s.lost) s.renderer.clear();
      s.canvas.style.display = 'none';
      if (s.stale) destroy();
      else idle = setTimeout(destroy, IDLE_DISPOSE_MS);
    },
  };
}

export function webglStageStats(): StageStats {
  const info = stage?.renderer.info;
  return {
    contextsCreated,
    live: stage !== null,
    leases,
    lost: stage?.lost ?? false,
    geometries: info?.memory.geometries ?? 0,
    textures: info?.memory.textures ?? 0,
    programs: info?.programs?.length ?? 0,
  };
}

/** Drops the context now if nothing holds it (sandbox leak checks, page hide). */
export function disposeIdleStage(): void {
  if (leases === 0) destroy();
}

/** Smoke / sandbox telemetry hook (`window.__knWebglStage()`); never used for control flow. */
if (typeof window !== 'undefined') {
  Object.assign(window, { __knWebglStage: webglStageStats, __knWebglDispose: disposeIdleStage });
}
