import assert from 'node:assert/strict';
import test from 'node:test';

test('formats clean build metadata from the commit and local date', async () => {
  const { resolveBuildMetadata } = await import('../scripts/run-with-build-metadata.mjs');

  assert.deepEqual(resolveBuildMetadata({
    gitHead: '287eda32d994',
    gitStatus: '',
    now: new Date(2026, 7, 8, 12, 30),
  }), {
    buildDate: '20260808-1230',
    gitSha: '287eda32',
  });
});

test('adds a dirty suffix when the workspace has any status entry', async () => {
  const { resolveBuildMetadata } = await import('../scripts/run-with-build-metadata.mjs');

  assert.equal(resolveBuildMetadata({
    gitHead: '287eda32d994',
    gitStatus: ' M app.tsx',
    now: new Date(2026, 7, 8, 12, 30),
  }).gitSha, '287eda32(+)');
});
