import { describe, expect, it } from 'vitest';
import { isDesktopLiveOrder, sortDesktopLiveOrders } from './live-order-eligibility';
import type { DesktopOrder } from './order-types';

const now = Date.parse('2026-09-24T10:00:00.000Z');
const order = (overrides: Partial<DesktopOrder> = {}): DesktopOrder => ({
  id: 'order-1', order_number: 'ORD-1', created_at: '2026-09-24T09:00:00.000Z', scheduled_pickup_at: null,
  order_status: 'pending', payment_status: 'paid', payment_method: 'cash', order_channel: 'instore',
  order_type: 'takeaway',
  customer_name: 'INSTORE', total: 12, subtotal: 12, tax: 0, items: [], ...overrides,
});

describe('desktop Live Orders eligibility', () => {
  it('includes an order due in 30 minutes but excludes one due in 31 minutes', () => {
    expect(isDesktopLiveOrder(order({ scheduled_pickup_at: new Date(now + 30 * 60_000).toISOString() }), now)).toBe(true);
    expect(isDesktopLiveOrder(order({ scheduled_pickup_at: new Date(now + 31 * 60_000).toISOString() }), now)).toBe(false);
  });

  it('excludes terminal, refunded, on-the-way, and pending online payment orders', () => {
    for (const candidate of [
      order({ order_status: 'completed' }), order({ order_status: 'cancelled' }), order({ payment_status: 'refunded' }),
      order({ order_status: 'on_the_way' }), order({ order_status: 'pending_online_payment' }),
    ]) expect(isDesktopLiveOrder(candidate, now)).toBe(false);
  });

  it('sorts by pickup time before created time', () => {
    expect(sortDesktopLiveOrders([order({ id: 'later', scheduled_pickup_at: '2026-09-24T11:00:00.000Z' }), order({ id: 'earlier', scheduled_pickup_at: '2026-09-24T10:15:00.000Z' })]).map((item) => item.id)).toEqual(['earlier', 'later']);
  });
});
