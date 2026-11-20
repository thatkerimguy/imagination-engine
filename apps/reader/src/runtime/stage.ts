// The singleton transparent stage. The DOM overlay is cheap and always present; the WebGL half
// (three.js) is imported and created only when an overlay-vfx module asks for it, and torn down
// after a stretch of idleness so the GPU and battery rest between spectacles.
import type { GLStageLease, StageAccess } from '@kn/core/renderer';
import type { GLStage } from './stage-gl.ts';

const IDLE_DISPOSE_MS = 8000;

export interface StageStats {
  contextsCreated: number;
  liveContext: boolean;
  leases: number;
  contextLost: boolean;
  geometries: number;
  textures: number;
  programs: number;
  overlayChildren: number;
}

export interface Stage extends StageAccess {
  stats(): StageStats;
  /** Immediately drops the WebGL context (used by the sandbox leak check and page hide). */
  disposeGL(): void;
}

export function createStage(parent: HTMLElement = document.body): Stage {
  const overlay = document.createElement('div');
  overlay.className = 'kn-stage';
  overlay.setAttribute('aria-hidden', 'true');
  parent.append(overlay);

  let gl: GLStage | null = null;
  let pending: Promise<GLStage> | null = null;
  let leases = 0;
  let contextsCreated = 0;
  let idleTimer = 0;

  const disposeGL = (): void => {
    clearTimeout(idleTimer);
    gl?.dispose();
    gl = null;
  };

  const ensureGL = async (): Promise<GLStage> => {
    if (gl?.lost) throw new Error('WebGL context is lost');
    // A context that was lost once is replaced as soon as nothing holds it.
    if (gl?.stale && leases === 0) disposeGL();
    if (gl) return gl;
    pending ??= import('./stage-gl.ts')
      .then(({ createGLStage }) => {
        gl = createGLStage(overlay);
        contextsCreated++;
        return gl;
      })
      .finally(() => (pending = null));
    return pending;
  };

  return {
    overlay,
    async acquireGL(): Promise<GLStageLease> {
      clearTimeout(idleTimer);
      const stage = await ensureGL();
      leases++;
      let released = false;
      const unsubs = new Set<() => void>();
      return {
        renderer: stage.renderer,
        scene: stage.scene,
        camera: stage.camera,
        bounds: () => stage.bounds(),
        onFrame(cb) {
          const off = stage.onFrame(cb);
          unsubs.add(off);
          return () => {
            off();
            unsubs.delete(off);
          };
        },
        release() {
          if (released) return;
          released = true;
          unsubs.forEach((off) => off());
          if (--leases > 0) return;
          if (gl?.stale) disposeGL();
          else idleTimer = window.setTimeout(disposeGL, IDLE_DISPOSE_MS);
        },
      };
    },
    stats() {
      const info = gl?.renderer.info;
      return {
        contextsCreated,
        liveContext: gl !== null,
        leases,
        contextLost: gl?.lost ?? false,
        geometries: info?.memory.geometries ?? 0,
        textures: info?.memory.textures ?? 0,
        programs: info?.programs?.length ?? 0,
        overlayChildren: overlay.querySelectorAll(':scope > :not(.kn-stage-gl)').length,
      };
    },
    disposeGL() {
      if (leases === 0) disposeGL();
    },
  };
}
