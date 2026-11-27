// High tier brass lighter: a beveled brass case with a hinged lid on the shared WebGL stage,
// lit by a room environment. Timeline (all on ctx.raf): rise in → lid flips open (clack) →
// flint strike → flame grows and breathes for `holdSeconds` (tap skips) → lid snaps shut → fade.
// `stop()` disposes every GPU resource and frees the stage at once (Calm Mode / unmount).
import type { EngineRuntimeContext } from '@kn/core/gimmicks';
import {
  AdditiveBlending,
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  PointLight,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { acquireStage } from '../../shared/webgl-stage.ts';
import { roundedCube } from '../dice/dice-mesh.ts';
import { playClack, playIgnite } from '../sfx.ts';
import type { Running } from '../types.ts';
import { FLAME_H, FLAME_W, paintFlame } from './flame.ts';

export interface ZippoOptions {
  finish: 'brass' | 'obsidian';
  holdSeconds: number;
  sound: boolean;
}

const FINISH = {
  brass: { color: 0xc9a24a, roughness: 0.3 },
  obsidian: { color: 0x22232a, roughness: 0.18 },
} as const;
const smooth = (k: number): number => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};

export function playZippoHigh(ctx: EngineRuntimeContext, o: ZippoOptions): Running {
  const lease = acquireStage();
  const pmrem = new PMREMGenerator(lease.renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.08);
  room.dispose();
  pmrem.dispose();
  const f = FINISH[o.finish];
  const metal = new MeshStandardMaterial({
    color: f.color,
    metalness: 1,
    roughness: f.roughness,
    envMap: env.texture,
    envMapIntensity: 1.1,
    transparent: true,
  });
  const dark = new MeshStandardMaterial({ color: 0x2a241b, metalness: 0.8, roughness: 0.55 });
  const geo = roundedCube(1, 0.1, 5);
  const canvas = document.createElement('canvas');
  canvas.width = FLAME_W;
  canvas.height = FLAME_H;
  const g = canvas.getContext('2d');
  const flameTex = new CanvasTexture(canvas);
  flameTex.colorSpace = SRGBColorSpace;
  const flameMat = new SpriteMaterial({
    map: flameTex,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  const rig = new Group();
  const body = new Mesh(geo, metal);
  body.scale.set(0.95, 1.25, 0.5);
  const chimney = new Mesh(geo, dark);
  chimney.scale.set(0.62, 0.42, 0.38);
  chimney.position.set(0, 0.8, 0);
  const lid = new Mesh(geo, metal);
  lid.scale.set(0.95, 0.5, 0.5);
  lid.position.set(-0.475, 0.25, 0); // pivot at the hinge on the right edge
  const hinge = new Group();
  hinge.position.set(0.475, 0.65, 0);
  hinge.add(lid);
  const flame = new Sprite(flameMat);
  flame.scale.set(0.55, 1.1, 1);
  flame.position.set(0, 1.5, 0.05);
  flame.visible = false;
  const glow = new PointLight(0xffa040, 0, 4);
  glow.position.set(0, 1.4, 0.8);
  const key = new DirectionalLight(0xffffff, 1.2);
  key.position.set(-4, 6, 8);
  rig.add(body, chimney, hinge, flame, glow, key, key.target, new AmbientLight(0xffffff, 0.3));
  const b = lease.bounds();
  const y0 = -b.halfHeight * 0.3;
  rig.position.set(0, y0, 1.4);
  rig.rotation.set(-0.25, 0.35, 0);
  lease.scene.add(rig);

  let finish: () => void = () => undefined;
  const done = new Promise<void>((resolve) => (finish = resolve));
  let stopped = false;
  let cancelFrame: () => void = () => undefined;
  let stopSound: () => void = () => undefined;
  const tap = new AbortController();
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    cancelFrame();
    tap.abort();
    stopSound();
    lease.scene.remove(rig);
    for (const m of [metal, dark, flameMat]) m.dispose();
    geo.dispose();
    flameTex.dispose();
    env.dispose();
    lease.release();
    finish();
  };

  // Seconds: rise, open, strike, (lit hold), close, fade.
  const OPEN = 0.25;
  const LIT = OPEN + 0.32;
  let closeAt = Infinity;
  let t = 0;
  let last = -1;
  let opened = false;
  let lit = false;
  let shut = false;
  const close = (): void => {
    if (closeAt === Infinity && lit) closeAt = t;
  };
  addEventListener('pointerdown', close, { signal: tap.signal });
  ctx.signal.addEventListener('abort', () => tap.abort(), { signal: tap.signal });

  const frame = (now: number): void => {
    if (stopped) return;
    t += last < 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
    last = now;
    const rise = smooth(t / 0.25);
    rig.position.y = y0 - (1 - rise) * 0.4;
    let alpha = rise;
    if (!opened && t >= OPEN) {
      opened = true;
      if (o.sound) stopSound = playClack(ctx);
    }
    const open = smooth((t - OPEN) / 0.28) * (1 - smooth((t - closeAt) / 0.22));
    hinge.rotation.z = -2.3 * open;
    if (!lit && t >= LIT) {
      lit = true;
      flame.visible = true;
      if (o.sound) stopSound = playIgnite(ctx);
      ctx.haptics('tap');
      ctx.timeout(close, o.holdSeconds * 1000);
    }
    const level = lit ? smooth((t - LIT) / 0.4) * (1 - smooth((t - closeAt) / 0.12)) : 0;
    if (g) paintFlame(g, t, level);
    flameTex.needsUpdate = true;
    glow.intensity = 1.6 * level;
    if (!shut && t >= closeAt + 0.2) {
      shut = true;
      if (o.sound) stopSound = playClack(ctx, true);
    }
    if (t > closeAt + 0.25) alpha = 1 - smooth((t - closeAt - 0.25) / 0.4);
    metal.opacity = alpha;
    lease.render();
    if (t > closeAt + 0.7) return stop();
    cancelFrame = ctx.raf(frame);
  };
  cancelFrame = ctx.raf(frame);
  return { done, stop };
}
