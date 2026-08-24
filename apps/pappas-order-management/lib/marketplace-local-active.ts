import type { MarketplaceProvider } from '@my-small-business/marketplace';

import { getLocalMarketplaceSession, invalidateLocalMarketplaceSession } from './marketplace-local-session';
import { createMarketplaceLocalClient } from './marketplace-local-client';

const client = createMarketplaceLocalClient({ getSessionBundle: getLocalMarketplaceSession, invalidate: invalidateLocalMarketplaceSession });

export const getLocalMarketplaceActiveOrders = (provider: MarketplaceProvider, cursor?: string) => client.getActiveOrders(provider, cursor);
export const getLocalMarketplaceHistory = client.getHistory;
export const getLocalMarketplaceOrderDetail = client.getOrderDetail;
