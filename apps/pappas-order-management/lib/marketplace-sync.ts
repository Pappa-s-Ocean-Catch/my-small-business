export const MARKETPLACE_SYNC_INTERVAL_MS = 30_000;

type MarketplaceProvider = 'uber_eats' | 'doordash';

const MARKETPLACE_PROVIDERS: readonly MarketplaceProvider[] = [
  'uber_eats',
  'doordash',
];

type MarketplaceImportResult = {
  order: unknown;
  created: boolean;
  error: string | null;
};

type MarketplaceSyncDependencies<Detail> = {
  getActiveOrders: (
    provider: MarketplaceProvider,
    cursor?: string
  ) => Promise<{
    orders: Array<{ orderId: string; workflowUuid: string }>;
  }>;
  getOrderDetail: (
    provider: MarketplaceProvider,
    workflowUuid: string,
    options?: { mode?: 'history' | 'live' }
  ) => Promise<Detail>;
  importMarketplaceOrder: (
    detail: Detail
  ) => Promise<MarketplaceImportResult>;
  logError?: (message: string, error: unknown) => void;
  setInterval?: (callback: () => void, delayMs: number) => unknown;
  clearInterval?: (handle: unknown) => void;
};

export function createMarketplaceSyncCoordinator<Detail>(
  dependencies: MarketplaceSyncDependencies<Detail>
) {
  const logError = dependencies.logError ?? ((message: string, error: unknown) => {
    console.error(message, error);
  });
  const scheduleInterval = dependencies.setInterval ?? ((callback, delayMs) => (
    globalThis.setInterval(callback, delayMs)
  ));
  const cancelInterval = dependencies.clearInterval ?? ((handle) => {
    globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>);
  });

  let intervalHandle: unknown = null;
  let inFlight = false;

  const syncOrder = async (
    provider: MarketplaceProvider,
    orderId: string,
    workflowUuid: string
  ) => {
    try {
      const detail = await dependencies.getOrderDetail(provider, workflowUuid, { mode: 'live' });
      const result = await dependencies.importMarketplaceOrder(detail);
      if (result.error) {
        logError(
          `[marketplace-sync] ${provider} order ${orderId} import failed`,
          result.error
        );
      }
    } catch (error) {
      logError(
        `[marketplace-sync] ${provider} order ${orderId} sync failed`,
        error
      );
    }
  };

  const syncProvider = async (provider: MarketplaceProvider) => {
    try {
      const active = await dependencies.getActiveOrders(provider);
      await Promise.all(active.orders.map((order) => (
        syncOrder(provider, order.orderId, order.workflowUuid)
      )));
    } catch (error) {
      logError(`[marketplace-sync] ${provider} active orders failed`, error);
    }
  };

  const poll = async () => {
    if (inFlight) return;

    inFlight = true;
    try {
      await Promise.all(MARKETPLACE_PROVIDERS.map(syncProvider));
    } finally {
      inFlight = false;
    }
  };

  const start = () => {
    if (intervalHandle !== null) return Promise.resolve();

    const initialPoll = poll();
    intervalHandle = scheduleInterval(() => {
      void poll();
    }, MARKETPLACE_SYNC_INTERVAL_MS);
    return initialPoll;
  };

  const stop = () => {
    if (intervalHandle === null) return;
    cancelInterval(intervalHandle);
    intervalHandle = null;
  };

  return { poll, start, stop };
}
