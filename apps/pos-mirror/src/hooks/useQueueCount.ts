import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useQueueCount() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval>;

    const fetchCount = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: fetchedCount, error } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('order_status', ['pending', 'preparing'])
          .gte('created_at', today.toISOString());

        if (error) {
          console.warn('[useQueueCount] failed to fetch count:', error);
          return;
        }
        
        if (mounted && fetchedCount !== null) {
          setCount(fetchedCount);
        }
      } catch (e) {
        console.warn('[useQueueCount] exception during fetch:', e);
      }
    };

    void fetchCount();
    timer = setInterval(fetchCount, 10000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return count;
}
