'use client';

import { useEffect, useState } from 'react';
import { resolveOnlineOrderOverride } from '@/lib/online-order-override';
import { getFeatureFlags, type FeatureFlags } from '@/app/actions/feature-flags';

export type { FeatureFlags };

const DEFAULT_FLAGS: FeatureFlags = {
  enable_pickup_order: true,
  enable_online_payment: true,
  enable_instore_payment: true,
  enable_online_delivery: false,
};

export interface UseFeatureFlagResult {
  /** All flags from DB. Null while loading. */
  flags: FeatureFlags | null;
  /**
   * Resolved "online order enabled": env override (NEXT_PUBLIC_ENABLE_ONLINE_ORDER)
   * takes precedence; when unset, uses flags.enable_pickup_order. Null while loading.
   */
  onlineOrderEnabled: boolean | null;
  /** True until flags are loaded (and onlineOrderEnabled is resolved). */
  isLoading: boolean;
}

/**
 * Loads all feature flags from the database and applies env override for online ordering.
 * Use this hook anywhere you need: online order, delivery, pay online, pay at store.
 */
export function useFeatureFlag(): UseFeatureFlagResult {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getFeatureFlags()
      .then((f) => {
        setFlags(f);
      })
      .catch(() => {
        setFlags(DEFAULT_FLAGS);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const envOverride = resolveOnlineOrderOverride();
  const onlineOrderEnabled: boolean | null = isLoading
    ? null
    : envOverride !== null
      ? envOverride
      : (flags?.enable_pickup_order ?? false);

  return {
    flags,
    onlineOrderEnabled,
    isLoading,
  };
}
