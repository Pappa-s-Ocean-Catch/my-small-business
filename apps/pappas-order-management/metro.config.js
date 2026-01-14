// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Preserve Expo defaults, but also watch the monorepo root.
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), monorepoRoot]));

// Help Metro resolve modules when using pnpm workspaces.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Keep Expo default behavior (doctor expects this to be false).
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
