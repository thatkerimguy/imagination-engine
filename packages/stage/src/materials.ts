import type { CompiledMaterial } from '@ie/material';
import type { MaterialParam } from '@ie/story';
import { MATERIAL_PARAMS } from './material-shaders.ts';

interface Ramp {
  readonly from: number;
  readonly to: number;
  readonly seconds: number;
  t: number;
}

interface Entry {
  compiled: CompiledMaterial;
  params: readonly MaterialParam[];
  readonly values: Float32Array;
  readonly ramps: (Ramp | null)[];
}

const clampTo = (p: MaterialParam, v: number) => Math.min(p.max, Math.max(p.min, v));

/**
 * The materials the stage knows (ADR 0020), their live parameter values and ramps, and which one
 * is the post material. Parameter values are presentation: `reset` puts them back to defaults
 * after a load or a rewind. Allocation-free per frame.
 */
export class StageMaterials {
  private readonly entries = new Map<string, Entry>();
  private post: string | null = null;
  private ramping = 0;

  /** Adds or updates a material. Parameters that keep their id keep their current value. */
  use(compiled: CompiledMaterial, params: readonly MaterialParam[]): void {
    const old = this.entries.get(compiled.id);
    const values = new Float32Array(MATERIAL_PARAMS);
    const ramps: (Ramp | null)[] = Array<Ramp | null>(MATERIAL_PARAMS).fill(null);
    params.slice(0, MATERIAL_PARAMS).forEach((p, i) => {
      const before = old?.params.findIndex((q) => q.id === p.id) ?? -1;
      values[i] = before >= 0 ? clampTo(p, old?.values[before] ?? p.default) : p.default;
    });
    this.entries.set(compiled.id, { compiled, params, values, ramps });
    this.countRamps();
  }

  get(id: string | null | undefined, domain: CompiledMaterial['domain']): Entry | undefined {
    if (!id) return undefined;
    const entry = this.entries.get(id);
    return entry?.compiled.domain === domain ? entry : undefined;
  }

  setPost(id: string | null): void {
    this.post = id;
  }

  /** The post material to draw this frame, if one is set and known. */
  get postEntry(): Entry | undefined {
    return this.get(this.post, 'post');
  }

  /** Sets a parameter now, or ramps it from `value` to `to` over `seconds`. */
  setParam(id: string, param: string, value: number, to?: number, seconds?: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    const i = entry.params.findIndex((p) => p.id === param);
    const spec = entry.params[i];
    if (!spec || i >= MATERIAL_PARAMS) return;
    const from = clampTo(spec, value);
    entry.values[i] = from;
    entry.ramps[i] =
      to !== undefined && seconds && seconds > 0
        ? { from, to: clampTo(spec, to), seconds, t: 0 }
        : null;
    this.countRamps();
  }

  /** True while a parameter is ramping (the stage keeps drawing at full rate). */
  get animating(): boolean {
    return this.ramping > 0;
  }

  update(dt: number): void {
    if (this.ramping === 0) return;
    for (const entry of this.entries.values())
      for (let i = 0; i < entry.ramps.length; i++) {
        const ramp = entry.ramps[i];
        if (!ramp) continue;
        ramp.t = Math.min(1, ramp.t + dt / ramp.seconds);
        entry.values[i] = ramp.from + (ramp.to - ramp.from) * ramp.t;
        if (ramp.t >= 1) {
          entry.ramps[i] = null;
          this.ramping--;
        }
      }
  }

  /** Every parameter back to its default, with no ramps (a load, a rewind). */
  reset(): void {
    for (const entry of this.entries.values()) {
      entry.params.slice(0, MATERIAL_PARAMS).forEach((p, i) => {
        entry.values[i] = p.default;
      });
      entry.ramps.fill(null);
    }
    this.ramping = 0;
  }

  private countRamps(): void {
    let n = 0;
    for (const entry of this.entries.values()) for (const r of entry.ramps) if (r) n++;
    this.ramping = n;
  }
}
