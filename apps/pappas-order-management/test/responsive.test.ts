import assert from 'node:assert/strict';
import test from 'node:test';
import { isCompactPhoneWidth, isLandscapeTablet } from '../lib/responsive';

test('treats portrait phone widths as compact while keeping tablets unchanged', () => {
  assert.equal(isCompactPhoneWidth(320), true);
  assert.equal(isCompactPhoneWidth(599), true);
  assert.equal(isCompactPhoneWidth(600), false);
});

test('uses split panes only for landscape tablet dimensions', () => {
  assert.equal(isLandscapeTablet(1024, 768), true);
  assert.equal(isLandscapeTablet(375, 812), false);
  assert.equal(isLandscapeTablet(768, 1024), false);
});
