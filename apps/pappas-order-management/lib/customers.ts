import { supabase } from './supabase';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  firstOrderDate?: string;
  lastOrderDate?: string;
  totalOrders?: number;
  totalSpent?: number;
  rewardPoints?: number;
}

function normalizeAuPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('61') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith('04') && digits.length === 10) {
    return `+61${digits.slice(1)}`;
  }
  if (phone.startsWith('+614') && digits.length === 11) {
    return `+${digits}`;
  }
  return phone.trim();
}

function localAuPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('61') && digits.length === 11) {
    return `0${digits.slice(2)}`;
  }
  return null;
}

function getPhoneLookupValues(phone: string): string[] {
  const trimmed = phone.trim();
  const normalized = normalizeAuPhone(trimmed);
  const local = localAuPhone(normalized);
  return Array.from(new Set([trimmed, normalized, local].filter(Boolean) as string[]));
}

function newUuid(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (randomUuid) return randomUuid.call(globalThis.crypto);

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
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

export async function findCustomerByPhone(phone: string): Promise<{ data: Customer | null; error: string | null }> {
  try {
    const phoneLookupValues = getPhoneLookupValues(phone);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .in('phone', phoneLookupValues)
      .limit(1);

    if (error) return { data: null, error: error.message };
    const profile = data?.[0];
    if (!profile) return { data: null, error: null };
    return {
      data: {
        id: profile.id,
        name: profile.full_name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function createCustomerIfNotExists(phone: string, name: string): Promise<{ data: Customer | null; error: string | null }> {
  try {
    const existing = await findCustomerByPhone(phone);
    if (existing.error) return { data: null, error: existing.error };
    if (existing.data) return { data: existing.data, error: null };

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: newUuid(),
        phone: normalizeAuPhone(phone),
        full_name: name || null,
        role_slug: 'customer',
        email: null,
      })
      .select('id, full_name, email, phone')
      .single();

    if (error) return { data: null, error: error.message };
    return {
      data: {
        id: data.id,
        name: data.full_name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
