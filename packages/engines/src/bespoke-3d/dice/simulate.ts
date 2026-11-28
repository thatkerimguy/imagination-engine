// Invisible pre-simulation. Runs the whole throw in memory with cannon-es, records every
// frame, and reports which physical face of each die ended up on top. Playback later replays
// the recording, so what the reader sees is exactly what was measured here.
import {
  Body,
  Box,
  ContactMaterial,
  Material,
  Plane,
  Vec3,
  World,
  type Quaternion,
} from 'cannon-es';
import type { WorldBounds } from '../../shared/webgl-stage.ts';
import { mulberry32 } from './faces.ts';
import { topFaceIndex } from './remap.ts';

export const DIE_SIZE = 0.9;
export const STEP = 1 / 60;
const MAX_SECONDS = 7;
const CEILING = 4.5;
export const FLOATS_PER_DIE = 7;

export interface Impact {
  time: number;
  die: number;
  x: number;
  strength: number;
}

export interface ThrowRecording {
  count: number;
  frameCount: number;
  /** frameCount × count × [px, py, pz, qx, qy, qz, qw] */
  frames: Float32Array;
  impacts: Impact[];
  landedFaces: number[];
  /** Lowest top-face alignment across dice; 1 means perfectly flat. */
  flatness: number;
}

/** Fraction of the half-height the throw is biased downward (0 = centred). */
const LOWER = 0.22;

export interface ThrowSetup {
  count: number;
  bounds: WorldBounds;
  throwFrom: 'left' | 'right' | 'bottom';
  seed: number;
}

export function recordThrow(setup: ThrowSetup, attempts = 8): ThrowRecording {
  let best: ThrowRecording | null = null;
  for (let i = 0; i < attempts; i++) {
    const rec = simulateOnce({ ...setup, seed: setup.seed + i * 7919 });
    if (!best || rec.flatness > best.flatness) best = rec;
    // A die leaning on a wall or another die reads badly; re-throw until all lie flat.
    if (rec.flatness > 0.995) break;
  }
  return best!;
}

function simulateOnce({ count, bounds, throwFrom, seed }: ThrowSetup): ThrowRecording {
  const rand = mulberry32(seed);
  const half = DIE_SIZE / 2;
  const hw = Math.max(bounds.halfWidth - half, 1.2);
  const hh = Math.max(bounds.halfHeight - half, 1.2);
  const world = new World({ gravity: new Vec3(0, 0, -48) });
  const dieMat = new Material('die');
  const floorMat = new Material('floor');
  const wallMat = new Material('wall');
  world.addContactMaterial(
    new ContactMaterial(dieMat, floorMat, { friction: 0.32, restitution: 0.32 }),
  );
  world.addContactMaterial(
    new ContactMaterial(dieMat, wallMat, { friction: 0.1, restitution: 0.55 }),
  );
  world.addContactMaterial(
    new ContactMaterial(dieMat, dieMat, { friction: 0.2, restitution: 0.4 }),
  );

  const plane = (material: Material, pos: Vec3, axis: Vec3, angle: number): Body => {
    const b = new Body({ mass: 0, material, shape: new Plane(), position: pos });
    b.quaternion.setFromAxisAngle(axis, angle);
    return b;
  };
  const X = new Vec3(1, 0, 0);
  const Y = new Vec3(0, 1, 0);
  world.addBody(plane(floorMat, new Vec3(0, 0, 0), X, 0));
  world.addBody(plane(wallMat, new Vec3(0, 0, CEILING), X, Math.PI));
  const walls = {
    left: plane(wallMat, new Vec3(-hw - half, 0, 0), Y, Math.PI / 2),
    right: plane(wallMat, new Vec3(hw + half, 0, 0), Y, -Math.PI / 2),
    bottom: plane(wallMat, new Vec3(0, -hh - half, 0), X, -Math.PI / 2),
    top: plane(wallMat, new Vec3(0, hh + half, 0), X, Math.PI / 2),
  };
  // The entry wall is added only once every die is inside, so dice fly in from off-screen.
  for (const [side, body] of Object.entries(walls)) if (side !== throwFrom) world.addBody(body);
  let entryClosed = false;

  // Aim the whole tumble a little below centre (the cue card's vertical zone), full travel kept.
  const lowY = -hh * LOWER;
  const dice: Body[] = [];
  const impacts: Impact[] = [];
  const lastImpact: number[] = [];
  let time = 0;
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * 1.25 + (rand() - 0.5) * 0.6;
    const speed = 13 + rand() * 4;
    const pos =
      throwFrom === 'bottom'
        ? new Vec3(spread, -hh - 1.6 - i * 0.4, 1.6 + rand())
        : new Vec3(
            (throwFrom === 'left' ? -1 : 1) * (hw + 1.6 + i * 0.4),
            spread + lowY,
            1.6 + rand(),
          );
    const vel =
      throwFrom === 'bottom'
        ? new Vec3((rand() - 0.5) * 5, speed * (hh / hw > 1.3 ? 1.25 : 1) * (1 - LOWER), 4)
        : new Vec3((throwFrom === 'left' ? 1 : -1) * speed, (rand() - 0.5) * 5 + lowY * 1.6, 4);
    const body = new Body({
      mass: 1,
      material: dieMat,
      shape: new Box(new Vec3(half, half, half)),
      position: pos,
      velocity: vel,
      angularVelocity: new Vec3((rand() - 0.5) * 30, (rand() - 0.5) * 30, (rand() - 0.5) * 30),
      linearDamping: 0.08,
      angularDamping: 0.12,
    });
    body.quaternion.setFromEuler(rand() * 6.28, rand() * 6.28, rand() * 6.28);
    lastImpact.push(-1);
    body.addEventListener(
      'collide',
      (e: { contact: { getImpactVelocityAlongNormal(): number } }) => {
        const strength = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (strength < 0.8 || time - lastImpact[i]! < 0.05) return;
        lastImpact[i] = time;
        impacts.push({
          time,
          die: i,
          x: body.position.x / hw,
          strength: Math.min(1, strength / 14),
        });
      },
    );
    world.addBody(body);
    dice.push(body);
  }

  const maxFrames = Math.ceil(MAX_SECONDS / STEP);
  const frames = new Float32Array(maxFrames * count * FLOATS_PER_DIE);
  let frameCount = 0;
  let still = 0;
  while (frameCount < maxFrames) {
    dice.forEach((d, i) => {
      const o = (frameCount * count + i) * FLOATS_PER_DIE;
      frames.set([d.position.x, d.position.y, d.position.z], o);
      frames.set([d.quaternion.x, d.quaternion.y, d.quaternion.z, d.quaternion.w], o + 3);
    });
    frameCount++;
    if (!entryClosed && dice.every((d) => isInside(d.position, hw, hh))) {
      world.addBody(walls[throwFrom]);
      entryClosed = true;
    }
    const resting =
      entryClosed &&
      dice.every((d) => d.velocity.length() < 0.06 && d.angularVelocity.length() < 0.08);
    still = resting ? still + 1 : 0;
    if (still >= 12) break;
    world.step(STEP);
    time += STEP;
  }

  let flatness = 1;
  const landedFaces = dice.map((d) => {
    const top = topFaceIndex(quatOf(d.quaternion));
    flatness = Math.min(flatness, top.alignment);
    return top.index;
  });
  if (still < 12) flatness = Math.min(flatness, 0.5);
  return {
    count,
    frameCount,
    frames: frames.slice(0, frameCount * count * FLOATS_PER_DIE),
    impacts,
    landedFaces,
    flatness,
  };
}

function isInside(p: Vec3, hw: number, hh: number): boolean {
  return Math.abs(p.x) < hw && Math.abs(p.y) < hh;
}

function quatOf(q: Quaternion): [number, number, number, number] {
  return [q.x, q.y, q.z, q.w];
}
