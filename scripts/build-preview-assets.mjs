// `pnpm build:preview-assets`: builds apps/reader (split ES-module chunks, relative `./` base)
// and copies the dist into the Android app's assets/reader/ (git-ignored, under android/), where
// KnReaderWebView serves it via WebViewAssetLoader at https://appassets.androidplatform.net/reader/.
// Run after `expo prebuild --clean` (which wipes android/); `pnpm android:prebuild` chains it.
//
//   node scripts/build-preview-assets.mjs            build the reader, then copy
//   node scripts/build-preview-assets.mjs --no-build copy an existing apps/reader/dist
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/reader/dist');
const OUT = join(ROOT, 'apps/writer/android/app/src/main/assets/reader');
// Preview data arrives over the bridge: no sample novels, sandbox pages or source maps.
const SKIP = [/^novels[\\/]/, /^sandbox[\\/]/, /^assets[\\/]sandbox-/, /\.map$/];

if (!process.argv.includes('--no-build')) {
  // Build through the reader's own package so its dependencies (workbox-window, pulled in by
  // vite-plugin-pwa's virtual module) resolve from apps/reader, whatever the caller's cwd.
  const r = spawnSync('pnpm --filter @kn/reader build', {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) throw new Error(`[preview-assets] reader build failed (exit ${r.status})`);
}
if (!existsSync(join(DIST, 'index.html'))) throw new Error('[preview-assets] no reader build');
if (!existsSync(join(ROOT, 'apps/writer/android'))) {
  console.log('[preview-assets] apps/writer/android/ missing: run `expo prebuild` first; skipped');
  process.exit(0);
}

// `expo prebuild --clean` wipes android/local.properties: restore sdk.dir so gradlew works.
const LOCAL_PROPS = join(ROOT, 'apps/writer/android/local.properties');
const SDK =
  process.env.ANDROID_HOME ??
  process.env.ANDROID_SDK_ROOT ??
  (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '');
if (!existsSync(LOCAL_PROPS) && SDK && existsSync(SDK)) {
  writeFileSync(LOCAL_PROPS, `sdk.dir=${SDK.replaceAll('\\', '/')}\n`);
  console.log(`[preview-assets] restored ${relative(ROOT, LOCAL_PROPS)} (sdk.dir)`);
}

rmSync(OUT, { recursive: true, force: true });
let files = 0;
let bytes = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(DIST, full);
    if (statSync(full).isDirectory()) walk(full);
    else if (!SKIP.some((re) => re.test(rel))) {
      mkdirSync(dirname(join(OUT, rel)), { recursive: true });
      cpSync(full, join(OUT, rel));
      files++;
      bytes += statSync(full).size;
    }
  }
};
walk(DIST);
const lazy = readdirSync(join(OUT, 'assets/lazy')).filter((f) => f.endsWith('.js')).length;
console.log(
  `[preview-assets] ${files} files (${(bytes / 1024).toFixed(1)} KB, ${lazy} lazy chunks) → ${relative(ROOT, OUT)}`,
);
