import assert from 'node:assert/strict';
import test from 'node:test';

import { getAppMemorySnapshot, type AppMemoryClient } from '../lib/app-memory';

test('returns total, app, and available memory from a native sample', async () => {
  const client: AppMemoryClient = {
    async getCurrentMemoryAsync() {
      return {
        totalBytes: 2 * 1024 * 1024 * 1024,
        appFootprintBytes: 12 * 1024 * 1024,
        availableBytes: 768 * 1024 * 1024,
      };
    },
  };

  assert.deepEqual(await getAppMemorySnapshot(client), {
    kind: 'available',
    totalBytes: 2147483648,
    appFootprintBytes: 12582912,
    availableBytes: 805306368,
    formattedTotal: '2.0 GB',
    formattedAppFootprint: '12.0 MB',
    formattedAvailable: '768.0 MB',
  });
});

test('preserves unavailable system memory when a platform cannot report it', async () => {
  const client: AppMemoryClient = {
    async getCurrentMemoryAsync() {
      return {
        totalBytes: 8 * 1024 * 1024 * 1024,
        appFootprintBytes: 120 * 1024 * 1024,
        availableBytes: null,
      };
    },
  };

  assert.deepEqual(await getAppMemorySnapshot(client), {
    kind: 'available',
    totalBytes: 8589934592,
    appFootprintBytes: 125829120,
    availableBytes: null,
    formattedTotal: '8.0 GB',
    formattedAppFootprint: '120.0 MB',
    formattedAvailable: 'Not reported by this platform',
  });
});

test('reports an unavailable diagnostic when no native memory module is bundled', async () => {
  assert.deepEqual(await getAppMemorySnapshot(null), { kind: 'unavailable' });
});

test('keeps the About screen usable when native memory sampling fails', async () => {
  const client: AppMemoryClient = {
    async getCurrentMemoryAsync() {
      throw new Error('Native memory lookup failed');
    },
  };

  assert.deepEqual(await getAppMemorySnapshot(client), {
    kind: 'failed',
    message: 'Native memory lookup failed',
  });
});
