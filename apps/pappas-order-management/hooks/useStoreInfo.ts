import { useEffect, useState } from 'react';
import { DEFAULT_STORE_INFO, fetchStoreInfo, type StoreInfo } from '@/lib/store-info';
import { supabase } from '@/lib/supabase';

export function useStoreInfo(): StoreInfo {
  const [info, setInfo] = useState(DEFAULT_STORE_INFO);
  useEffect(() => {
    void fetchStoreInfo().then(setInfo).catch(() => undefined);
    const channel = supabase.channel('store-info').on('postgres_changes', { event: '*', schema: 'public', table: 'brand_settings' }, () => void fetchStoreInfo().then(setInfo).catch(() => undefined)).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);
  return info;
}
