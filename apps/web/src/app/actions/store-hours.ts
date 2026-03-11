'use server';

import { createServerSupabaseClient } from '@my-small-business/supabase/server';
import type { StoreHours } from '@my-small-business/types';
import {
  buildDefaultStoreHours,
  isStoreOpenNow,
  getPickupTimeSlots,
  type PickupDayOption,
} from '@/lib/store-hours';

interface DefaultsValue {
  store_open_time?: string;
  store_close_time?: string;
}

export interface StoreHoursForOrderResult {
  storeHours: StoreHours;
  isOpenNow: boolean;
  pickupDayOptions: PickupDayOption[];
}

/** Load store hours from settings (key store_hours). Fallback to defaults (store_open_time, store_close_time) for all days. */
export async function getStoreHoursForOrder(): Promise<StoreHoursForOrderResult> {
  const supabase = await createServerSupabaseClient();

  const { data: storeHoursRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'store_hours')
    .maybeSingle();

  const { data: defaultsRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'defaults')
    .maybeSingle();

  let storeHours: StoreHours;

  const storeHoursValue = storeHoursRow?.value as StoreHours | undefined;
  if (storeHoursValue && typeof storeHoursValue === 'object') {
    storeHours = storeHoursValue;
  } else {
    const defaults = (defaultsRow?.value as DefaultsValue | undefined) ?? {};
    const open = defaults.store_open_time ?? '10:00';
    const close = defaults.store_close_time ?? '21:00';
    storeHours = buildDefaultStoreHours(open, close);
  }

  const isOpenNow = isStoreOpenNow(storeHours);
  const fromDate = new Date();
  const pickupDayOptions = getPickupTimeSlots(storeHours, fromDate, {
    numDays: 14,
    intervalMinutes: 15,
  });

  return { storeHours, isOpenNow, pickupDayOptions };
}
