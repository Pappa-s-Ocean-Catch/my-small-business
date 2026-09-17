import assert from 'node:assert/strict';
import test from 'node:test';

import { getLoginLayout } from '../src/lib/login-layout';

test('uses compact gutters and padding on a short landscape phone', () => {
  assert.deepEqual(getLoginLayout({ width: 640, height: 360 }), {
    compact: true,
    horizontalGutter: 16,
    verticalGutter: 16,
    cardPadding: 16,
    cardMaxWidth: 608,
  });
});

test('keeps a comfortably sized card on a larger landscape tablet', () => {
  assert.deepEqual(getLoginLayout({ width: 1280, height: 800 }), {
    compact: false,
    horizontalGutter: 32,
    verticalGutter: 32,
    cardPadding: 32,
    cardMaxWidth: 520,
  });
});
