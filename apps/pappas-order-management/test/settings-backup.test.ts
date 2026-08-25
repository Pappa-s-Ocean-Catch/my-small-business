import assert from 'node:assert/strict';
import test from 'node:test';

import { createSettingsBackup, parseSettingsBackup } from '../lib/settings-backup';

test('exports settings in a versioned backup envelope', () => {
  assert.deepEqual(
    createSettingsBackup({ marketplaceSyncStartTime: '11:00', soundEnabled: true }, '2026-08-26T01:00:00.000Z'),
    {
      version: 1,
      exportedAt: '2026-08-26T01:00:00.000Z',
      settings: { marketplaceSyncStartTime: '11:00', soundEnabled: true },
    },
  );
});

test('accepts only a supported settings backup with an object payload', () => {
  assert.deepEqual(
    parseSettingsBackup('{"version":1,"exportedAt":"2026-08-26T01:00:00.000Z","settings":{"marketplaceSyncEndTime":"20:30"}}'),
    { marketplaceSyncEndTime: '20:30' },
  );
  assert.throws(() => parseSettingsBackup('{"version":2,"settings":{}}'), /unsupported/i);
  assert.throws(() => parseSettingsBackup('{"version":1,"settings":[]}'), /invalid/i);
});
