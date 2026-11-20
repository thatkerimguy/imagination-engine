// High tier: replays the pre-simulated throw on the shared WebGL stage with PBR dice, an
// invisible shadow catcher, and clatter scheduled from recorded impacts.
import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  ShadowMaterial,
  type WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { AudioBusAccess, GLStageLease } from '@kn/core/renderer';
import { FACE_VALUES, pickOutcome } from './faces.ts';
import { createDieMaterial, disposeDieMaterial, roundedCube } from './dice-mesh.ts';
import { remapRotation } from './remap.ts';
import { scheduleClatter } from './sfx.ts';
import { DIE_SIZE, FLOATS_PER_DIE, STEP, recordThrow, type ThrowRecording } from './simulate.ts';
import type { DiceProps } from './schema.ts';

const LIFT_SECONDS = 0.7;

export class HighDice {
  private readonly group = new Group();
  private readonly env: WebGLRenderTarget;
  private readonly material;
  private readonly geometry = roundedCube(DIE_SIZE, 0.12, 7);
  private readonly shadowMat = new ShadowMaterial({ opacity: 0.32, transparent: true });
  private readonly shadowGeo = new PlaneGeometry(1, 1);
  private readonly meshes: Mesh[] = [];
  private readonly remaps: Quaternion[] = [];
  private unsubscribe: (() => void) | null = null;
  private cancelSound: (() => void) | null = null;
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

    const b = lease.bounds();
    const floor = new Mesh(this.shadowGeo, this.shadowMat);
    floor.scale.set(b.halfWidth * 2 + 4, b.halfHeight * 2 + 4, 1);
    floor.receiveShadow = true;
    const key = new DirectionalLight(0xffffff, 2.4);
    key.position.set(-3.5, 5, 13);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 5;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    const cam = key.shadow.camera;
    cam.left = -b.halfWidth - 1;
    cam.right = b.halfWidth + 1;
    cam.top = b.halfHeight + 1;
    cam.bottom = -b.halfHeight - 1;
    cam.near = 1;
    cam.far = 30;
    this.group.add(floor, key, key.target, new AmbientLight(0xffffff, 0.45));
    for (let i = 0; i < props.count; i++) {
      const die = new Mesh(this.geometry, this.material);
      die.castShadow = true;
      die.visible = false;
      this.meshes.push(die);
      this.group.add(die);
    }
    lease.scene.add(this.group);
    // Compile now, so the first thrown frame does not stall on shader compilation.
    lease.renderer.compile(lease.scene, lease.camera);
  }

  /** Plays the throw; resolves with the face values once the dice have settled. */
  play(onSettled: (values: number[]) => void): Promise<void> {
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
    const liftAt = settleAt + props.holdSeconds;

    return new Promise<void>((resolve) => {
      let t = 0;
      let settled = false;
      const q = new Quaternion();
      const q2 = new Quaternion();
      this.meshes.forEach((m) => (m.visible = true));
      this.applyFrame(rec, 0, q, q2);
      this.unsubscribe = this.lease.onFrame((dt) => {
        // Clamp so a backgrounded tab resumes smoothly instead of teleporting.
        t += Math.min(dt, 1 / 20);
        if (t <= settleAt) this.applyFrame(rec, t, q, q2);
        else if (!settled) {
          settled = true;
          this.applyFrame(rec, settleAt, q, q2);
          onSettled(values);
          navigator.vibrate?.(12);
          resolve();
        } else if (t > liftAt) {
          const k = Math.min(1, (t - liftAt) / LIFT_SECONDS);
          const ease = k * k * (3 - 2 * k);
          this.meshes.forEach((m) => (m.position.z += ease * 0.12));
          this.material.opacity = 1 - ease;
          this.shadowMat.opacity = 0.32 * (1 - ease);
          if (k >= 1) this.dispose();
        }
      });
    });
  }

  private applyFrame(rec: ThrowRecording, t: number, q: Quaternion, q2: Quaternion): void {
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
      mesh.quaternion.slerpQuaternions(q, q2, a).multiply(this.remaps[d] ?? q.identity());
    });
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe?.();
    this.cancelSound?.();
    this.group.traverse((o) => {
      // The shadow target's depth texture is not freed by the target itself in three r18x.
      if (o instanceof DirectionalLight) {
        o.shadow.map?.depthTexture?.dispose();
        o.shadow.dispose();
      }
    });
    this.lease.scene.remove(this.group);
    this.geometry.dispose();
    this.shadowGeo.dispose();
    this.shadowMat.dispose();
    disposeDieMaterial(this.material);
    this.env.dispose();
    this.lease.release();
  }
}
