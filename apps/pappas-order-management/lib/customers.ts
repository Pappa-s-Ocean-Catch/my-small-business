import { supabase } from './supabase';

export interface Customer {
  name: string;
  email: string;
  phone: string;
  firstOrderDate: string;
  lastOrderDate: string;
  totalOrders: number;
  totalSpent: number;
  rewardPoints: number;
}

export async function getRecentCustomers(page = 0, pageSize = 20): Promise<{ data: Customer[] | null; error: string | null }> {
  try {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('customer_summary')
      .select('*')
      .order('lastOrderDate', { ascending: false })
      .range(from, to);

    if (error) return { data: null, error: error.message };
    
    // Sort logic removed as it's now handled by the database
    return { data: data as Customer[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function searchCustomers(query: string, page = 0, pageSize = 20): Promise<{ data: Customer[] | null; error: string | null }> {
  try {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('customer_summary')
      .select('*')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
      .order('lastOrderDate', { ascending: false })
      .range(from, to);

    if (error) return { data: null, error: error.message };
    
    return { data: data as Customer[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
