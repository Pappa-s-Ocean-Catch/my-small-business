import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  checkAndApplyUpdate,
  getBuildMetadata,
  restartApp,
  type UpdatesClient,
} from '../lib/about-updates';

test('registers the About drawer route', () => {
  const drawerSource = readFileSync(join(process.cwd(), 'app/(drawer)/_layout.tsx'), 'utf8');

  assert.match(drawerSource, /name="about"/);
});

function availableClient(calls: string[]): UpdatesClient {
  return {
    isEnabled: true,
    async checkForUpdateAsync() {
      calls.push('check');
      return { isAvailable: true };
    },
    async fetchUpdateAsync() {
      calls.push('fetch');
    },
    async reloadAsync() {
      calls.push('reload');
    },
  };
}

test('uses Unknown for absent public build metadata', () => {
  assert.deepEqual(getBuildMetadata({}, '1.2.3'), {
    appVersion: '1.2.3',
    buildDate: 'Unknown',
    gitSha: 'Unknown',
  });
});

test('does not call Expo Updates when updates are disabled', async () => {
  const result = await checkAndApplyUpdate({
    isEnabled: false,
    async checkForUpdateAsync() {
      throw new Error('should not be called');
    },
    async fetchUpdateAsync() {
      throw new Error('should not be called');
    },
    async reloadAsync() {
      throw new Error('should not be called');
    },
  });

  assert.equal(result.kind, 'unavailable');
});

test('does not download or reload when no update is available', async () => {
  const calls: string[] = [];
  const result = await checkAndApplyUpdate({
    isEnabled: true,
    async checkForUpdateAsync() {
      calls.push('check');
      return { isAvailable: false };
    },
    async fetchUpdateAsync() {
      calls.push('fetch');
    },
    async reloadAsync() {
      calls.push('reload');
    },
  });

  assert.equal(result.kind, 'up-to-date');
  assert.deepEqual(calls, ['check']);
});

test('downloads then reloads only when an update is available', async () => {
  const calls: string[] = [];
  const result = await checkAndApplyUpdate(availableClient(calls));

  assert.equal(result.kind, 'applied');
  assert.deepEqual(calls, ['check', 'fetch', 'reload']);
});

test('keeps the app running and returns the error when update work fails', async () => {
  const calls: string[] = [];
  const result = await checkAndApplyUpdate({
    isEnabled: true,
    async checkForUpdateAsync() {
      calls.push('check');
      throw new Error('Offline');
    },
    async fetchUpdateAsync() {
      calls.push('fetch');
    },
    async reloadAsync() {
      calls.push('reload');
    },
  });

  assert.deepEqual(result, { kind: 'failed', message: 'Offline' });
  assert.deepEqual(calls, ['check']);
});

test('does not reload when downloading the available update fails', async () => {
  const calls: string[] = [];
  const result = await checkAndApplyUpdate({
    isEnabled: true,
    async checkForUpdateAsync() {
      calls.push('check');
      return { isAvailable: true };
    },
    async fetchUpdateAsync() {
      calls.push('fetch');
      throw new Error('Download failed');
    },
    async reloadAsync() {
      calls.push('reload');
    },
  });

  assert.deepEqual(result, { kind: 'failed', message: 'Download failed' });
  assert.deepEqual(calls, ['check', 'fetch']);
});

test('restartApp returns a failure instead of throwing when reloading fails', async () => {
  const result = await restartApp({
    isEnabled: true,
    async checkForUpdateAsync() {
      return { isAvailable: false };
    },
    async fetchUpdateAsync() {},
    async reloadAsync() {
      throw new Error('Restart failed');
    },
  });

  assert.deepEqual(result, { kind: 'failed', message: 'Restart failed' });
});

test('restartApp reloads the JavaScript app on explicit request', async () => {
  const calls: string[] = [];
  const result = await restartApp({
    isEnabled: true,
    async checkForUpdateAsync() {
      return { isAvailable: false };
    },
    async fetchUpdateAsync() {},
    async reloadAsync() {
      calls.push('reload');
    },
  });

  assert.deepEqual(result, { kind: 'restarted' });
  assert.deepEqual(calls, ['reload']);
});
