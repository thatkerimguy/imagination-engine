import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { drumHits } from './hits.ts';
import { loadDemucs } from './separate.ts';

/**
 * Runs the real 180 MB HTDemucs export when `IE_DEMUCS_MODEL` points at a downloaded copy
 * (ADR 0028). Skipped otherwise, so `pnpm check` never downloads it.
 */
const path = process.env.IE_DEMUCS_MODEL;
const RATE = 44_100;

/** Eight seconds: a kick-and-snare pattern every half second over a held chord. */
function song(): { left: Float32Array; right: Float32Array; hits: number[] } {
  const length = RATE * 8;
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const hits: number[] = [];
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < length; i++) {
    const t = i / RATE;
    const chord =
      0.12 * Math.sin(2 * Math.PI * 220 * t) +
      0.08 * Math.sin(2 * Math.PI * 277.2 * t) +
      0.08 * Math.sin(2 * Math.PI * 329.6 * t);
    left[i] = chord;
    right[i] = chord;
  }
  for (let beat = 0.25; beat < 7.8; beat += 0.5) {
    hits.push(beat);
    const at = Math.round(beat * RATE);
    const snare = Math.round(beat * 2) % 2 === 1;
    for (let i = 0; i < RATE * 0.15; i++) {
      const t = i / RATE;
      const env = Math.exp(-t * (snare ? 30 : 20));
      const body = snare
        ? 0.5 * noise() + 0.3 * Math.sin(2 * Math.PI * 190 * t)
        : 0.9 * Math.sin(2 * Math.PI * (50 + 100 * Math.exp(-t * 40)) * t);
      const v = body * env;
      left[at + i] = (left[at + i] ?? 0) + v;
      right[at + i] = (right[at + i] ?? 0) + v;
    }
  }
  return { left, right, hits };
}

function rms(x: Float32Array, from = 0, to = x.length): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += (x[i] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, to - from));
}

describe.skipIf(!path)('HTDemucs export (real model)', () => {
  // Node's fetch can't read file URLs, which is where onnxruntime-web finds its wasm here.
  const fetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith('file:')) return fetch(input, init);
    const body = readFileSync(fileURLToPath(url));
    return Promise.resolve(new Response(body, { headers: { 'content-type': 'application/wasm' } }));
  };

  it('separates drums from a chord and finds the hits', async () => {
    // Point onnxruntime at its own files; in Node it would otherwise import them from blob URLs.
    const ort = await import('onnxruntime-web/webgpu');
    const dist = dirname(createRequire(import.meta.url).resolve('onnxruntime-web/webgpu'));
    ort.env.wasm.wasmPaths = `${pathToFileURL(dist).href}/`;
    ort.env.wasm.numThreads = 1;
    const bytes = readFileSync(path ?? '');
    const runner = await loadDemucs(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const { left, right, hits } = song();
    const stems = await runner.separate(left, right);
    const drums = stems.drums;
    const other = stems.other;
    const bass = stems.bass;
    if (!drums || !other || !bass) throw new Error('missing stems');

    // Between hits the drum stem is much quieter than the chord stems.
    const quiet = (x: Float32Array) => {
      let sum = 0;
      for (const hit of hits)
        sum += rms(x, Math.round((hit + 0.3) * RATE), Math.round((hit + 0.45) * RATE));
      return sum / hits.length;
    };
    const tonal = quiet(other.left) + quiet(bass.left);
    console.info(
      'provider',
      runner.provider,
      'drum rms',
      rms(drums.left),
      'gap: drums',
      quiet(drums.left),
      'tonal',
      tonal,
    );
    expect(quiet(drums.left)).toBeLessThan(tonal * 0.5);

    const found = drumHits(drums.left, RATE);
    console.info('hits', found.length, found.slice(0, 6));
    const matched = hits.filter((h) => found.some((f) => Math.abs(f - h) < 0.05));
    expect(matched.length).toBeGreaterThanOrEqual(hits.length * 0.8);
    expect(found.length).toBeLessThanOrEqual(hits.length * 1.5);
  }, 600_000);
});
