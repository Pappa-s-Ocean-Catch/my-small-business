import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  buildMirrorOrderSnapshot,
  type MirrorCartInput,
} from '@my-small-business/pos-mirror';

import { loadSmartpayRegisterId } from '../lib/smartpay';
import { supabase } from '../lib/supabase';
import {
  createPosMirrorPublisher,
  type PosMirrorPublisher,
} from '../lib/pos-mirror-publisher';

const POS_MIRROR_DEBOUNCE_MS = 150;

export function usePosMirrorPublisher(input: MirrorCartInput): {
  publishCurrentCart: () => Promise<void>;
  clearMirrorAfterCheckout: () => Promise<void>;
} {
  const publisherRef = useRef<PosMirrorPublisher | null>(null);

  if (!publisherRef.current) {
    publisherRef.current = createPosMirrorPublisher({
      loadRegisterId: loadSmartpayRegisterId,
      upsert: async (row) => {
        const { error } = await supabase
          .from('pos_mirror_state')
          .upsert(row, { onConflict: 'register_id' });
        if (error) throw error;
      },
      debounceMs: POS_MIRROR_DEBOUNCE_MS,
    });
  }

  const publisher = publisherRef.current;
  const snapshot = useMemo(() => {
    try {
      return buildMirrorOrderSnapshot(input);
    } catch (error) {
      console.warn('POS mirror snapshot build failed', error);
      return null;
    }
  }, [input.discount, input.items, input.subtotal, input.total]);

  useEffect(() => {
    if (snapshot) publisher.schedule(snapshot);
  }, [publisher, snapshot]);

  const publishCurrentCart = useCallback(async (): Promise<void> => {
    if (!snapshot) return;
    publisher.schedule(snapshot);
    await publisher.flush();
  }, [publisher, snapshot]);

  const clearMirrorAfterCheckout = useCallback(async (): Promise<void> => {
    publisher.schedule({});
    await publisher.flush();
  }, [publisher]);

  return { publishCurrentCart, clearMirrorAfterCheckout };
}
