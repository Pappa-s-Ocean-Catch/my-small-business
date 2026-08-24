import type { MarketplaceProviderClient } from '@my-small-business/marketplace';
import type { MarketplaceFetchMode } from './settings';

export function createMarketplaceClient(input: { getMode: () => MarketplaceFetchMode; api: MarketplaceProviderClient; local: MarketplaceProviderClient }): MarketplaceProviderClient {
  return {
    getActiveOrders: (provider, cursor) => (input.getMode() === 'local' ? input.local : input.api).getActiveOrders(provider, cursor),
    getHistory: (provider, options) => (input.getMode() === 'local' ? input.local : input.api).getHistory(provider, options),
    getOrderDetail: (provider, workflowUuid, options) => (input.getMode() === 'local' ? input.local : input.api).getOrderDetail(provider, workflowUuid, options),
  };
}
