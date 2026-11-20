// Rounded-bevel d6 with recessed pips: one shared geometry, one atlas texture + bump map per
// material, so N dice cost N draw calls and two textures.
import {
  BoxGeometry,
  CanvasTexture,
  MeshPhysicalMaterial,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from 'three';
import { FACE_VALUES, PIPS } from './faces.ts';
import { FINISHES, type Finish } from './palette.ts';
import type { DiceMaterial } from './schema.ts';

export function roundedCube(size: number, radius: number, segments = 8): BoxGeometry {
  const geo = new BoxGeometry(size, size, size, segments, segments, segments);
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  const inner = size / 2 - radius;
  const p = new Vector3();
  const core = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    core.set(clamp(p.x, inner), clamp(p.y, inner), clamp(p.z, inner));
    const d = p.sub(core);
    if (d.lengthSq() > 1e-10) {
      d.normalize();
      nor.setXYZ(i, d.x, d.y, d.z);
      d.multiplyScalar(radius).add(core);
      pos.setXYZ(i, d.x, d.y, d.z);
    }
  }
  // Point each face's UVs at its cell in a 3×2 atlas. Box faces never share vertices.
  geo.groups.forEach((g, face) => {
    const col = face % 3;
    const row = Math.floor(face / 3);
    const seen = new Set<number>();
    for (let i = g.start; i < g.start + g.count; i++) seen.add(geo.index!.getX(i));
    for (const v of seen) uv.setXY(v, (col + uv.getX(v)) / 3, 1 - (row + 1) / 2 + uv.getY(v) / 2);
  });
  pos.needsUpdate = nor.needsUpdate = uv.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

function clamp(v: number, m: number): number {
  return Math.max(-m, Math.min(m, v));
}

const CELL = 256;

function drawAtlas(finish: Finish, bump: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * 3;
  canvas.height = CELL * 2;
  const g = canvas.getContext('2d')!;
  FACE_VALUES.forEach((value, face) => {
    const x0 = (face % 3) * CELL;
    const y0 = Math.floor(face / 3) * CELL;
    g.fillStyle = bump ? '#ffffff' : finish.body;
    g.fillRect(x0, y0, CELL, CELL);
    if (!bump && finish.grain > 0) {
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${finish.grain * Math.random()})`;
        g.fillRect(x0 + Math.random() * CELL, y0 + Math.random() * CELL, 2, 2);
      }
    }
    const r = value === 1 ? CELL * 0.11 : CELL * 0.085;
    for (const [px, py] of PIPS[value]!) {
      const cx = x0 + CELL / 2 + px * CELL * 0.31;
      const cy = y0 + CELL / 2 + py * CELL * 0.31;
      const grad = g.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
      if (bump) {
        // Dark = deep: a bowl-shaped dimple with a soft rim.
        grad.addColorStop(0, '#202020');
        grad.addColorStop(0.75, '#606060');
        grad.addColorStop(1, '#ffffff');
      } else {
        grad.addColorStop(0, finish.pip);
        grad.addColorStop(0.8, finish.pip);
        grad.addColorStop(1, shade(finish.body, -0.35));
      }
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
  });
  return canvas;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number): number => Math.max(0, Math.min(255, Math.round(c * (1 + amount))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function createDieMaterial(
  kind: DiceMaterial,
  envMap: Texture | null,
): MeshPhysicalMaterial {
  const finish = FINISHES[kind];
  const map = new CanvasTexture(drawAtlas(finish, false));
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  const bumpMap = new CanvasTexture(drawAtlas(finish, true));
  return new MeshPhysicalMaterial({
    map,
    bumpMap,
    bumpScale: 2.2,
    roughness: finish.roughness,
    metalness: finish.metalness,
    clearcoat: finish.clearcoat,
    clearcoatRoughness: 0.08,
    envMap,
    envMapIntensity: kind === 'brass' ? 1.1 : kind === 'ivory' ? 0.55 : 0.7,
    transparent: true,
  });
}

export function disposeDieMaterial(m: MeshPhysicalMaterial): void {
  m.map?.dispose();
  m.bumpMap?.dispose();
  m.dispose();
}
