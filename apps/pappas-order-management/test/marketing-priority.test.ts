import assert from 'node:assert/strict';
import test from 'node:test';
import { sortByMarketingPriority } from '../lib/marketing-priority';

test('prioritises inactive customers by last order, then SMS, then email contact', () => {
  const customers = [
    {
      id: 'recent-buyer',
      lastOrderDate: '2026-08-20T10:00:00.000Z',
      lastMarketingSmsSentAt: null,
      lastMarketingEmailSentAt: null,
    },
    {
      id: 'same-order-email-later',
      lastOrderDate: '2026-01-10T10:00:00.000Z',
      lastMarketingSmsSentAt: '2026-02-01T10:00:00.000Z',
      lastMarketingEmailSentAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'same-order-sms-never',
      lastOrderDate: '2026-01-10T10:00:00.000Z',
      lastMarketingSmsSentAt: null,
      lastMarketingEmailSentAt: '2026-08-01T10:00:00.000Z',
    },
    {
      id: 'same-order-sms-tie-email-never',
      lastOrderDate: '2026-01-10T10:00:00.000Z',
      lastMarketingSmsSentAt: '2026-02-01T10:00:00.000Z',
      lastMarketingEmailSentAt: null,
    },
    {
      id: 'older-buyer-contacted-recently',
      lastOrderDate: '2025-12-10T10:00:00.000Z',
      lastMarketingSmsSentAt: '2026-08-20T10:00:00.000Z',
      lastMarketingEmailSentAt: '2026-08-20T10:00:00.000Z',
    },
  ];

  assert.deepEqual(
    sortByMarketingPriority(customers).map((customer) => customer.id),
    [
      'older-buyer-contacted-recently',
      'same-order-sms-never',
      'same-order-sms-tie-email-never',
      'same-order-email-later',
      'recent-buyer',
    ]
  );
});
