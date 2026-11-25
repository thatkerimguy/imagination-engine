// Verified Android App Links (DIRECTIVE-04): `https://<host>/share/*` and `/r/*` open the writer.
// The host is the ONE place to change for launch: set KN_APP_LINK_HOST at prebuild/EAS build time
// (it must match the domain serving `/.well-known/assetlinks.json` from apps/publish-api).
const APP_LINK_HOST = process.env.KN_APP_LINK_HOST || 'read.imaginationengine.app';
const PREFIXES = ['/share/', '/r/'];

function withAppLinks(config) {
  const android = (config.android = config.android || {});
  const filters = (android.intentFilters = android.intentFilters || []);
  const exists = filters.some(
    (f) => f.autoVerify && f.data?.some?.((d) => d.host === APP_LINK_HOST),
  );
  if (!exists) {
    filters.push({
      action: 'VIEW',
      autoVerify: true,
      category: ['BROWSABLE', 'DEFAULT'],
      data: PREFIXES.map((pathPrefix) => ({ scheme: 'https', host: APP_LINK_HOST, pathPrefix })),
    });
  }
  return config;
}

module.exports = withAppLinks;
module.exports.APP_LINK_HOST = APP_LINK_HOST;
