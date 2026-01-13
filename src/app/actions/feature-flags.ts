'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';

export interface FeatureFlags {
  enable_pickup_order: boolean;
  enable_online_payment: boolean;
  enable_instore_payment: boolean;
  enable_online_delivery: boolean;
}

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enable_pickup_order: true,
  enable_online_payment: true,
  enable_instore_payment: true,
  enable_online_delivery: false,
};

export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'feature_flags')
      .maybeSingle();

    if (error) {
      console.error('Error fetching feature flags:', error);
      return DEFAULT_FEATURE_FLAGS;
    }

    if (!data?.value) {
      return DEFAULT_FEATURE_FLAGS;
    }

    // Merge with defaults to ensure all flags are present
    return {
      ...DEFAULT_FEATURE_FLAGS,
      ...(data.value as Partial<FeatureFlags>),
    };
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return DEFAULT_FEATURE_FLAGS;
  }
}

export async function updateFeatureFlags(flags: Partial<FeatureFlags>): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Get current flags
    const currentFlags = await getFeatureFlags();
    
    // Merge with new flags
    const updatedFlags: FeatureFlags = {
      ...currentFlags,
      ...flags,
    };

    // Save to database
    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          key: 'feature_flags',
          value: updatedFlags,
        },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Error updating feature flags:', error);
      return { success: false, error: 'Failed to update feature flags' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating feature flags:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
