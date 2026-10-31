import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMirrorSettings, selectedRegisters } from '../src/lib/mirror-settings';

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


test('persists several trimmed register choices and migrates the primary register', () => {
  const settings = normalizeMirrorSettings({ registerIds: [' a ', 'b', 'a', '', 42], idleMode: 'queue' });
  assert.deepEqual(settings, { registerId: 'a', registerIds: ['a', 'b'], idleMode: 'queue', idleImageUri: undefined });
});


test('old single-register and all-register settings remain usable', () => {
  assert.deepEqual(selectedRegisters(normalizeMirrorSettings({ registerId: ' a ' })), ['a']);
  assert.deepEqual(selectedRegisters(normalizeMirrorSettings({ registerId: '*' })), ['*']);
  assert.deepEqual(normalizeMirrorSettings({ registerIds: ['a', '*', 'b'] }).registerIds, ['*']);
  assert.deepEqual(selectedRegisters(normalizeMirrorSettings({ registerIds: [] })), []);
});
