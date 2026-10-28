import type { Order } from '@my-small-business/types';
import type { SoundId } from './sound-assets.generated';
import { getOrderChannel, shouldPlayOrderSound } from '../utils/orderUtils';

export type MarketplaceSoundSettings = {
  marketplaceUberSoundEnabled: boolean;
  marketplaceUberSoundId: SoundId;
  marketplaceUberSoundRepeatCount: number;
  marketplaceDoorDashSoundEnabled: boolean;
  marketplaceDoorDashSoundId: SoundId;
  marketplaceDoorDashSoundRepeatCount: number;
};
export const DEFAULT_MARKETPLACE_SOUND_SETTINGS: MarketplaceSoundSettings = {
  marketplaceUberSoundEnabled: true,
  marketplaceUberSoundId: 'so-proud-notification',
  marketplaceUberSoundRepeatCount: 3,
  marketplaceDoorDashSoundEnabled: true,
  marketplaceDoorDashSoundId: 'so-proud-notification',
  marketplaceDoorDashSoundRepeatCount: 3,
};
export function normalizeMarketplaceSoundSettings(value: unknown, sounds: readonly { id: string }[]): MarketplaceSoundSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const result = { ...DEFAULT_MARKETPLACE_SOUND_SETTINGS };
  for (const provider of ['Uber', 'DoorDash'] as const) {
    const enabled = `marketplace${provider}SoundEnabled` as const;
    const id = `marketplace${provider}SoundId` as const;
    const count = `marketplace${provider}SoundRepeatCount` as const;
    if (typeof v[enabled] === 'boolean') result[enabled] = v[enabled];
    if (sounds.some(sound => sound.id === v[id])) result[id] = v[id] as SoundId;
    const repeats = v[count];
    if (typeof repeats === 'number' && Number.isFinite(repeats)) result[count] = Math.min(10, Math.max(1, Math.trunc(repeats)));
  }
  return result;
}

type SoundOrder = Pick<Order, 'order_channel' | 'payment_method' | 'customer_name' | 'scheduled_pickup_at'> & Partial<Pick<Order, 'delivery_partner_name' | 'payment_method_detail'>>;
type Settings = MarketplaceSoundSettings & { soundEnabled: boolean; soundId: SoundId; soundRepeatCount: number };
/** Marketplace alarms never inherit the online/scheduled-order alarm preferences. */
export function getOrderSoundOptions(order: SoundOrder, settings: Settings) {
  if (getOrderChannel(order) === 'third_party') {
    const sources = [order.delivery_partner_name, order.payment_method_detail].map(v => v?.toLowerCase().replace(/[^a-z]/g, ''));
    const provider = sources.map(v => v === 'ubereats' || v === 'uber' ? 'Uber' as const : v === 'doordash' ? 'DoorDash' as const : null).find(Boolean);
    if (!provider || !settings[`marketplace${provider}SoundEnabled`]) return null;
    return { soundId: settings[`marketplace${provider}SoundId`], repeatCount: settings[`marketplace${provider}SoundRepeatCount`], delayMs: 1000 };
  }
  return settings.soundEnabled && shouldPlayOrderSound(order)
    ? { soundId: settings.soundId, repeatCount: settings.soundRepeatCount, delayMs: 1000 }
    : null;
}
