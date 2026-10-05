import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMirrorSettings } from '../src/lib/mirror-settings';

test('normalizes stored mirror settings to one trimmed register and a supported idle mode', () => {
  assert.deepEqual(normalizeMirrorSettings({
    registerId: '  register-12  ',
    idleMode: 'queue',
  }), {
    registerId: 'register-12',
    idleMode: 'queue', idleImageUri: undefined,
  });
});

test('uses safe defaults for malformed stored mirror settings', () => {
  assert.deepEqual(normalizeMirrorSettings({ registerId: 42, idleMode: 'anything' }), {
    registerId: '',
    idleMode: 'image', idleImageUri: undefined,
  });
});

test('persists the listen-to-all selection without changing idle settings', () => {
  assert.deepEqual(normalizeMirrorSettings({ registerId: ' * ', idleMode: 'queue', idleImageUri: 'file://art.jpg' }), {
    registerId: '*', idleMode: 'queue', idleImageUri: 'file://art.jpg',
  });
});
