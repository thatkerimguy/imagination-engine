// High tier dice: the pre-simulated cannon-es throw replayed with PBR dice on the shared WebGL
// stage. Every frame comes from `ctx.raf` (deferred while paused), timers from `ctx.timeout`, and
// `stop()` tears down instantly (Calm Mode / reduced / unmount): frame loop cancelled, every
// geometry / material / texture / env map disposed, the stage canvas hidden and its lease freed.
import type { EngineRuntimeContext } from '@kn/core/gimmicks';
import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  type MeshBasicMaterial,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { acquireStage } from '../../shared/webgl-stage.ts';
import { scheduleClatter } from '../sfx.ts';
import type { Running } from '../types.ts';
import { createDieMaterial, disposeDieMaterial, roundedCube } from './dice-mesh.ts';
import { FACE_VALUES } from './faces.ts';
import type { DiceMaterial } from './palette.ts';
import { remapRotation } from './remap.ts';
import { blobTexture, createShadow, updateShadow } from './shadow.ts';
import { DIE_SIZE, FLOATS_PER_DIE, recordThrow, STEP } from './simulate.ts';

export interface DiceOptions {
  count: number;
  /** Scripted faces (1-6) or null for a genuine random roll. */
  values: number[] | null;
  material: DiceMaterial;
  holdSeconds: number;
  throwFrom: 'left' | 'right' | 'bottom';
  sound: boolean;
}

const FADE_S = 0.45;
const LIFT = 0.65;

export function playDiceHigh(
  ctx: EngineRuntimeContext,
  o: DiceOptions,
  onHandoff: (values: number[]) => void,
): Running {
  const lease = acquireStage(); // throws without WebGL: the caller falls back to lite
  const pmrem = new PMREMGenerator(lease.renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.1);
  room.dispose();
  pmrem.dispose();
  const material = createDieMaterial(o.material, env.texture);
  const geometry = roundedCube(DIE_SIZE, 0.12, 7);
  const blob = blobTexture();
  const blobGeo = new PlaneGeometry(1, 1);
  const group = new Group();
  const key = new DirectionalLight(0xffffff, 1.55);
  key.position.set(-7.5, 8.5, 10);
  group.add(key, key.target, new AmbientLight(0xffffff, 0.36));
  const dice: Mesh[] = [];
  const shadows: Mesh<PlaneGeometry, MeshBasicMaterial>[] = [];
  for (let i = 0; i < o.count; i++) {
    const die = new Mesh(geometry, material);
    const shadow = createShadow(blobGeo, blob);
    dice.push(die);
    shadows.push(shadow);
    group.add(shadow, die);
  }
  lease.scene.add(group);

  const rec = recordThrow({
    count: o.count,
    bounds: lease.bounds(),
    throwFrom: o.throwFrom,
    seed: Math.floor(Math.random() * 1e9),
  });
  const values = rec.landedFaces.map((f, i) => o.values?.[i] ?? FACE_VALUES[f]!);
  const remaps = rec.landedFaces.map((face, i) => {
    const [x, y, z, w] = remapRotation(values[i]!, face);
    return new Quaternion(x, y, z, w);
  });
  const stopSound = o.sound ? scheduleClatter(ctx, rec.impacts, o.material) : () => undefined;
  const settleAt = (rec.frameCount - 1) * STEP;
  const q = new Quaternion();
  const q2 = new Quaternion();

  const pose = (t: number): void => {
    const f = Math.min(rec.frameCount - 1, t / STEP);
    const i0 = Math.floor(f);
    const i1 = Math.min(rec.frameCount - 1, i0 + 1);
    const a = f - i0;
    const fr = rec.frames;
    dice.forEach((mesh, d) => {
      const o0 = (i0 * rec.count + d) * FLOATS_PER_DIE;
      const o1 = (i1 * rec.count + d) * FLOATS_PER_DIE;
      const lerp = (k: number): number => fr[o0 + k]! + (fr[o1 + k]! - fr[o0 + k]!) * a;
      mesh.position.set(lerp(0), lerp(1), lerp(2));
      q.set(fr[o0 + 3]!, fr[o0 + 4]!, fr[o0 + 5]!, fr[o0 + 6]!);
      q2.set(fr[o1 + 3]!, fr[o1 + 4]!, fr[o1 + 5]!, fr[o1 + 6]!);
      // Body orientation × cube-symmetry remap = the scripted face lands on top.
      mesh.quaternion.slerpQuaternions(q, q2, a).multiply(remaps[d]!);
      updateShadow(shadows[d]!, mesh.position, 1);
    });
  };

  let finish: () => void = () => undefined;
  const done = new Promise<void>((resolve) => (finish = resolve));
  let stopped = false;
  let cancelFrame: () => void = () => undefined;
  let cancelHold: () => void = () => undefined;
  const hold = new AbortController();

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    cancelFrame();
    cancelHold();
    hold.abort();
    stopSound();
    lease.scene.remove(group);
    geometry.dispose();
    blobGeo.dispose();
    blob.dispose();
    for (const s of shadows) s.material.dispose();
    disposeDieMaterial(material);
    env.dispose();
    lease.release();
    finish();
  };

  let phase: 'roll' | 'hold' | 'fade' = 'roll';
  let t = 0;
  let fadeStart = 0;
  let last = -1;
  const settledZ: number[] = [];
  const startFade = (): void => {
    if (phase !== 'hold' || stopped) return;
    phase = 'fade';
    fadeStart = t;
    hold.abort();
    onHandoff(values);
  };
  const frame = (now: number): void => {
    if (stopped) return;
    const dt = last < 0 ? 1 / 60 : (now - last) / 1000;
    last = now;
    // Clamp the roll so a resumed tab never teleports; the fade runs on (capped) real time.
    t += Math.min(dt, phase === 'fade' ? 0.25 : 1 / 20);
    if (phase === 'roll') {
      pose(Math.min(t, settleAt));
      if (t >= settleAt) {
        phase = 'hold';
        dice.forEach((m, i) => (settledZ[i] = m.position.z));
        ctx.haptics('tap');
        cancelHold = ctx.timeout(startFade, o.holdSeconds * 1000);
        // A tap anywhere skips the hold (registered after settling, so the throw tap can't).
        addEventListener('pointerdown', startFade, { once: true, signal: hold.signal });
        ctx.signal.addEventListener('abort', () => hold.abort(), { signal: hold.signal });
      }
    } else if (phase === 'fade') {
      const k = Math.min(1, (t - fadeStart) / FADE_S);
      const e = k * k * (3 - 2 * k);
      material.opacity = 1 - e;
      dice.forEach((m, i) => {
        m.position.z = settledZ[i]! + e * LIFT;
        updateShadow(shadows[i]!, m.position, 1 - e);
      });
      if (k >= 1) {
        lease.render();
        return stop();
      }
    }
    lease.render();
    cancelFrame = ctx.raf(frame);
  };
  pose(0);
  cancelFrame = ctx.raf(frame);
  return { done, stop, values };
}
