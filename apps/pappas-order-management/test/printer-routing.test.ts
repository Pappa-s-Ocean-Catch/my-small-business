import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldSkipOverlappingCombinedSectionTicket } from '../utils/orderUtils';

test('skips a combined section ticket when one of its individual sections already has a ticket', () => {
  assert.equal(
    shouldSkipOverlappingCombinedSectionTicket('GRILLED & FRIED', ['GRILLED', 'FRIED', 'GRILLED & FRIED']),
    true,
  );
});

test('keeps a combined section ticket when neither individual section has a ticket', () => {
  assert.equal(
    shouldSkipOverlappingCombinedSectionTicket('GRILLED & FRIED', ['GRILLED & FRIED']),
    false,
  );
});
