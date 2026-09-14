'use server';

import { createServiceRoleClient, createServerSupabaseClient } from '@my-small-business/supabase/server';

export type RewardConfig = {
  earn_points_per_dollar: number; // e.g., 10 points per $1
  points_per_dollar_value: number; // e.g., 1000 points == $1
};

export type RewardAccount = {
  user_id: string;
  balance_points: number;
  updated_at: string;
  created_at: string;
};

export type RewardLedgerEntry = {
  id: string;
  user_id: string;
  order_id: string | null;
  delta_points: number;
  balance_after: number;
  reason: 'earn' | 'redeem' | 'adjust';
  description: string | null;
  created_at: string;
};

const DEFAULT_REWARD_CONFIG: RewardConfig = {
  earn_points_per_dollar: 10,
  points_per_dollar_value: 1000,
};

export async function getRewardConfig(): Promise<RewardConfig> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'reward_config')
      .maybeSingle();

    if (error) {
      console.error('[Rewards] Error fetching config:', error);
      return DEFAULT_REWARD_CONFIG;
    }

    const value = (data?.value as RewardConfig | undefined) ?? DEFAULT_REWARD_CONFIG;
    return {
      earn_points_per_dollar: Number(value.earn_points_per_dollar) || DEFAULT_REWARD_CONFIG.earn_points_per_dollar,
      points_per_dollar_value: Number(value.points_per_dollar_value) || DEFAULT_REWARD_CONFIG.points_per_dollar_value,
    };
  } catch (error) {
    console.error('[Rewards] Error fetching config:', error);
    return DEFAULT_REWARD_CONFIG;
  }
}

export async function updateRewardConfig(config: RewardConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'reward_config', value: config }, { onConflict: 'key' });

    if (error) {
      console.error('[Rewards] Error updating config:', error);
      return { success: false, error: 'Failed to update reward config' };
    }

    return { success: true };
  } catch (error) {
    console.error('[Rewards] Error updating config:', error);
    return { success: false, error: 'Unexpected error updating reward config' };
  }
}

async function ensureRewardAccount(userId: string, supabase: Awaited<ReturnType<typeof createServiceRoleClient>>) {
  const { data, error } = await supabase
    .from('reward_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (data) return data as RewardAccount;

  const { data: inserted, error: insertError } = await supabase
    .from('reward_accounts')
    .insert({ user_id: userId, balance_points: 0 })
    .select()
    .single();

  if (insertError) {
    console.error('[Rewards] Error creating reward account:', insertError);
    throw new Error('Failed to create reward account');
  }

  return inserted as RewardAccount;
}

export async function getRewardBalance(): Promise<{ balance_points: number; value_dollars: number; config: RewardConfig }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { balance_points: 0, value_dollars: 0, config: DEFAULT_REWARD_CONFIG };
    }

    const config = await getRewardConfig();

    const serviceClient = await createServiceRoleClient();
    const account = await ensureRewardAccount(user.id, serviceClient);

    const balance = Number(account.balance_points) || 0;
    const value = balance / config.points_per_dollar_value;

    return { balance_points: balance, value_dollars: value, config };
  } catch (error) {
    console.error('[Rewards] Error getting balance:', error);
    return { balance_points: 0, value_dollars: 0, config: DEFAULT_REWARD_CONFIG };
  }
}

export async function getRewardLedger(): Promise<{ entries: RewardLedgerEntry[]; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { entries: [], error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('reward_ledger')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Rewards] Error fetching ledger:', error);
      return { entries: [], error: 'Failed to fetch ledger' };
    }

    return { entries: (data as RewardLedgerEntry[]) || [] };
  } catch (error) {
    console.error('[Rewards] Error fetching ledger:', error);
    return { entries: [], error: 'Unexpected error fetching ledger' };
  }
}

export async function earnRewards(userId: string, points: number, reason: string = 'Order payment'): Promise<{ success: boolean; error?: string }> {
  if (points <= 0) return { success: false, error: 'Points must be positive to earn' };
  try {
    const supabase = await createServiceRoleClient();
    const account = await ensureRewardAccount(userId, supabase);

    const newBalance = Number(account.balance_points) + points;

    const { error: updateError } = await supabase
      .from('reward_accounts')
      .update({ balance_points: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Rewards] Error updating balance:', updateError);
      return { success: false, error: 'Failed to update rewards balance' };
    }

    const { error: ledgerError } = await supabase
      .from('reward_ledger')
      .insert({
        user_id: userId,
        delta_points: points,
        balance_after: newBalance,
        reason: 'earn',
        description: reason,
      });

    if (ledgerError) {
      console.error('[Rewards] Error inserting ledger:', ledgerError);
      return { success: false, error: 'Failed to record rewards transaction' };
    }

    return { success: true };
  } catch (error) {
    console.error('[Rewards] Error earning rewards:', error);
    return { success: false, error: 'Unexpected error earning rewards' };
  }
}

export async function redeemRewards(userId: string, points: number, reason: string = 'Redemption'): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  if (points <= 0) return { success: false, error: 'Points must be positive to redeem' };
  try {
    const supabase = await createServiceRoleClient();
    const account = await ensureRewardAccount(userId, supabase);
    const currentBalance = Number(account.balance_points);

    if (currentBalance < points) {
      return { success: false, error: 'Insufficient reward points' };
    }

    const newBalance = currentBalance - points;

    const { error: updateError } = await supabase
      .from('reward_accounts')
      .update({ balance_points: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Rewards] Error updating balance:', updateError);
      return { success: false, error: 'Failed to update rewards balance' };
    }

    const { error: ledgerError } = await supabase
      .from('reward_ledger')
      .insert({
        user_id: userId,
        delta_points: -points,
        balance_after: newBalance,
        reason: 'redeem',
        description: reason,
      });

    if (ledgerError) {
      console.error('[Rewards] Error inserting ledger:', ledgerError);
      return { success: false, error: 'Failed to record rewards transaction' };
    }

    return { success: true, newBalance };
  } catch (error) {
    console.error('[Rewards] Error redeeming rewards:', error);
    return { success: false, error: 'Unexpected error redeeming rewards' };
  }
}

// Helper to convert dollars to points based on config
export async function calculateEarnedPoints(amount: number): Promise<number> {
  const config = await getRewardConfig();
  return Math.floor(amount * config.earn_points_per_dollar);
}

// Helper to convert points to dollar value
export async function pointsToDollars(points: number): Promise<number> {
  const config = await getRewardConfig();
  return points / config.points_per_dollar_value;
}

