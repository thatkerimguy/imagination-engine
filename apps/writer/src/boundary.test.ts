// CLAUDE.md §3.3 "Zero Heavy Imports in Writer": the writer may import only a module's pure
// barrel (meta, schema, formatCardSummary), never renderers, Three.js or physics engines.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WRITER_SRC = resolve(import.meta.dirname);
const WRITER_ROOT = resolve(WRITER_SRC, '..');

const SPECIFIER_RES = [
  /\bimport\s+(?:type\s+)?(?:[\w*${}\s,]+?\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:type\s+)?(?:[\w*${}\s,]+?\s+)?from\s+['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
];

export function extractSpecifiers(source: string): string[] {
  const found = new Set<string>();
  for (const re of SPECIFIER_RES) {
    for (const m of source.matchAll(re)) found.add(m[1]!);
  }
  return [...found];
}

const FORBIDDEN: readonly RegExp[] = [
  /^three(\/|$)/,
  /^cannon-es(\/|$)/,
  /^@dimforge\//,
  /^@kn\/core\/renderer/,
  // Engines are web-only runtime code; the writer may read only the pure blueprint data.
  /^@kn\/engines(?!\/blueprints$)/,
  /^@kn\/module-[^/]+\/renderer/,
  /(^|\/)renderer(\.ts)?$/,
];

export function forbiddenSpecifiers(source: string): string[] {
  return extractSpecifiers(source).filter((s) => FORBIDDEN.some((re) => re.test(s)));
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

const writerFiles = walk(WRITER_SRC);
const read = (file: string) => readFileSync(file, 'utf8');

describe('writer source imports', () => {
  it('scans a meaningful number of files', () => {
    expect(writerFiles.length).toBeGreaterThan(20);
  });

  it('never imports Three.js, physics engines or renderers', () => {
    const offenders = writerFiles.flatMap((f) =>
      forbiddenSpecifiers(read(f)).map((s) => `${relative(WRITER_SRC, f)} -> ${s}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('writer package.json', () => {
  it('has no three or cannon-es dependency', () => {
    const pkg = JSON.parse(read(join(WRITER_ROOT, 'package.json'))) as Record<
      string,
      Record<string, string> | undefined
    >;
    const all = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    });
    expect(all.filter((d) => /^(three|cannon-es|@dimforge\/)/.test(d))).toEqual([]);
  });
});

describe('scanner self-test', () => {
  it('catches forbidden specifiers in every import form', () => {
    const src = [
      "import * as THREE from 'three';",
      "import { Vector3 } from 'three/src/math/Vector3.js';",
      "export { World } from 'cannon-es';",
      "const r = await import('@kn/engines/renderer');",
      "const p = require('@dimforge/rapier3d');",
      "import { x } from '../modules/bl-dice-3d/renderer.ts';",
      "import { ok } from '@kn/core';",
    ].join('\n');
    expect(forbiddenSpecifiers(src).sort()).toEqual(
      [
        'three',
        'three/src/math/Vector3.js',
        'cannon-es',
        '@kn/engines/renderer',
        '@dimforge/rapier3d',
        '../modules/bl-dice-3d/renderer.ts',
      ].sort(),
    );
  });

  it('does not flag clean sources', () => {
    expect(forbiddenSpecifiers("import { b } from '@kn/engines/blueprints';")).toEqual([]);
  });
});
