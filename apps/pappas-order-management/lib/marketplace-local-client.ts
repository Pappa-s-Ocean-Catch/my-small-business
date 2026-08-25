import {
  createMarketplaceProviderClient,
  type MarketplaceHistoryOptions,
  type MarketplaceOrderDetailMode,
  type MarketplaceProvider,
  type MarketplaceProviderClient,
  type MarketplaceSessionBundle,
  type MarketplaceTransport,
} from '@my-small-business/marketplace';

export const MARKETPLACE_SESSION_TTL_MS = 3_600_000;

type LocalClientInput = {
  getSessionBundle: (provider: MarketplaceProvider) => Promise<MarketplaceSessionBundle>;
  invalidate: (provider?: MarketplaceProvider) => void;
  transport?: MarketplaceTransport;
  createProviderClient?: (getSession: (provider: MarketplaceProvider) => Promise<MarketplaceSessionBundle>) => MarketplaceProviderClient;
};

function isUnauthorized(error: unknown) {
  return error instanceof Error && /\(401\)/.test(error.message);
}

export function createMarketplaceLocalClient(input: LocalClientInput): MarketplaceProviderClient & { invalidate(provider?: MarketplaceProvider): void } {
  const providerClient = input.createProviderClient
    ? input.createProviderClient(input.getSessionBundle)
    : createMarketplaceProviderClient({ getSession: input.getSessionBundle, transport: input.transport });
  const retryOnce = async <T>(provider: MarketplaceProvider, operation: () => Promise<T>) => {
    try {
      return await operation();
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
      input.invalidate(provider);
      return operation();
    }
  };
  return {
    getActiveOrders: (provider, cursor) => retryOnce(provider, () => providerClient.getActiveOrders(provider, cursor)),
    getHistory: (provider, options?: MarketplaceHistoryOptions) => retryOnce(provider, () => providerClient.getHistory(provider, options)),
    getOrderDetail: (provider, workflowUuid, options?: { mode?: MarketplaceOrderDetailMode }) => retryOnce(provider, () => providerClient.getOrderDetail(provider, workflowUuid, options)),
    invalidate: input.invalidate,
  };
}
