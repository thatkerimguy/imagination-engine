// High tier: replays the pre-simulated throw on the shared WebGL stage with PBR dice, soft
// height-aware contact shadows, and clatter scheduled from recorded impacts. Lifecycle:
// roll → settle → hold (tap skips) → cross-fade with the inline chip → dispose → release lease.
import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  type CanvasTexture,
  type MeshBasicMaterial,
  type WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { AudioBusAccess, GLStageLease } from '@kn/core/renderer';
import { FACE_VALUES, pickOutcome } from './faces.ts';
import { createDieMaterial, disposeDieMaterial, roundedCube } from './dice-mesh.ts';
import { FADE_SECONDS, fadeProgress, holdOrTap } from './handoff.ts';
import { remapRotation } from './remap.ts';
import { blobTexture, createShadow, updateShadow } from './shadow.ts';
import { scheduleClatter } from './sfx.ts';
import { DIE_SIZE, FLOATS_PER_DIE, STEP, recordThrow, type ThrowRecording } from './simulate.ts';
import type { DiceProps } from './schema.ts';

export const KEY_LIGHT = 1.7;
/** World units the dice rise while fading out (about two thirds of a die). */
export const LIFT_HEIGHT = 0.65;
export const AMBIENT_LIGHT = 0.32;

type Phase = 'idle' | 'roll' | 'hold' | 'fade' | 'done';

export class HighDice {
  private readonly group = new Group();
  private readonly env: WebGLRenderTarget;
  private readonly material;
  private readonly geometry = roundedCube(DIE_SIZE, 0.12, 7);
  private readonly blob: CanvasTexture = blobTexture();
  private readonly blobGeo = new PlaneGeometry(1, 1);
  private readonly meshes: Mesh[] = [];
  private readonly shadows: Mesh<PlaneGeometry, MeshBasicMaterial>[] = [];
  private readonly remaps: Quaternion[] = [];
  private unsubscribe: (() => void) | null = null;
  private cancelSound: (() => void) | null = null;
  private finish: (() => void) | null = null;
  private phase: Phase = 'idle';
  private disposed = false;

  constructor(
    private readonly lease: GLStageLease,
    private readonly props: DiceProps,
    private readonly audio: AudioBusAccess,
  ) {
    const pmrem = new PMREMGenerator(lease.renderer);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    this.material = createDieMaterial(props.material, this.env.texture);
    const key = new DirectionalLight(0xffffff, KEY_LIGHT);
    key.position.set(-3.5, 5, 13);
    this.group.add(key, key.target, new AmbientLight(0xffffff, AMBIENT_LIGHT));
    for (let i = 0; i < props.count; i++) {
      const die = new Mesh(this.geometry, this.material);
      const shadow = createShadow(this.blobGeo, this.blob);
      die.visible = shadow.visible = false;
      this.meshes.push(die);
      this.shadows.push(shadow);
      this.group.add(shadow, die);
    }
    lease.scene.add(this.group);
    // Compile now, so the first thrown frame does not stall on shader compilation.
    lease.renderer.compile(lease.scene, lease.camera);
  }

  /**
   * Plays the throw. `onHandoff` fires when the dice start fading (show the inline chip then);
   * the promise resolves once the overlay is gone and the lease released.
   */
  play(signal: AbortSignal, onHandoff: (values: number[]) => void): Promise<void> {
    const { props } = this;
    const rec = recordThrow({
      count: props.count,
      bounds: this.lease.bounds(),
      throwFrom: props.throwFrom,
      seed: Math.floor(Math.random() * 1e9),
    });
    const values =
      props.outcomeMode === 'scripted'
        ? pickOutcome('scripted', props.scriptedNumbers, props.count)
        : rec.landedFaces.map((f) => FACE_VALUES[f]!);
    rec.landedFaces.forEach((face, i) => {
      const [x, y, z, w] = remapRotation(values[i]!, face);
      this.remaps[i] = new Quaternion(x, y, z, w);
    });
    if (props.sound) this.cancelSound = scheduleClatter(this.audio, rec.impacts, props.material);
    const settleAt = (rec.frameCount - 1) * STEP;

    return new Promise<void>((resolve) => {
      this.finish = resolve;
      let t = 0;
      let fadeStart = 0;
      const settledZ: number[] = [];
      const q = new Quaternion();
      const q2 = new Quaternion();
      this.meshes.forEach((m, i) => (m.visible = this.shadows[i]!.visible = true));
      this.phase = 'roll';
      this.applyFrame(rec, 0, q, q2, 1);
      this.unsubscribe = this.lease.onFrame((dt) => {
        // Clamp so a backgrounded tab resumes smoothly instead of teleporting.
        t += Math.min(dt, 1 / 20);
        if (this.phase === 'roll') {
          this.applyFrame(rec, Math.min(t, settleAt), q, q2, 1);
          if (t < settleAt) return;
          this.phase = 'hold';
          this.meshes.forEach((m, i) => (settledZ[i] = m.position.z));
          navigator.vibrate?.(12);
          void holdOrTap(props.holdSeconds, signal).then(() => {
            if (this.phase !== 'hold') return;
            this.phase = 'fade';
            fadeStart = t;
            onHandoff(values);
          });
        } else if (this.phase === 'fade') {
          const k = fadeProgress(t, fadeStart);
          this.material.opacity = 1 - k;
          this.meshes.forEach((m, i) => {
            // Absolute from the settled pose, so 60/90/120 Hz screens lift identically.
            m.position.z = settledZ[i]! + k * LIFT_HEIGHT;
            updateShadow(this.shadows[i]!, m.position, 1 - k);
          });
          if (t - fadeStart >= FADE_SECONDS) this.dispose();
        }
      });
    });
  }

  private applyFrame(
    rec: ThrowRecording,
    t: number,
    q: Quaternion,
    q2: Quaternion,
    fade: number,
  ): void {
    const f = Math.min(rec.frameCount - 1, t / STEP);
    const i0 = Math.floor(f);
    const i1 = Math.min(rec.frameCount - 1, i0 + 1);
    const a = f - i0;
    const fr = rec.frames;
    this.meshes.forEach((mesh, d) => {
      const o0 = (i0 * rec.count + d) * FLOATS_PER_DIE;
      const o1 = (i1 * rec.count + d) * FLOATS_PER_DIE;
      mesh.position.set(
        fr[o0]! + (fr[o1]! - fr[o0]!) * a,
        fr[o0 + 1]! + (fr[o1 + 1]! - fr[o0 + 1]!) * a,
        fr[o0 + 2]! + (fr[o1 + 2]! - fr[o0 + 2]!) * a,
      );
      q.set(fr[o0 + 3]!, fr[o0 + 4]!, fr[o0 + 5]!, fr[o0 + 6]!);
      q2.set(fr[o1 + 3]!, fr[o1 + 4]!, fr[o1 + 5]!, fr[o1 + 6]!);
      // Body orientation × cube-symmetry remap = the scripted face ends up on top.
      mesh.quaternion.slerpQuaternions(q, q2, a).multiply(this.remaps[d]!);
      updateShadow(this.shadows[d]!, mesh.position, fade);
    });
  }

  /** Idempotent. Frees every GPU resource, then releases the stage lease. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.phase = 'done';
    this.unsubscribe?.();
    this.cancelSound?.();
    this.lease.scene.remove(this.group);
    this.geometry.dispose();
    this.blobGeo.dispose();
    this.blob.dispose();
    this.shadows.forEach((s) => s.material.dispose());
    disposeDieMaterial(this.material);
    this.env.dispose();
    this.lease.release();
    this.finish?.();
    this.finish = null;
  }
}
