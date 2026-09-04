import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/report-data';
import {
  getSuccessfulOrderCounts,
  type CustomerOrderCountCandidate,
  type CustomerOrderIdentity,
} from '@/utils/customer-order-count';

const CUSTOMER_ORDER_COUNT_FIELDS = 'id,user_id,customer_email,customer_phone,payment_status,order_status';

function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildCustomerFilter(orders: CustomerOrderIdentity[]): string | null {
  const profileIds = [...new Set(orders.map((order) => order.user_id?.trim()).filter((value): value is string => !!value))];
  const emails = [...new Set(orders.map((order) => order.customer_email?.trim().toLowerCase()).filter((value): value is string => !!value))];
  const phones = [...new Set(orders.map((order) => order.customer_phone?.trim()).filter((value): value is string => !!value))];
  const filters = [
    profileIds.length ? `user_id.in.(${profileIds.map(quotePostgrestValue).join(',')})` : null,
    emails.length ? `customer_email.in.(${emails.map(quotePostgrestValue).join(',')})` : null,
    phones.length ? `customer_phone.in.(${phones.map(quotePostgrestValue).join(',')})` : null,
  ].filter((value): value is string => !!value);

  return filters.length ? filters.join(',') : null;
}

export async function fetchSuccessfulOrderCounts(orders: CustomerOrderIdentity[]): Promise<Record<string, number>> {
  const filter = buildCustomerFilter(orders);
  if (!filter) return Object.fromEntries(orders.map((order) => [order.id, 0]));

  const result = await fetchAllPages(async (from, to) => {
    const { data, error } = await supabase
      .from('orders')
      .select(CUSTOMER_ORDER_COUNT_FIELDS)
      .eq('payment_status', 'paid')
      .neq('order_status', 'cancelled')
      .neq('order_status', 'refunded')
      .or(filter)
      .range(from, to);

    return { data: data as CustomerOrderCountCandidate[] | null, error: error?.message || null };
  });

  if (result.error) throw new Error(result.error);
  return getSuccessfulOrderCounts(orders, result.data || []);
}

export function useCustomerOrderCounts(orders: CustomerOrderIdentity[]) {
  const customerKey = orders.map((order) => [
    order.id,
    order.user_id || '',
    order.customer_email?.trim().toLowerCase() || '',
    order.customer_phone?.trim() || '',
  ]).join('|');

  return useQuery({
    queryKey: ['successful-customer-order-counts', customerKey],
    queryFn: () => fetchSuccessfulOrderCounts(orders),
    enabled: orders.length > 0,
    staleTime: 30_000,
  });
}
