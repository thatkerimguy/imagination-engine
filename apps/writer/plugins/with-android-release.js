// Local Expo config plugin: release-only Android hardening, reproducible across
// `expo prebuild --clean` (DIRECTIVE-01, Android 16 / Play 2026 gates).
//  1. Release builds ship native debug symbols (`ndk.debugSymbolLevel = "SYMBOL_TABLE"`) so the
//     Play Console can symbolicate native crashes from the AAB.
//  2. SYSTEM_ALERT_WINDOW stays debug/dev-client only: dropped from the main manifest (the RN
//     template keeps its own copy in src/debug) and removed again by a release overlay manifest,
//     together with MANAGE_EXTERNAL_STORAGE / CAMERA / RECORD_AUDIO, whatever a library declares.
//  3. Back gesture (DIRECTIVE-06A, RN #58407): `android:enableOnBackInvokedCallback` is stripped
//     entirely. "true" routes API 33-35 edge swipes through OnBackInvokedDispatcher while
//     ReactActivity only registers its OnBackPressedCallback on SDK_INT >= 36, so the app
//     finish()es on every back swipe. Omitted, API 33-35 keep legacy onBackPressed() and
//     targetSdk 36 turns predictive back on natively for Android 16+.
//  4. Auto Backup / device-transfer exclusions (DIRECTIVE-02): see android-backup-rules.js.
//  5. Nav-bar icon appearance + hardware-keyboard shortcuts (DIRECTIVE-03): see android-input.js.
//  6. Verified App Links, `autoVerify` intent filter (DIRECTIVE-04): see android-app-links.js.
//  7. Home-screen writing widget, Master Lock-redacted (DIRECTIVE-07): see android-widget.js.
const fs = require('fs');
const path = require('path');
const {
  withAppBuildGradle,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');
const withBackupRules = require('./android-backup-rules');
const withAndroidInput = require('./android-input');
const withAppLinks = require('./android-app-links');
const withAndroidWidget = require('./android-widget');

const MARK = '// kn-android-release';
const DEBUG_ONLY = ['android.permission.SYSTEM_ALERT_WINDOW'];
const RELEASE_REMOVED = [
  ...DEBUG_ONLY,
  'android.permission.MANAGE_EXTERNAL_STORAGE',
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
];

const DEBUG_SYMBOLS = `
            ${MARK}: ship native symbol tables in the AAB for Play Console crash symbolication.
            ndk {
                debugSymbolLevel 'SYMBOL_TABLE'
            }`;

const releaseManifest = () =>
  [
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
    '    xmlns:tools="http://schemas.android.com/tools">',
    '    <!-- kn-android-release: permissions that must never reach a release build. -->',
    ...RELEASE_REMOVED.map(
      (p) => `    <uses-permission android:name="${p}" tools:node="remove" />`,
    ),
    '</manifest>',
    '',
  ].join('\n');

function withDebugSymbols(config) {
  return withAppBuildGradle(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (cfg.modResults.language !== 'groovy')
      throw new Error('with-android-release: Groovy app/build.gradle expected');
    if (!src.includes(MARK)) {
      const anchor = /buildTypes\s*\{[\s\S]*?\n(\s*)release\s*\{/;
      if (!anchor.test(src)) throw new Error('with-android-release: release buildType not found');
      cfg.modResults.contents = src.replace(anchor, (m) => m + DEBUG_SYMBOLS);
    }
    return cfg;
  });
}

function withReleaseManifestPolicy(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const perms = manifest['uses-permission'] || [];
    manifest['uses-permission'] = perms.filter(
      (p) => !DEBUG_ONLY.includes(p.$ && p.$['android:name']),
    );
    const app = manifest.application && manifest.application[0];
    if (!app) throw new Error('with-android-release: <application> not found');
    stripBackInvokedCallback(manifest);
    return cfg;
  });
}

const BACK_ATTR = 'android:enableOnBackInvokedCallback';

/** Removes the back-dispatch opt-in/out from <application> and every <activity> (mutates). */
function stripBackInvokedCallback(manifest) {
  const app = manifest.application && manifest.application[0];
  const nodes = app ? [app, ...(app.activity || [])] : [];
  for (const n of nodes) if (n.$) delete n.$['android:enableOnBackInvokedCallback'];
  return manifest;
}

function withReleaseOverlay(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/release');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'AndroidManifest.xml'), releaseManifest());
      return cfg;
    },
  ]);
}

module.exports = function withAndroidRelease(config) {
  return withAndroidWidget(
    withAppLinks(
      withAndroidInput(
        withBackupRules(withReleaseOverlay(withReleaseManifestPolicy(withDebugSymbols(config)))),
      ),
    ),
  );
};
module.exports.RELEASE_REMOVED = RELEASE_REMOVED;
module.exports.stripBackInvokedCallback = stripBackInvokedCallback;
module.exports.BACK_ATTR = BACK_ATTR;
