/**
 * Signed distance fields from coverage, after Mapbox's TinySDF: an exact Euclidean distance
 * transform (Felzenszwalb & Huttenlocher) run once for the outside and once for the inside, with
 * partial coverage at the edge turned into sub-pixel offsets. One channel, so it works from any
 * font the browser can draw, Turkish letters included, with no font file to parse.
 */

const INF = 1e20;

/** In-place squared-distance transform of a grid (0 at features, INF elsewhere). */
export function distanceTransform(grid: Float64Array, width: number, height: number): void {
  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const z = new Float64Array(size + 1);
  const v = new Uint16Array(size);
  for (let x = 0; x < width; x++) edt1d(grid, x, width, height, f, v, z);
  for (let y = 0; y < height; y++) edt1d(grid, y * width, 1, width, f, v, z);
}

function edt1d(
  grid: Float64Array,
  offset: number,
  stride: number,
  length: number,
  f: Float64Array,
  v: Uint16Array,
  z: Float64Array,
): void {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset] ?? INF;
  for (let q = 1, k = 0; q < length; q++) {
    f[q] = grid[offset + q * stride] ?? INF;
    const q2 = q * q;
    let s: number;
    do {
      const r = v[k] ?? 0;
      s = ((f[q] ?? 0) - (f[r] ?? 0) + q2 - r * r) / (q - r) / 2;
    } while (s <= (z[k] ?? 0) && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while ((z[k + 1] ?? INF) < q) k++;
    const r = v[k] ?? 0;
    grid[offset + q * stride] = (f[r] ?? 0) + (q - r) * (q - r);
  }
}

/**
 * An SDF from 8-bit coverage (alpha). 255 is deep inside, 0 is `radius` pixels or more outside,
 * and the edge sits at `255 * (1 - cutoff)`.
 */
export function sdfFromCoverage(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  radius: number,
  cutoff = 0.25,
): Uint8ClampedArray {
  const n = width * height;
  const outer = new Float64Array(n);
  const inner = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = (alpha[i] ?? 0) / 255;
    if (a >= 1) {
      outer[i] = 0;
      inner[i] = INF;
    } else if (a <= 0) {
      outer[i] = INF;
      inner[i] = 0;
    } else {
      // Partly covered: the edge passes through this pixel, offset by the coverage.
      const d = 0.5 - a;
      outer[i] = d > 0 ? d * d : 0;
      inner[i] = d < 0 ? d * d : 0;
    }
  }
  distanceTransform(outer, width, height);
  distanceTransform(inner, width, height);
  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(outer[i] ?? 0) - Math.sqrt(inner[i] ?? 0);
    out[i] = Math.round(255 - 255 * (d / radius + cutoff));
  }
  return out;
}
