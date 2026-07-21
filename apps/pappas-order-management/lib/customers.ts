import { supabase } from './supabase';
import { getApiUrl } from '../utils/orderUtils';

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

type CreateCustomerPayload = {
  customer?: Customer;
  error?: string;
  duplicateField?: 'email' | 'phone';
};

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

async function getAccessToken(): Promise<{ token: string | null; error: string | null }> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    return { token: null, error: error?.message || 'Missing authenticated session' };
  }

  return { token: session.access_token, error: null };
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
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return getRecentCustomers(page, pageSize);
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('customer_summary')
      .select('*')
      .or(`name.ilike.%${trimmedQuery}%,email.ilike.%${trimmedQuery}%,phone.ilike.%${trimmedQuery}%`)
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
    const summaryResult = await supabase
      .from('customer_summary')
      .select('*')
      .in('phone', phoneLookupValues)
      .order('lastOrderDate', { ascending: false })
      .limit(1);

    if (summaryResult.error) return { data: null, error: summaryResult.error.message };
    if (summaryResult.data?.[0]) {
      return { data: summaryResult.data[0] as Customer, error: null };
    }

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

export async function findCustomerByEmail(email: string): Promise<{ data: Customer | null; error: string | null }> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return { data: null, error: null };
    }

    const summaryResult = await supabase
      .from('customer_summary')
      .select('*')
      .eq('email', normalizedEmail)
      .order('lastOrderDate', { ascending: false })
      .limit(1);

    if (summaryResult.error) return { data: null, error: summaryResult.error.message };
    if (summaryResult.data?.[0]) {
      return { data: summaryResult.data[0] as Customer, error: null };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .eq('role_slug', 'customer')
      .eq('email', normalizedEmail)
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

async function createCustomerProfileDirect(input: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<{ data: Customer | null; error: string | null }> {
  const name = input.name.trim();
  const email = input.email?.trim().toLowerCase() || '';
  const phone = input.phone?.trim() || '';
  const normalizedPhone = phone ? normalizeAuPhone(phone) : '';

  if (!name) {
    return { data: null, error: 'Customer name is required' };
  }

  if (!email && !normalizedPhone) {
    return { data: null, error: 'Please provide an email or phone number' };
  }

  if (email) {
    const existingByEmail = await findCustomerByEmail(email);
    if (existingByEmail.error) return { data: null, error: existingByEmail.error };
    if (existingByEmail.data) {
      return { data: null, error: 'A customer with this email already exists.' };
    }
  }

  if (normalizedPhone) {
    const existingByPhone = await findCustomerByPhone(normalizedPhone);
    if (existingByPhone.error) return { data: null, error: existingByPhone.error };
    if (existingByPhone.data) {
      return { data: null, error: 'A customer with this phone number already exists.' };
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: newUuid(),
      full_name: name,
      email: email || null,
      phone: normalizedPhone || null,
      role_slug: 'customer',
    })
    .select('id, full_name, email, phone')
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return {
    data: {
      id: data.id,
      name: data.full_name ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
    },
    error: null,
  };
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

export async function createCustomerProfile(input: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<{ data: Customer | null; error: string | null }> {
  try {
    const normalizedInput = {
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase() || undefined,
      phone: input.phone?.trim() || undefined,
    };

    if (normalizedInput.email) {
      const existingByEmail = await findCustomerByEmail(normalizedInput.email);
      if (existingByEmail.error) {
        return { data: null, error: existingByEmail.error };
      }
      if (existingByEmail.data) {
        return { data: null, error: 'A customer with this email already exists.' };
      }
    }

    if (normalizedInput.phone) {
      const existingByPhone = await findCustomerByPhone(normalizedInput.phone);
      if (existingByPhone.error) {
        return { data: null, error: existingByPhone.error };
      }
      if (existingByPhone.data) {
        return { data: null, error: 'A customer with this phone number already exists.' };
      }
    }

    const { token, error: authError } = await getAccessToken();
    if (authError || !token) {
      return { data: null, error: authError || 'Missing authenticated session' };
    }

    const response = await fetch(getApiUrl('/api/customers/create'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(normalizedInput),
    });

    const payload = await response.json().catch(() => null) as CreateCustomerPayload | null;

    if (response.status === 404) {
      return await createCustomerProfileDirect(normalizedInput);
    }

    if (!response.ok || !payload?.customer) {
      return { data: null, error: payload?.error || `Create customer failed (${response.status})` };
    }

    return { data: payload.customer, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
