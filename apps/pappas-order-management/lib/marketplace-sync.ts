export const MARKETPLACE_SYNC_INTERVAL_MS = 15_000;

const MARKETPLACE_AUTO_SYNC_TIME_ZONE = 'Australia/Melbourne';

export function isMarketplaceAutoSyncOpenAt(date: Date) {
  const hour = Number(new Intl.DateTimeFormat('en-AU', {
    timeZone: MARKETPLACE_AUTO_SYNC_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date));
  return hour >= 11 && hour < 20;
}

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

type MarketplaceStatusSyncResult<SyncedOrder> = {
  order: SyncedOrder | null;
  error: string | null;
};

type OpenMarketplaceOrderForHistory = {
  id: string;
  provider: MarketplaceProvider;
  externalOrderId: string;
  workflowUuid: string | null;
  orderStatus: string;
};

type MarketplaceSyncDependencies<Detail, SyncedOrder> = {
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
  getOpenMarketplaceOrdersForHistory: () => Promise<{
    data: OpenMarketplaceOrderForHistory[] | null;
    error: string | null;
  }>;
  syncMarketplaceOrderStatus: (
    provider: MarketplaceProvider,
    externalOrderId: string,
    detail: Detail
  ) => Promise<MarketplaceStatusSyncResult<SyncedOrder>>;
  logError?: (message: string, error: unknown) => void;
  canPoll?: () => boolean;
  setInterval?: (callback: () => void, delayMs: number) => unknown;
  clearInterval?: (handle: unknown) => void;
};

type ManualMarketplaceSyncOrder = {
  order_channel: string;
  delivery_partner_name: string | null;
  external_order_number: string | null;
  marketplace_workflow_uuid: string | null;
};

export type ManualMarketplaceSyncTarget = {
  provider: MarketplaceProvider;
  externalOrderId: string;
  workflowUuid: string;
};

const TERMINAL_ORDER_STATUSES = new Set(['completed', 'cancelled', 'refunded']);

export function getManualMarketplaceSyncTarget(
  order: ManualMarketplaceSyncOrder
): ManualMarketplaceSyncTarget | null {
  if (order.order_channel !== 'third_party') return null;

  const partnerName = order.delivery_partner_name?.trim().toLowerCase();
  const provider = partnerName === 'uber eats'
    ? 'uber_eats'
    : partnerName === 'doordash' || partnerName === 'door dash'
      ? 'doordash'
      : null;
  const externalOrderId = order.external_order_number?.trim();
  const workflowUuid = order.marketplace_workflow_uuid?.trim();

  return provider && externalOrderId && workflowUuid
    ? { provider, externalOrderId, workflowUuid }
    : null;
}

export async function syncMarketplaceOrderOnDemand<Detail, SyncedOrder>(input: {
  provider: MarketplaceProvider;
  externalOrderId: string;
  workflowUuid: string;
  getOrderDetail: (
    provider: MarketplaceProvider,
    workflowUuid: string,
    options: { mode: 'live' | 'history' }
  ) => Promise<Detail>;
  syncMarketplaceOrderStatus: (
    provider: MarketplaceProvider,
    externalOrderId: string,
    detail: Detail
  ) => Promise<MarketplaceStatusSyncResult<SyncedOrder>>;
}): Promise<MarketplaceStatusSyncResult<SyncedOrder>> {
  let detail: Detail;
  try {
    detail = await input.getOrderDetail(input.provider, input.workflowUuid, { mode: 'live' });
  } catch {
    detail = await input.getOrderDetail(input.provider, input.workflowUuid, { mode: 'history' });
  }

  return input.syncMarketplaceOrderStatus(input.provider, input.externalOrderId, detail);
}

export function createMarketplaceSyncCoordinator<Detail, SyncedOrder>(
  dependencies: MarketplaceSyncDependencies<Detail, SyncedOrder>
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

  const syncMissingOrder = async (order: OpenMarketplaceOrderForHistory) => {
    const externalOrderId = order.externalOrderId.trim();
    const workflowUuid = order.workflowUuid?.trim();
    if (
      !externalOrderId
      || !workflowUuid
      || TERMINAL_ORDER_STATUSES.has(order.orderStatus)
    ) {
      return;
    }

    try {
      const detail = await dependencies.getOrderDetail(
        order.provider,
        workflowUuid,
        { mode: 'history' }
      );
      const result = await dependencies.syncMarketplaceOrderStatus(
        order.provider,
        externalOrderId,
        detail
      );
      if (result.error) {
        logError(
          `[marketplace-sync] ${order.provider} order ${externalOrderId} history status failed`,
          result.error
        );
      }
    } catch (error) {
      logError(
        `[marketplace-sync] ${order.provider} order ${externalOrderId} history sync failed`,
        error
      );
    }
  };

  const syncProvider = async (
    provider: MarketplaceProvider,
    openOrdersPromise: Promise<OpenMarketplaceOrderForHistory[]>
  ) => {
    try {
      const [active, openOrders] = await Promise.all([
        dependencies.getActiveOrders(provider),
        openOrdersPromise,
      ]);
      const activeOrderIds = new Set(
        active.orders
          .map((order) => order.orderId.trim())
          .filter(Boolean)
      );
      const missingOrders = openOrders.filter((order) => (
        order.provider === provider
        && !activeOrderIds.has(order.externalOrderId.trim())
      ));

      await Promise.all([
        ...active.orders.map((order) => (
          syncOrder(provider, order.orderId, order.workflowUuid)
        )),
        ...missingOrders.map(syncMissingOrder),
      ]);
    } catch (error) {
      logError(`[marketplace-sync] ${provider} active orders failed`, error);
    }
  };

  const poll = async () => {
    if (inFlight || dependencies.canPoll?.() === false) return;

    inFlight = true;
    try {
      const openOrdersPromise = dependencies.getOpenMarketplaceOrdersForHistory()
        .then((result) => {
          if (result.error) {
            logError('[marketplace-sync] open marketplace orders failed', result.error);
          }
          return result.data ?? [];
        })
        .catch((error) => {
          logError('[marketplace-sync] open marketplace orders failed', error);
          return [];
        });
      await Promise.all(MARKETPLACE_PROVIDERS.map((provider) => (
        syncProvider(provider, openOrdersPromise)
      )));
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
