import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const posSource = readFileSync(resolve(process.cwd(), 'app/pos.tsx'), 'utf8');
const checkoutFlow = posSource.slice(
  posSource.indexOf('const handleCheckout'),
  posSource.indexOf('const handleSmartpayInstoreCheckout'),
);

test('refreshes Live Orders before leaving a completed order update', () => {
  assert.match(
    checkoutFlow,
    /if \(isEditingExistingOrder\) \{\s*await queryClient\.refetchQueries\(\{ queryKey: LIVE_ORDERS_QUERY_KEY \}\);\s*\}[\s\S]*router\.back\(\);/,
  );
});
