'use server';

import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { toCustomerProfileMergeResult } from './customer-profile-linking-result';

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

export async function mergeExistingCustomerProfileIntoAuthUser(input: {
  userId: string;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
}): Promise<{ success: boolean; error?: string; mergedProfileId?: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const normalizedEmail = input.email?.trim().toLowerCase() || null;
    const normalizedPhone = input.phone?.trim() ? normalizeAuPhone(input.phone) : null;

    const { data, error } = await supabase.rpc('merge_customer_profile_into_auth_user', {
      p_user_id: input.userId,
      p_email: normalizedEmail,
      p_phone: normalizedPhone,
      p_full_name: input.fullName?.trim() || null,
    });

    return toCustomerProfileMergeResult(data, error);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to merge customer profile',
    };
  }
}
