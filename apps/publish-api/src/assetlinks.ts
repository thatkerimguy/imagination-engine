// GET /.well-known/assetlinks.json for Android App Links verification.
import type { HandlerConfig } from './config.ts';

export const DEFAULT_ANDROID_PACKAGE = 'dev.kinetic.writer';

/** Comma-separated SHA-256 fingerprints -> `AA:BB:...` uppercase; invalid entries are dropped. */
export function normaliseFingerprints(raw: string | undefined): string[] {
  const out: string[] = [];
  for (const part of (raw ?? '').split(',')) {
    const hex = part.trim().toUpperCase().replace(/:/g, '');
    if (!/^[0-9A-F]{64}$/.test(hex)) continue;
    const fp = hex.match(/.{2}/g)?.join(':');
    if (fp && !out.includes(fp)) out.push(fp);
  }
  return out;
}

export function assetLinksResponse(config: HandlerConfig): Response {
  const fingerprints = normaliseFingerprints(config.androidCertFingerprints);
  const body =
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: config.androidPackage || DEFAULT_ANDROID_PACKAGE,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ];
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}
