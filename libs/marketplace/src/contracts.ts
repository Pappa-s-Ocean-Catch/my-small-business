export type MarketplaceProvider = 'uber_eats' | 'doordash';

export type MarketplaceProviderConfig = Record<string, string | number | boolean | null>;

export type MarketplaceSessionBundle = {
  provider: MarketplaceProvider;
  cookies: string;
  providerConfig: MarketplaceProviderConfig;
  updatedAt: string | null;
};

export type MarketplaceHistoryDateRange = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_12_WEEKS' | 'CUSTOM';
export type MarketplaceHistoryOptions = { cursor?: string; dateRange?: MarketplaceHistoryDateRange; statuses?: string[]; mode?: 'history' | 'scheduled' };
export type MarketplaceOrderDetailMode = 'history' | 'live';
export type MarketplaceActiveOrder = { orderId: string; workflowUuid: string; orderUuid: string; customerName: string; salesTotal: string; requestedAt: string; courierName: string; fulfillmentType: string; orderChannel: string; status: string; statusDescription: string };
export type MarketplaceActiveResult = { provider: MarketplaceProvider; orders: MarketplaceActiveOrder[]; nextCursor: string | null };
export type MarketplaceHistoryOrder = { orderId: string; workflowUuid: string; orderUuid: string; customerName: string; salesTotal: string; netPayout: string; requestedAt: string; courierName: string; fulfillmentType: string; issueType: string; orderChannel: string; isSubscriber: boolean; subscriptionPass: string };
export type MarketplaceHistoryResult = { provider: MarketplaceProvider; orders: MarketplaceHistoryOrder[]; nextCursor: string | null };
export type MarketplaceOrderDetail = Record<string, unknown> & { provider: MarketplaceProvider; workflowUuid: string; orderId: string; orderUUID: string };
export type MarketplaceTransport = (input: { url: string; init: RequestInit }) => Promise<Response>;
export type MarketplaceProviderClient = {
  getActiveOrders(provider: MarketplaceProvider, cursor?: string): Promise<MarketplaceActiveResult>;
  getHistory(provider: MarketplaceProvider, options?: MarketplaceHistoryOptions): Promise<MarketplaceHistoryResult>;
  getOrderDetail(provider: MarketplaceProvider, workflowUuid: string, options?: { mode?: MarketplaceOrderDetailMode }): Promise<MarketplaceOrderDetail>;
};
