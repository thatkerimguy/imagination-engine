// OVERHAUL-03 D1: the WebViewAssetLoader plugin adds only the pure-Kotlin androidx.webkit AAR
// and a locked-down native reader view (https appassets origin, no file/content access).
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const plugin = require('../../plugins/android-webview-assets.js') as {
  WEBKIT: string;
  managerKt: (pkg: string) => string;
  packageKt: (pkg: string) => string;
};

describe('android-webview-assets plugin', () => {
  const kt = plugin.managerKt('dev.kinetic.writer');

  it('pins androidx.webkit 1.12.1 (Java/Kotlin AAR, no native libs)', () => {
    expect(plugin.WEBKIT).toBe('implementation("androidx.webkit:webkit:1.12.1") // kn-webview-assets');
  });

  it('serves assets/reader/ from the appassets https origin', () => {
    expect(kt).toContain('setDomain(DOMAIN)');
    expect(kt).toContain('const val DOMAIN = "appassets.androidplatform.net"');
    expect(kt).toContain('addPathHandler("/reader/", WebViewAssetLoader.AssetsPathHandler(context))');
    expect(kt).toContain('loader.shouldInterceptRequest(request.url)');
  });

  it('locks the WebView down and quotes every message it evaluates', () => {
    expect(kt).toContain('allowFileAccess = false');
    expect(kt).toContain('allowContentAccess = false');
    expect(kt).toContain('JSONObject.quote(json)');
    expect(kt).toContain('request.url.host != DOMAIN');
    expect(kt).not.toMatch(/uses-permission|System\.loadLibrary/);
  });

  it('registers one view manager under the package name', () => {
    const pkg = plugin.packageKt('dev.kinetic.writer');
    expect(pkg).toMatch(/^package dev\.kinetic\.writer/);
    expect(pkg).toContain('listOf(KnReaderWebViewManager())');
  });
});
