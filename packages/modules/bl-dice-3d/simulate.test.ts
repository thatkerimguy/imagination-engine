import { describe, expect, it } from 'vitest';
import { FACE_VALUES, describeRoll, pickOutcome } from './faces.ts';
import { multiply, remapRotation, topFaceIndex, type Quat } from './remap.ts';
import { FLOATS_PER_DIE, STEP, recordThrow } from './simulate.ts';
import { schema } from './schema.ts';
import { formatCardSummary } from './card.ts';

const portrait = { halfWidth: 2.9, halfHeight: 5.6 };
const landscape = { halfWidth: 9, halfHeight: 5 };

function finalQuat(rec: ReturnType<typeof recordThrow>, die: number): Quat {
  const o = ((rec.frameCount - 1) * rec.count + die) * FLOATS_PER_DIE;
  const f = rec.frames;
  return [f[o + 3]!, f[o + 4]!, f[o + 5]!, f[o + 6]!];
}

describe('remapRotation', () => {
  it('puts every value on every landed face', () => {
    for (let landed = 0; landed < 6; landed++) {
      for (const value of FACE_VALUES) {
        const r = remapRotation(value, landed);
        // A body already resting with `landed` on top; the visual adds r.
        const bodyUp = restingWith(landed);
        const shown = topFaceIndex(multiply(bodyUp, r));
        expect(FACE_VALUES[shown.index]).toBe(value);
        expect(shown.alignment).toBeCloseTo(1, 6);
      }
    }
  });
});

describe('recordThrow', () => {
  const cases = [
    { bounds: portrait, throwFrom: 'left' as const },
    { bounds: portrait, throwFrom: 'bottom' as const },
    { bounds: landscape, throwFrom: 'right' as const },
  ];
  for (const { bounds, throwFrom } of cases) {
    for (const count of [1, 2, 3]) {
      it(`settles ${count} dice flat inside ${throwFrom}/${bounds.halfWidth}`, () => {
        for (let seed = 1; seed <= 6; seed++) {
          const rec = recordThrow({ count, bounds, throwFrom, seed });
          expect(rec.flatness).toBeGreaterThan(0.97);
          const seconds = rec.frameCount * STEP;
          expect(seconds).toBeGreaterThan(0.8);
          expect(seconds).toBeLessThan(7);
          for (let d = 0; d < count; d++) {
            const o = ((rec.frameCount - 1) * count + d) * FLOATS_PER_DIE;
            expect(Math.abs(rec.frames[o]!)).toBeLessThan(bounds.halfWidth);
            expect(Math.abs(rec.frames[o + 1]!)).toBeLessThan(bounds.halfHeight);
          }
          // Scripted: any target lands face-up once the visual remap is applied.
          const targets = pickOutcome('scripted', [6, 1, 3], count);
          targets.forEach((value, d) => {
            const visual = multiply(finalQuat(rec, d), remapRotation(value, rec.landedFaces[d]!));
            expect(FACE_VALUES[topFaceIndex(visual).index]).toBe(value);
          });
        }
      });
    }
  }

  it('is deterministic for a seed', () => {
    const a = recordThrow({ count: 2, bounds: portrait, throwFrom: 'left', seed: 42 });
    const b = recordThrow({ count: 2, bounds: portrait, throwFrom: 'left', seed: 42 });
    expect(a.frames).toEqual(b.frames);
    expect(a.impacts.length).toBeGreaterThan(2);
  });
});

describe('schema and card', () => {
  it('requires one scripted number per die', () => {
    expect(schema.validate({ count: 3, scriptedNumbers: [6, 6] }).ok).toBe(false);
    expect(schema.validate({ count: 3, outcomeMode: 'random', scriptedNumbers: [6] }).ok).toBe(
      true,
    );
    expect(schema.validate({ scriptedNumbers: [7, 1] }).ok).toBe(false);
  });

  it('summarises for the writer pill', () => {
    const r = schema.validate({ material: 'obsidian' });
    if (!r.ok) throw new Error(r.errors.join());
    expect(formatCardSummary(r.props).title).toBe('🎲 2× D6 · Obsidian');
    expect(formatCardSummary(r.props).subtitle).toBe('Scripted [1, 1] · Auto throw');
    expect(describeRoll([1, 1])).toBe('Snake eyes');
    expect(describeRoll([2, 3, 4])).toBe('2 + 3 + 4 = 9');
  });
});

function restingWith(face: number): Quat {
  // Rotation taking face normal `face` to +Z.
  const s = Math.SQRT1_2;
  const table: Quat[] = [
    [0, -s, 0, s], // +X → +Z
    [0, s, 0, s], // -X → +Z
    [s, 0, 0, s], // +Y → +Z
    [-s, 0, 0, s], // -Y → +Z
    [0, 0, 0, 1], // +Z
    [1, 0, 0, 0], // -Z → +Z
  ];
  return table[face]!;
}
