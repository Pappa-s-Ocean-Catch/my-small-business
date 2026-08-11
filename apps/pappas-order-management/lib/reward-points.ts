import { supabase } from './supabase';
import { getApiUrl } from '../utils/orderUtils';

export type RewardPointsSettings = {
  points_per_dollar: number;
  dollars_per_point: number;
  enabled: boolean;
};

const DEFAULT_SETTINGS: RewardPointsSettings = {
  points_per_dollar: 10,
  dollars_per_point: 0.001,
  enabled: true,
};

export async function fetchRewardPointsSettings(): Promise<RewardPointsSettings> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'reward_points')
      .maybeSingle();

    if (error || !data?.value) {
      return DEFAULT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...(data.value as Partial<RewardPointsSettings>),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function applyRewardPointsToOrder(input: {
  userId: string;
  orderId: string;
  pointsToUse: number;
}): Promise<{ success: boolean; error?: string; dollarValue?: number }> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      return { success: false, error: sessionError?.message || 'Missing authenticated session' };
    }

    const response = await fetch(getApiUrl('/api/reward-points/use'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null) as
      | { success?: boolean; error?: string; dollarValue?: number }
      | null;

    if (!response.ok || !payload?.success) {
      return { success: false, error: payload?.error || `Reward points request failed (${response.status})` };
    }

    return {
      success: true,
      dollarValue: typeof payload.dollarValue === 'number' ? payload.dollarValue : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply reward points',
    };
  }
}

export async function adjustCustomerRewardPoints(input: {
  userId: string;
  pointsDelta: number;
  description: string;
}): Promise<{ success: boolean; error?: string; balanceAfter?: number }> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      return { success: false, error: sessionError?.message || 'Missing authenticated session' };
    }

    const response = await fetch(getApiUrl('/api/reward-points/adjust'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null) as
      | { success?: boolean; error?: string; balanceAfter?: number }
      | null;

    if (!response.ok || !payload?.success) {
      return {
        success: false,
        error: payload?.error || `Reward points adjustment failed (${response.status})`,
      };
    }

    return {
      success: true,
      balanceAfter: typeof payload.balanceAfter === 'number' ? payload.balanceAfter : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to adjust reward points',
    };
  }
}
