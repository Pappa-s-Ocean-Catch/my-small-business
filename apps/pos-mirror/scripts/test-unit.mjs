import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(appRoot, '..', '..');
const sharedPackageRoot = resolve(workspaceRoot, 'libs/pos-mirror');

function compile(cwd, args) {
  const result = spawnSync('pnpm', ['exec', 'tsc', ...args], { cwd, encoding: 'utf8' });
  process.stdout.write(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

compile(sharedPackageRoot, ['-p', 'tsconfig.test.json']);
compile(appRoot, ['-p', 'tsconfig.test.json']);

const emittedSharedPackage = resolve(sharedPackageRoot, 'dist-test');
if (!existsSync(emittedSharedPackage)) {
  throw new Error('Expected the emitted POS mirror package before running app tests.');
}

const moduleLink = resolve(appRoot, 'dist-test/node_modules/@my-small-business/pos-mirror');
rmSync(moduleLink, { force: true });
mkdirSync(dirname(moduleLink), { recursive: true });
symlinkSync(emittedSharedPackage, moduleLink);

const test = spawnSync('node', ['--test', 'dist-test/test/**/*.test.js'], { cwd: appRoot, stdio: 'inherit' });
process.exit(test.status ?? 1);
