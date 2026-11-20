// Face remapping, the trick behind scripted outcomes: physics decides which *physical* face of
// each die lands up; we then rotate the die's visual mesh inside its body by a cube symmetry so
// the face carrying the Author's number sits exactly where that physical face is. Because the
// rotation is a symmetry of the cube, the silhouette and every contact stay identical.
import { FACE_NORMALS, faceIndexOf } from './faces.ts';

export type Quat = readonly [number, number, number, number]; // x, y, z, w
export type Vec3 = readonly [number, number, number];

const IDENTITY: Quat = [0, 0, 0, 1];

export function rotate(q: Quat, v: Vec3): Vec3 {
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  // t = 2 * cross(q.xyz, v); v' = v + w * t + cross(q.xyz, t)
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

export function multiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    ax * bw + aw * bx + ay * bz - az * by,
    ay * bw + aw * by + az * bx - ax * bz,
    az * bw + aw * bz + ax * by - ay * bx,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Index of the face whose world normal points most along +Z (towards the reader). */
export function topFaceIndex(q: Quat): { index: number; alignment: number } {
  let index = 0;
  let alignment = -Infinity;
  FACE_NORMALS.forEach((n, i) => {
    const z = rotate(q, n)[2];
    if (z > alignment) {
      alignment = z;
      index = i;
    }
  });
  return { index, alignment };
}

/** A cube-symmetry rotation taking the face showing `value` onto local face `landedFace`. */
export function remapRotation(value: number, landedFace: number): Quat {
  const from = FACE_NORMALS[faceIndexOf(value)]!;
  const to = FACE_NORMALS[landedFace]!;
  const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
  if (dot > 0.5) return IDENTITY;
  if (dot < -0.5) {
    // Opposite faces: half-turn about any axis perpendicular to both, which is always another
    // face axis, so the result stays a cube symmetry.
    const axis = FACE_NORMALS.find((n) => n[0] * from[0] + n[1] * from[1] + n[2] * from[2] === 0)!;
    return [axis[0], axis[1], axis[2], 0];
  }
  const s = Math.SQRT1_2;
  const ax = from[1] * to[2] - from[2] * to[1];
  const ay = from[2] * to[0] - from[0] * to[2];
  const az = from[0] * to[1] - from[1] * to[0];
  return [ax * s, ay * s, az * s, s];
}
