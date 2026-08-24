import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('marketplace warning keeps readable title and retry explanation beside dismiss', () => {
  const source = readFileSync('components/MarketplaceSyncAlertBanner.tsx', 'utf8');

  assert.match(source, /sync issue/);
  assert.match(source, /Retrying automatically/);
  assert.match(source, /width: 300/);
});
