#!/usr/bin/env node
// Verifies a Kinetic Writer release artifact against the Play 16 KB + R8 gates (DIRECTIVE-01).
//   node scripts/verify-android-artifact.mjs <path/to/app.apk|app.aab>
// 1. `zipalign -c -P 16 -v 4` on APKs (PATH, then the SDK build-tools as in build-android-apk.ps1; skipped cleanly
//    when absent; AABs are aligned per device by bundletool, so it is n/a there).
// 2. Every 64-bit `.so` in the archive: all PT_LOAD p_align >= 0x4000 (parsed in Node, no readelf).
// 3. AAB only: R8 mapping at BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map
//    (warns when missing) and native debug symbols under ...build.debugsymbols/.
// Exit 1 on any failed `.so` or failed zipalign; warnings never fail the run.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { checkElfAlignment, hex, PAGE_16K } from './lib/elf-align.mjs';
import { listZipEntries, readZipEntry } from './lib/zip-read.mjs';

const PROGUARD_MAP = 'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map';
const DEBUG_SYMBOLS = 'BUNDLE-METADATA/com.android.tools.build.debugsymbols/';
const SO_PATH = /(?:^|\/)lib\/([^/]+)\/([^/]+\.so)$/;

function findZipalign() {
  const probe = spawnSync('zipalign', [], { encoding: 'utf8' });
  if (!probe.error) return 'zipalign';
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '');
  const tools = sdk ? join(sdk, 'build-tools') : '';
  if (!tools || !existsSync(tools)) return null;
  const versions = readdirSync(tools).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
  for (const v of versions) {
    for (const exe of ['zipalign.exe', 'zipalign']) {
      const candidate = join(tools, v, exe);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function runZipalign(file, isAab) {
  if (isAab) return { status: 'n/a', detail: 'AAB (bundletool aligns split APKs per device)' };
  const bin = findZipalign();
  if (!bin) return { status: 'skipped', detail: 'zipalign not on PATH or in $ANDROID_HOME' };
  const r = spawnSync(bin, ['-c', '-P', '16', '-v', '4', file], { encoding: 'utf8' });
  const ok = r.status === 0;
  const tail = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split(/\r?\n/).pop() ?? '';
  return { status: ok ? 'pass' : 'fail', detail: `${basename(bin)} -c -P 16 -v 4 → ${tail}` };
}

function pad(s, n) {
  return String(s).padEnd(n);
}

export function verifyArtifact(file) {
  const isAab = extname(file).toLowerCase() === '.aab';
  const zip = readFileSync(file);
  const entries = listZipEntries(zip);
  const rows = [];
  for (const entry of entries) {
    const m = SO_PATH.exec(entry.name);
    if (!m) continue;
    const verdict = checkElfAlignment(readZipEntry(zip, entry), PAGE_16K);
    rows.push({ abi: m[1], lib: m[2], ...verdict });
  }
  const names = new Set(entries.map((e) => e.name));
  const symbols = entries.some((e) => e.name.startsWith(DEBUG_SYMBOLS));
  return {
    file,
    isAab,
    entryCount: entries.length,
    rows,
    zipalign: runZipalign(file, isAab),
    proguardMap: isAab ? names.has(PROGUARD_MAP) : null,
    debugSymbols: isAab ? symbols : null,
  };
}

function report(r) {
  const kind = r.isAab ? 'AAB' : 'APK';
  console.log(`\n${kind} ${r.file} — ${r.entryCount} entries, ${r.rows.length} native libraries`);
  console.log(`zipalign 16 KB: ${r.zipalign.status.toUpperCase()} (${r.zipalign.detail})`);
  console.log(
    `\n${pad('ABI', 12)}${pad('LIBRARY', 46)}${pad('LOADS', 7)}${pad('MIN ALIGN', 11)}RESULT`,
  );
  for (const row of [...r.rows].sort((a, b) => (a.abi + a.lib).localeCompare(b.abi + b.lib))) {
    const result = row.status.toUpperCase() + (row.reason ? ` (${row.reason})` : '');
    console.log(
      `${pad(row.abi, 12)}${pad(row.lib, 46)}${pad(row.loadCount, 7)}${pad(hex(row.minAlign), 11)}${result}`,
    );
  }
  const count = (s) => r.rows.filter((x) => x.status === s).length;
  console.log(
    `\n.so 16 KB ELF: ${count('pass')} pass · ${count('fail')} fail · ${count('skip')} skip (32-bit)`,
  );
  if (r.isAab) {
    console.log(`R8 mapping (${PROGUARD_MAP}): ${r.proguardMap ? 'present' : 'WARN missing'}`);
    console.log(
      `Native debug symbols (${DEBUG_SYMBOLS}): ${r.debugSymbols ? 'present' : 'WARN missing'}`,
    );
  }
  return count('fail') === 0 && r.zipalign.status !== 'fail';
}

const isMain = process.argv[1] && basename(process.argv[1]) === 'verify-android-artifact.mjs';
if (isMain) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: node scripts/verify-android-artifact.mjs <app.apk|app.aab> [...]');
    process.exit(2);
  }
  let ok = true;
  for (const f of files) {
    if (!existsSync(f)) {
      console.error(`not found: ${f}`);
      ok = false;
      continue;
    }
    ok = report(verifyArtifact(f)) && ok;
  }
  console.log(ok ? '\nRESULT: PASS' : '\nRESULT: FAIL');
  process.exit(ok ? 0 : 1);
}
