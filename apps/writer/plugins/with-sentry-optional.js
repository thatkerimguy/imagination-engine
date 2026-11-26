// Local Expo config plugin (DIRECTIVE-06): Sentry's own Expo plugin adds a Gradle step that
// uploads source maps and needs SENTRY_AUTH_TOKEN. It is applied ONLY when SENTRY_AUTH_TOKEN,
// SENTRY_ORG and SENTRY_PROJECT are all set (launch CI). Local `gradlew bundleRelease
// assembleRelease` builds without a token never get that step, so they never fail on it. The
// native SDK itself is autolinked either way and stays dormant until the user opts in.
const shouldUploadSourceMaps = (env = process.env) =>
  !!(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT);

module.exports = function withSentryOptional(config) {
  if (!shouldUploadSourceMaps()) return config;
  const withSentry = require('@sentry/react-native/expo');
  return withSentry(config, {
    organization: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  });
};
module.exports.shouldUploadSourceMaps = shouldUploadSourceMaps;
