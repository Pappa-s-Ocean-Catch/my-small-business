import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchAllPages } from '../lib/report-data';

test('fetches every page when a report has more than one backend result page', async () => {
  const requests: Array<[number, number]> = [];
  const result = await fetchAllPages(async (from, to) => {
    requests.push([from, to]);
    if (from === 0) return { data: Array.from({ length: 1_000 }, (_, index) => index), error: null };
    return { data: [1_000, 1_001], error: null };
  });

  assert.deepEqual(requests, [[0, 999], [1_000, 1_999]]);
  assert.equal(result.error, null);
  assert.equal(result.data?.length, 1_002);
  assert.equal(result.data?.[0], 0);
  assert.equal(result.data?.[1_001], 1_001);
});

test('returns the backend error instead of treating a failed page as an empty report', async () => {
  const result = await fetchAllPages(async () => ({ data: null, error: 'Database unavailable' }));

  assert.deepEqual(result, { data: null, error: 'Database unavailable' });
});
