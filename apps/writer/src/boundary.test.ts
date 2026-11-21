// CLAUDE.md §3.3 "Zero Heavy Imports in Writer": the writer may import only a module's pure
// barrel (meta, schema, formatCardSummary), never renderers, Three.js or physics engines.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WRITER_SRC = resolve(import.meta.dirname);
const WRITER_ROOT = resolve(WRITER_SRC, '..');
const MODULES_DIR = resolve(WRITER_ROOT, '../../packages/modules');

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

function moduleIdOf(specifier: string): string | null {
  const m = /^@kn\/module-([^/]+)/.exec(specifier);
  return m ? m[1]! : null;
}

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

const DOM_API =
  /\b(document|window|navigator|AudioContext|requestAnimationFrame|HTMLElement|IntersectionObserver|DeviceOrientationEvent)\s*[.(]/;
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('imported module barrels', () => {
  const moduleIds = [
    ...new Set(
      writerFiles.flatMap((f) =>
        extractSpecifiers(read(f))
          .map(moduleIdOf)
          .filter((id): id is string => id !== null),
      ),
    ),
  ];

  it('the writer imports every module in packages/modules (all six)', () => {
    const dirs = readdirSync(MODULES_DIR).filter((d) =>
      existsSync(join(MODULES_DIR, d, 'index.ts')),
    );
    expect(dirs.length).toBeGreaterThanOrEqual(6);
    expect([...moduleIds].sort()).toEqual(dirs.sort());
  });

  it.each(moduleIds)('module %s barrel reaches no renderer, tier or 3D code', (id) => {
    const dir = join(MODULES_DIR, id);
    const pkg = JSON.parse(read(join(dir, 'package.json'))) as {
      exports: Record<string, string>;
    };
    const barrel = resolve(dir, pkg.exports['.']!);
    const seen = new Set<string>();
    const bare = new Set<string>();
    const queue = [barrel];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const spec of extractSpecifiers(read(file))) {
        if (spec.startsWith('.')) {
          const target = resolve(dirname(file), spec);
          expect(existsSync(target), `${spec} from ${file}`).toBe(true);
          queue.push(target);
        } else {
          bare.add(spec);
        }
      }
    }
    const names = [...seen].map((f) => relative(dir, f));
    for (const n of names) expect(n).not.toMatch(/(^|\/)(renderer|high|lite)(\.ts)?$/);
    expect(names).toContain(relative(dir, barrel));
    expect([...bare].filter((s) => s !== '@kn/core')).toEqual([]);
    expect([...bare].filter((s) => /^(three|cannon-es)/.test(s))).toEqual([]);
    // Pure barrels: no browser globals reachable from what the writer bundles.
    for (const f of seen) expect(stripComments(read(f)), relative(dir, f)).not.toMatch(DOM_API);
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
      "const r = await import('@kn/module-bl-dice-3d/renderer');",
      "const p = require('@dimforge/rapier3d');",
      "import { x } from '../modules/bl-dice-3d/renderer.ts';",
      "import { ok } from '@kn/core';",
      "import { schema } from '@kn/module-bl-dice-3d';",
    ].join('\n');
    expect(forbiddenSpecifiers(src).sort()).toEqual(
      [
        'three',
        'three/src/math/Vector3.js',
        'cannon-es',
        '@kn/module-bl-dice-3d/renderer',
        '@dimforge/rapier3d',
        '../modules/bl-dice-3d/renderer.ts',
      ].sort(),
    );
  });

  it('does not flag clean sources', () => {
    expect(forbiddenSpecifiers("import { schema } from '@kn/module-bl-dice-3d';")).toEqual([]);
  });
});
