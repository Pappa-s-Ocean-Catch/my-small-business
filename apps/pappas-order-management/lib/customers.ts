import { supabase } from './supabase';

export interface Customer {
  name: string;
  email: string;
  phone: string;
  firstOrderDate: string;
  lastOrderDate: string;
  totalOrders: number;
  totalSpent: number;
}

export async function getRecentCustomers(limit = 20): Promise<{ data: Customer[] | null; error: string | null }> {
  try {
    // We want to find unique customers from the orders table
    // A more robust way would be a dedicated customers table, but based on the schema, 
    // we derive them from orders to catch both registered and guest customers.
    
    // This is a bit tricky with Supabase/PostgREST without a custom function,
    // so we'll fetch recent orders and unique them in JS for now, or use a RPC if available.
    // For now, let's fetch orders and group them.
    const { data, error } = await supabase
      .from('orders')
      .select('customer_name, customer_email, customer_phone, created_at, total')
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    if (!data) return { data: [], error: null };

    const customerMap = new Map<string, Customer>();

    data.forEach(order => {
      const key = order.customer_email || order.customer_phone;
      if (!key) return;

      const existing = customerMap.get(key);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += Number(order.total) || 0;
        if (new Date(order.created_at) < new Date(existing.firstOrderDate)) {
          existing.firstOrderDate = order.created_at;
        }
      } else {
        customerMap.set(key, {
          name: order.customer_name || 'Unknown',
          email: order.customer_email,
          phone: order.customer_phone,
          firstOrderDate: order.created_at,
          lastOrderDate: order.created_at,
          totalOrders: 1,
          totalSpent: Number(order.total) || 0,
        });
      }
    });

    const customers = Array.from(customerMap.values())
      .sort((a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime())
      .slice(0, limit);

    return { data: customers, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function searchCustomers(query: string): Promise<{ data: Customer[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('customer_name, customer_email, customer_phone, created_at, total')
      .or(`customer_name.ilike.%${query}%,customer_email.ilike.%${query}%,customer_phone.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    if (!data) return { data: [], error: null };

    const customerMap = new Map<string, Customer>();

    data.forEach(order => {
      const key = order.customer_email || order.customer_phone;
      if (!key) return;

      const existing = customerMap.get(key);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += Number(order.total) || 0;
      } else {
        customerMap.set(key, {
          name: order.customer_name || 'Unknown',
          email: order.customer_email,
          phone: order.customer_phone,
          firstOrderDate: order.created_at,
          lastOrderDate: order.created_at,
          totalOrders: 1,
          totalSpent: Number(order.total) || 0,
        });
      }
    });

    return { data: Array.from(customerMap.values()), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
