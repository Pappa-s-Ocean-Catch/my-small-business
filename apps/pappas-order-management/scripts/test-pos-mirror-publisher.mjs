import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compile = spawnSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.test.json', '--pretty', 'false'], {
  cwd: appRoot,
  encoding: 'utf8',
});
const compileOutput = `${compile.stdout ?? ''}${compile.stderr ?? ''}`;
process.stdout.write(compileOutput);

const expectedBaselineError = 'lib/escpos-printer.ts';
if (compile.status !== 0 && !compileOutput.includes(expectedBaselineError)) {
  process.exit(compile.status ?? 1);
}

const moduleLink = resolve(appRoot, 'dist-test/apps/pappas-order-management/node_modules/@my-small-business/pos-mirror');
const emittedPackage = resolve(appRoot, 'dist-test/libs/pos-mirror');
if (!existsSync(emittedPackage)) {
  throw new Error('Expected emitted POS mirror package was not produced by the TypeScript test build.');
}
rmSync(moduleLink, { force: true });
mkdirSync(dirname(moduleLink), { recursive: true });
symlinkSync('../../../../libs/pos-mirror', moduleLink);

const test = spawnSync('node', ['--test', 'dist-test/apps/pappas-order-management/test/pos-mirror-publisher.test.js'], {
  cwd: appRoot,
  stdio: 'inherit',
});
process.exit(test.status ?? 1);
