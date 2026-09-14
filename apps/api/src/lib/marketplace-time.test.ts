import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's type-stripping test runner requires the source-file extension.
import { parseDoorDashTimestamp } from './marketplace-time.ts';

test('preserves explicit DoorDash UTC timestamps before Melbourne display', () => {
  assert.equal(
    parseDoorDashTimestamp('2026-08-09T07:37:11.000Z'),
    Date.UTC(2026, 7, 9, 7, 37, 11),
  );
});

test('treats DoorDash order timestamps without an offset as UTC', () => {
  assert.equal(
    parseDoorDashTimestamp('2026-08-09T07:44:45'),
    Date.UTC(2026, 7, 9, 7, 44, 45),
  );
});
