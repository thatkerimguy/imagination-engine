// Metro in a pnpm monorepo: watch the workspace so @kn/core and @kn/module-* (TypeScript source,
// symlinked by pnpm) hot-reload, and resolve node_modules from both the app and the root.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;
// The built-in offline reader (assets/reader-preview.html) ships as a static asset file, so the
// three.js / cannon-es inside it never reach the Hermes bytecode bundle.
config.resolver.assetExts = [...config.resolver.assetExts, 'html'];

module.exports = config;
