// Monotone cubic (Fritsch–Carlson) path through points, for smooth non-overshooting curves.
export interface Pt {
  x: number;
  y: number;
}

export function monotonePath(pts: readonly Pt[]): string {
  const n = pts.length;
  if (n === 0) return '';
  const f = (v: number): string => v.toFixed(2);
  if (n === 1) return `M${f(pts[0]!.x)} ${f(pts[0]!.y)}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const w = pts[i + 1]!.x - pts[i]!.x || 1e-6;
    dx.push(w);
    m.push((pts[i + 1]!.y - pts[i]!.y) / w);
  }
  const t: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) {
    t.push(m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2);
  }
  t.push(m[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i]! / m[i]!;
    const b = t[i + 1]! / m[i]!;
    const h = Math.hypot(a, b);
    if (h > 3) {
      t[i] = (3 * a * m[i]!) / h;
      t[i + 1] = (3 * b * m[i]!) / h;
    }
  }
  let d = `M${f(pts[0]!.x)} ${f(pts[0]!.y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    const w = dx[i]! / 3;
    d += ` C${f(p.x + w)} ${f(p.y + t[i]! * w)} ${f(q.x - w)} ${f(q.y - t[i + 1]! * w)} ${f(q.x)} ${f(q.y)}`;
  }
  return d;
}
