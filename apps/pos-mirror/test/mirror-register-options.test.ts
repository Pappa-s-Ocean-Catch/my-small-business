import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMirrorRegisterIds } from '../src/lib/mirror-register-options';

test('keeps only unique non-empty register IDs from mirror-state rows', () => {
  assert.deepEqual(normalizeMirrorRegisterIds([
    { register_id: ' register-2 ' },
    { register_id: 'register-1' },
    { register_id: 'register-2' },
    { register_id: '' },
    { register_id: null },
  ]), ['register-1', 'register-2']);
});
