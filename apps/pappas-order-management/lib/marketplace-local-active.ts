import type { MarketplaceProvider } from '@my-small-business/marketplace';

import { getLocalMarketplaceSession, invalidateLocalMarketplaceSession } from './marketplace-local-session';
import { createMarketplaceLocalClient } from './marketplace-local-client';
import { getMarketplaceAndroidCookieTransport } from './marketplace-native-cookie-transport';

const client = createMarketplaceLocalClient({
  getSessionBundle: getLocalMarketplaceSession,
  invalidate: invalidateLocalMarketplaceSession,
  transport: getMarketplaceAndroidCookieTransport(),
});

export const getLocalMarketplaceActiveOrders = (provider: MarketplaceProvider, cursor?: string) => client.getActiveOrders(provider, cursor);
export const getLocalMarketplaceHistory = client.getHistory;
export const getLocalMarketplaceOrderDetail = client.getOrderDetail;
