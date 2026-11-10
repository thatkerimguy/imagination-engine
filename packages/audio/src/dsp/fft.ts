/**
 * In-place radix-2 FFT. One instance per size keeps its twiddle and bit-reversal tables, so
 * analysing thousands of frames allocates nothing per frame.
 */
export class FFT {
  readonly size: number;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;
  private readonly reverse: Uint32Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) throw new Error('FFT size must be a power of two.');
    this.size = size;
    this.cos = new Float64Array(size / 2);
    this.sin = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((-2 * Math.PI * i) / size);
      this.sin[i] = Math.sin((-2 * Math.PI * i) / size);
    }
    this.reverse = new Uint32Array(size);
    const bits = Math.log2(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.reverse[i] = r;
    }
    this.re = new Float64Array(size);
    this.im = new Float64Array(size);
  }

  /** Power spectrum |X[k]|² for k = 0..size/2 of a real frame (already windowed). */
  power(frame: ArrayLike<number>, out = new Float32Array(this.size / 2 + 1)): Float32Array {
    const { size, re, im, reverse } = this;
    for (let i = 0; i < size; i++) {
      re[reverse[i] ?? 0] = frame[i] ?? 0;
      im[i] = 0;
    }
    this.transform();
    for (let k = 0; k <= size / 2; k++) out[k] = (re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2;
    return out;
  }

  /** Complex FFT of (re, im), returned as new arrays. For tests and small inputs. */
  complex(
    inRe: ArrayLike<number>,
    inIm: ArrayLike<number>,
  ): { re: Float64Array; im: Float64Array } {
    for (let i = 0; i < this.size; i++) {
      const r = this.reverse[i] ?? 0;
      this.re[r] = inRe[i] ?? 0;
      this.im[r] = inIm[i] ?? 0;
    }
    this.transform();
    return { re: this.re.slice(), im: this.im.slice() };
  }

  private transform(): void {
    const { size, re, im, cos, sin } = this;
    for (let half = 1; half < size; half *= 2) {
      const step = size / (half * 2);
      for (let start = 0; start < size; start += half * 2) {
        for (let k = 0; k < half; k++) {
          const wr = cos[k * step] ?? 1;
          const wi = sin[k * step] ?? 0;
          const a = start + k;
          const b = a + half;
          const br = re[b] ?? 0;
          const bi = im[b] ?? 0;
          const tr = wr * br - wi * bi;
          const ti = wr * bi + wi * br;
          re[b] = (re[a] ?? 0) - tr;
          im[b] = (im[a] ?? 0) - ti;
          re[a] = (re[a] ?? 0) + tr;
          im[a] = (im[a] ?? 0) + ti;
        }
      }
    }
  }
}

/** A periodic Hann window. */
export function hann(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  return w;
}
