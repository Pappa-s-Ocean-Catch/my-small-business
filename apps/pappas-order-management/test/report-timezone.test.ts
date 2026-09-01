import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDateInMelbourne,
  getTimeInMelbourne,
  toMelbourneRangeBoundaryIso,
} from '../lib/report-timezone';

test('queries an inclusive Melbourne week from Monday midnight through Sunday midnight', () => {
  assert.equal(toMelbourneRangeBoundaryIso('2026-08-31', 'start'), '2026-08-30T14:00:00.000Z');
  assert.equal(toMelbourneRangeBoundaryIso('2026-09-06', 'end'), '2026-09-06T13:59:59.999Z');
});

test('uses the Melbourne daylight-saving offset for report boundaries', () => {
  assert.equal(toMelbourneRangeBoundaryIso('2026-10-05', 'start'), '2026-10-04T13:00:00.000Z');
  assert.equal(toMelbourneRangeBoundaryIso('2026-10-05', 'end'), '2026-10-05T12:59:59.999Z');
});

test('groups UTC order timestamps into their Melbourne date and time', () => {
  assert.equal(formatDateInMelbourne(new Date('2026-08-30T14:00:00.000Z')), '2026-08-31');
  assert.deepEqual(getTimeInMelbourne(new Date('2026-08-30T14:30:00.000Z')), { hour: 0, minute: 30 });
});
