import type { MarketplaceProvider, MarketplaceSessionBundle } from './contracts';

export const MARKETPLACE_SESSION_TTL_MS = 60 * 60 * 1_000;

export function createSessionCache(input: {
  now: () => number;
  load: (provider: MarketplaceProvider) => Promise<MarketplaceSessionBundle>;
}) {
  const cache = new Map<MarketplaceProvider, { value: MarketplaceSessionBundle; loadedAt: number }>();

  const get = async (provider: MarketplaceProvider) => {
    const existing = cache.get(provider);
    if (existing && input.now() - existing.loadedAt < MARKETPLACE_SESSION_TTL_MS) {
      return existing.value;
    }
    const value = await input.load(provider);
    cache.set(provider, { value, loadedAt: input.now() });
    return value;
  };

  const invalidate = (provider?: MarketplaceProvider) => {
    if (provider) cache.delete(provider);
    else cache.clear();
  };

  return { get, invalidate };
}
