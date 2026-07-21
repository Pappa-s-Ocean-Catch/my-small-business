'use server';

import { createServiceRoleClient } from '@my-small-business/supabase/server';

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

    const candidateIds = new Set<string>();

    if (normalizedEmail) {
      const { data: emailMatches, error: emailError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role_slug', 'customer')
        .eq('email', normalizedEmail);

      if (emailError) {
        return { success: false, error: emailError.message };
      }

      for (const row of emailMatches || []) {
        if (row.id !== input.userId) candidateIds.add(row.id);
      }
    }

    if (normalizedPhone) {
      const { data: phoneMatches, error: phoneError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role_slug', 'customer')
        .eq('phone', normalizedPhone);

      if (phoneError) {
        return { success: false, error: phoneError.message };
      }

      for (const row of phoneMatches || []) {
        if (row.id !== input.userId) candidateIds.add(row.id);
      }
    }

    const candidateId = Array.from(candidateIds)[0];
    if (!candidateId) {
      return { success: true, mergedProfileId: null };
    }

    const { data: legacyProfile, error: legacyError } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .eq('id', candidateId)
      .single();

    if (legacyError || !legacyProfile) {
      return { success: false, error: legacyError?.message || 'Legacy customer profile not found' };
    }

    await supabase.from('orders').update({ user_id: input.userId }).eq('user_id', candidateId);
    await supabase.from('reward_point_transactions').update({ user_id: input.userId }).eq('user_id', candidateId);

    const { data: legacyPoints } = await supabase
      .from('user_reward_points')
      .select('*')
      .eq('user_id', candidateId)
      .maybeSingle();

    const { data: authPoints } = await supabase
      .from('user_reward_points')
      .select('*')
      .eq('user_id', input.userId)
      .maybeSingle();

    const mergedPointsRow = {
      user_id: input.userId,
      total_points_earned: Number(authPoints?.total_points_earned || 0) + Number(legacyPoints?.total_points_earned || 0),
      total_points_used: Number(authPoints?.total_points_used || 0) + Number(legacyPoints?.total_points_used || 0),
      total_points_expired: Number(authPoints?.total_points_expired || 0) + Number(legacyPoints?.total_points_expired || 0),
      current_balance: Number(authPoints?.current_balance || 0) + Number(legacyPoints?.current_balance || 0),
      last_transaction_at: authPoints?.last_transaction_at || legacyPoints?.last_transaction_at || null,
    };

    const { error: upsertPointsError } = await supabase
      .from('user_reward_points')
      .upsert(mergedPointsRow, { onConflict: 'user_id' });

    if (upsertPointsError) {
      return { success: false, error: upsertPointsError.message };
    }

    const { error: deleteLegacyPointsError } = await supabase
      .from('user_reward_points')
      .delete()
      .eq('user_id', candidateId);

    if (deleteLegacyPointsError) {
      return { success: false, error: deleteLegacyPointsError.message };
    }

    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        role_slug: 'customer',
        full_name: input.fullName || legacyProfile.full_name || null,
        email: normalizedEmail || legacyProfile.email || null,
        phone: normalizedPhone || legacyProfile.phone || null,
      })
      .eq('id', input.userId);

    if (updateProfileError) {
      return { success: false, error: updateProfileError.message };
    }

    const { error: deleteLegacyProfileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', candidateId);

    if (deleteLegacyProfileError) {
      return { success: false, error: deleteLegacyProfileError.message };
    }

    return { success: true, mergedProfileId: candidateId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to merge customer profile',
    };
  }
}
