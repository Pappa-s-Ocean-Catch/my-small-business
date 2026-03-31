'use server';

import { createServiceRoleClient, createServerSupabaseClient } from '@my-small-business/supabase/server';
import { getPostHogClient } from '@/lib/posthog-server';

export interface RewardPointsSettings {
  points_per_dollar: number; // e.g., 10 (1 dollar = 10 points)
  dollars_per_point: number; // e.g., 0.001 (1000 points = 1 dollar)
  enabled: boolean;
}

export interface RewardPointTransaction {
  id: string;
  user_id: string;
  order_id: string | null;
  transaction_type: 'earned' | 'used' | 'expired' | 'adjusted';
  points: number;
  points_balance_after: number;
  description: string | null;
  metadata: any;
  expires_at: string | null;
  created_at: string;
}

export interface UserRewardPoints {
  user_id: string;
  total_points_earned: number;
  total_points_used: number;
  total_points_expired: number;
  current_balance: number;
  last_transaction_at: string | null;
  updated_at: string;
}

export interface OrderRewardPointsSummary {
  orderId: string;
  pointsEarned: number;
  dollarValue: number;
  createdAt: string;
}

const DEFAULT_SETTINGS: RewardPointsSettings = {
  points_per_dollar: 10,
  dollars_per_point: 0.001,
  enabled: true,
};

/**
 * Get reward points settings
 */
export async function getRewardPointsSettings(): Promise<RewardPointsSettings> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'reward_points')
      .maybeSingle();

    if (error) {
      console.error('Error fetching reward points settings:', error);
      return DEFAULT_SETTINGS;
    }

    if (!data?.value) {
      return DEFAULT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...(data.value as Partial<RewardPointsSettings>),
    };
  } catch (error) {
    console.error('Error fetching reward points settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update reward points settings (admin only)
 */
export async function updateRewardPointsSettings(
  settings: Partial<RewardPointsSettings>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Get current settings
    const currentSettings = await getRewardPointsSettings();
    
    // Merge with new settings
    const updatedSettings: RewardPointsSettings = {
      ...currentSettings,
      ...settings,
    };

    // Save to database
    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          key: 'reward_points',
          value: updatedSettings,
        },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Error updating reward points settings:', error);
      return { success: false, error: 'Failed to update reward points settings' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating reward points settings:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get user's reward points balance
 */
export async function getUserRewardPoints(): Promise<{ data: UserRewardPoints | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('user_reward_points')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching user reward points:', error);
      return { data: null, error: error.message };
    }

    // If no record exists, return zero balance
    if (!data) {
      return {
        data: {
          user_id: user.id,
          total_points_earned: 0,
          total_points_used: 0,
          total_points_expired: 0,
          current_balance: 0,
          last_transaction_at: null,
          updated_at: new Date().toISOString(),
        },
        error: null,
      };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching user reward points:', error);
    return { data: null, error: error instanceof Error ? error.message : 'Failed to fetch reward points' };
  }
}

/**
 * Get user's reward point transactions
 */
export async function getUserRewardPointTransactions(
  limit: number = 50
): Promise<{ data: RewardPointTransaction[]; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { data: [], error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('reward_point_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching reward point transactions:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching reward point transactions:', error);
    return { data: [], error: error instanceof Error ? error.message : 'Failed to fetch transactions' };
  }
}

/**
 * Earn reward points for a paid order (called after payment success)
 * Points are earned only on the food subtotal, not on fees, tax, or delivery
 */
export async function earnRewardPoints(
  userId: string,
  orderId: string,
  foodSubtotal: number // Only food price, excluding fees, tax, delivery
): Promise<{ success: boolean; error?: string; pointsEarned?: number }> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Check if reward points are enabled
    const settings = await getRewardPointsSettings();
    if (!settings.enabled) {
      return { success: false, error: 'Reward points are disabled' };
    }

    // Calculate points earned (only on food subtotal)
    const pointsEarned = Math.floor(foodSubtotal * settings.points_per_dollar);

    if (pointsEarned <= 0) {
      return { success: false, error: 'No points earned for this order amount' };
    }

    // Get current balance
    const { data: currentBalance } = await supabase
      .from('user_reward_points')
      .select('current_balance')
      .eq('user_id', userId)
      .maybeSingle();

    const balanceBefore = currentBalance?.current_balance || 0;
    const balanceAfter = balanceBefore + pointsEarned;

    // Create transaction
    const { error: transactionError } = await supabase
      .from('reward_point_transactions')
      .insert({
        user_id: userId,
        order_id: orderId,
        transaction_type: 'earned',
        points: pointsEarned,
        points_balance_after: balanceAfter,
        description: `Earned ${pointsEarned} points for order payment`,
        metadata: {
          food_subtotal: foodSubtotal,
          points_per_dollar: settings.points_per_dollar,
          dollar_value: Number((pointsEarned * settings.dollars_per_point).toFixed(2)),
        },
      });

    if (transactionError) {
      console.error('Error creating reward point transaction:', transactionError);
      return { success: false, error: 'Failed to record reward points' };
    }

    return { success: true, pointsEarned };
  } catch (error) {
    console.error('Error earning reward points:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get reward points earned for a specific order
 * Uses the concrete value stored at order time (from transaction metadata)
 */
export async function getOrderRewardPoints(
  orderId: string
): Promise<{ data: OrderRewardPointsSummary | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from('reward_point_transactions')
      .select('points, metadata, created_at, order_id')
      .eq('order_id', orderId)
      .eq('transaction_type', 'earned')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching order reward points:', error);
      return { data: null, error: error.message };
    }

    if (!data) {
      return { data: null, error: null };
    }

    const metadata = (data.metadata ?? {}) as { dollar_value?: number };
    const dollarValueFromMetadata =
      typeof metadata.dollar_value === 'number' ? metadata.dollar_value : undefined;

    let dollarValue = dollarValueFromMetadata;

    // Fallback: compute from current settings if dollar_value was not stored
    if (dollarValue === undefined) {
      const settings = await getRewardPointsSettings();
      dollarValue = Number((data.points * settings.dollars_per_point).toFixed(2));
    }

    return {
      data: {
        orderId,
        pointsEarned: data.points,
        dollarValue: dollarValue,
        createdAt: data.created_at,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error fetching order reward points:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch order reward points',
    };
  }
}

/**
 * Use reward points for an order (called during checkout)
 */
export async function useRewardPoints(
  userId: string,
  orderId: string,
  pointsToUse: number
): Promise<{ success: boolean; error?: string; dollarValue?: number }> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Check if reward points are enabled
    const settings = await getRewardPointsSettings();
    if (!settings.enabled) {
      return { success: false, error: 'Reward points are disabled' };
    }

    // Get current balance
    const { data: userPoints } = await supabase
      .from('user_reward_points')
      .select('current_balance')
      .eq('user_id', userId)
      .maybeSingle();

    const currentBalance = userPoints?.current_balance || 0;

    if (currentBalance < pointsToUse) {
      return { success: false, error: 'Insufficient reward points' };
    }

    // Calculate dollar value
    const dollarValue = pointsToUse * settings.dollars_per_point;

    const balanceAfter = currentBalance - pointsToUse;

    // Create transaction
    const { error: transactionError } = await supabase
      .from('reward_point_transactions')
      .insert({
        user_id: userId,
        order_id: orderId,
        transaction_type: 'used',
        points: -pointsToUse, // Negative for used
        points_balance_after: balanceAfter,
        description: `Used ${pointsToUse} points ($${dollarValue.toFixed(2)}) for order`,
        metadata: {
          points_used: pointsToUse,
          dollar_value: dollarValue,
          dollars_per_point: settings.dollars_per_point,
        },
      });

    if (transactionError) {
      console.error('Error creating reward point transaction:', transactionError);
      return { success: false, error: 'Failed to use reward points' };
    }

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: 'reward_points_applied',
      properties: {
        user_id: userId,
        order_id: orderId,
        points_used: pointsToUse,
        dollar_value: dollarValue,
        balance_after: balanceAfter,
      },
    });
    await posthog.shutdown();

    return { success: true, dollarValue };
  } catch (error) {
    console.error('Error using reward points:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
