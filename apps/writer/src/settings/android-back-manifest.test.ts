// DIRECTIVE-06A §A1: `android:enableOnBackInvokedCallback` must be omitted from the manifest
// (RN #58407 — "true" kills the app on API 33-35 edge swipes) while every other release
// hardening attribute survives.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

type Attrs = Record<string, string>;
interface Node {
  $?: Attrs;
  activity?: Node[];
  'intent-filter'?: Node[];
}
interface Manifest {
  application?: Node[];
}

const require = createRequire(import.meta.url);
const plugin = require('../../plugins/with-android-release.js') as {
  stripBackInvokedCallback: (m: Manifest) => Manifest;
  BACK_ATTR: string;
};
const appJson = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')) as {
  expo: { android: Record<string, unknown>; plugins: unknown[] };
};

const fixture = (value: string): Manifest => ({
  application: [
    {
      $: {
        'android:allowBackup': 'false',
        'android:fullBackupContent': '@xml/kn_backup_rules',
        'android:dataExtractionRules': '@xml/kn_data_extraction_rules',
        [plugin.BACK_ATTR]: value,
      },
      activity: [
        {
          $: { 'android:name': '.MainActivity', [plugin.BACK_ATTR]: value },
          'intent-filter': [{ $: { 'android:autoVerify': 'true' } }],
        },
      ],
    },
  ],
});

describe('Android back-dispatch manifest policy', () => {
  it.each(['true', 'false'])('strips enableOnBackInvokedCallback="%s" everywhere', (v) => {
    const m = plugin.stripBackInvokedCallback(fixture(v));
    expect(JSON.stringify(m)).not.toContain('enableOnBackInvokedCallback');
  });

  it('keeps allowBackup, backup XML rules and autoVerify', () => {
    const app = plugin.stripBackInvokedCallback(fixture('true')).application![0]!;
    expect(app.$).toEqual({
      'android:allowBackup': 'false',
      'android:fullBackupContent': '@xml/kn_backup_rules',
      'android:dataExtractionRules': '@xml/kn_data_extraction_rules',
    });
    expect(app.activity![0]!['intent-filter']![0]!.$).toEqual({ 'android:autoVerify': 'true' });
  });

  it('is a no-op on a manifest without <application>', () => {
    expect(plugin.stripBackInvokedCallback({})).toEqual({});
  });

  it('app.json no longer opts in to predictive back and still targets SDK 36', () => {
    const android = appJson.expo.android;
    expect(android).not.toHaveProperty('predictiveBackGestureEnabled');
    expect(android.allowBackup).toBe(false);
    const props = appJson.expo.plugins.find(
      (p): p is [string, { android: { targetSdkVersion: number } }] =>
        Array.isArray(p) && p[0] === 'expo-build-properties',
    );
    expect(props?.[1].android.targetSdkVersion).toBe(36);
  });
});
