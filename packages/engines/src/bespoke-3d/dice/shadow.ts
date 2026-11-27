// Per-die contact shadow: a soft radial blob on the page plane, shaped by the die's height
// (see shadowFor). Cheaper than a shadow map on mobile GPUs and never a hard-edged silhouette.
import type { PlaneGeometry } from 'three';
import { CanvasTexture, Mesh, MeshBasicMaterial, type Vector3 } from 'three';
import { DIE_SIZE } from './simulate.ts';

export function blobTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

export function createShadow(
  geometry: PlaneGeometry,
  texture: CanvasTexture,
): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const mat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new Mesh(geometry, mat);
  mesh.renderOrder = -1;
  return mesh;
}

/** Places a die's shadow under it, offset away from the key light (up-left). */
export function updateShadow(
  shadow: Mesh<PlaneGeometry, MeshBasicMaterial>,
  die: Vector3,
  fade: number,
): void {
  const s = shadowFor(die.z - DIE_SIZE / 2);
  shadow.position.set(die.x + s.offset, die.y - s.offset, 0.002);
  shadow.scale.setScalar(DIE_SIZE * s.scale);
  shadow.material.opacity = s.opacity * fade;
}

/** Contact-shadow strength by height above the page: soft and faint in the air, firm on landing. */
export function shadowFor(height: number): { opacity: number; scale: number; offset: number } {
  const h = Math.max(0, height);
  return { opacity: 0.55 / (1 + h * 1.4), scale: 1.75 + h * 0.55, offset: 0.16 + h * 0.45 };
}
