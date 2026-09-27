import { DEFAULT_MARKETPLACE_SYNC_INTERVAL_SEC } from '@/lib/marketplace-sync-interval';
import {
  isMarketplaceSyncTimeOpen,
  normalizeMarketplaceSyncWindow,
  type MarketplaceSyncWindow,
} from '@/lib/marketplace-sync-window';

export const MARKETPLACE_SYNC_INTERVAL_MS = DEFAULT_MARKETPLACE_SYNC_INTERVAL_SEC * 1_000;

const MARKETPLACE_AUTO_SYNC_TIME_ZONE = 'Australia/Melbourne';

export function isMarketplaceAutoSyncOpenAt(date: Date, window?: MarketplaceSyncWindow) {
  const time = new Intl.DateTimeFormat('en-AU', {
    timeZone: MARKETPLACE_AUTO_SYNC_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return isMarketplaceSyncTimeOpen(time, normalizeMarketplaceSyncWindow(window));
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

export type MarketplaceProviderSyncConfig = {
  enabled?: boolean;
  intervalMs?: number;
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
  getOpenMarketplaceOrdersForHistory: (provider?: MarketplaceProvider) => Promise<{
    data: OpenMarketplaceOrderForHistory[] | null;
    error: string | null;
  }>;
  syncMarketplaceOrderStatus: (
    provider: MarketplaceProvider,
    externalOrderId: string,
    detail: Detail
  ) => Promise<MarketplaceStatusSyncResult<SyncedOrder>>;
  logError?: (message: string, error: unknown) => void;
  onProviderPollSuccess?: (provider: MarketplaceProvider) => void;
  onProviderPollFailure?: (provider: MarketplaceProvider, error: unknown) => void;
  onPollComplete?: (durationMs: number, provider?: MarketplaceProvider) => void;
  canPoll?: (provider?: MarketplaceProvider) => boolean;
  intervalMs?: number;
  providerConfig?: Partial<Record<MarketplaceProvider, MarketplaceProviderSyncConfig>>;
  setInterval?: (callback: () => void, delayMs: number) => unknown;
  clearInterval?: (handle: unknown) => void;
  setTimeout?: (callback: () => void, delayMs: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  now?: () => number;
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
  const now = dependencies.now ?? (() => Date.now());
  const hasCustomInterval = Boolean(dependencies.setInterval && !dependencies.setTimeout);

  const defaultIntervalMs = Number.isFinite(dependencies.intervalMs)
    ? Math.max(1_000, Math.trunc(dependencies.intervalMs!))
    : MARKETPLACE_SYNC_INTERVAL_MS;

  const hasProviderConfig = Boolean(dependencies.providerConfig);

  const inFlightByProvider: Record<MarketplaceProvider, boolean> = {
    uber_eats: false,
    doordash: false,
  };
  const timerHandleByProvider: Record<MarketplaceProvider, unknown> = {
    uber_eats: null,
    doordash: null,
  };
  const isRunningByProvider: Record<MarketplaceProvider, boolean> = {
    uber_eats: false,
    doordash: false,
  };
  const lastSuccessfulPollAtMs: Record<MarketplaceProvider, number> = {
    uber_eats: 0,
    doordash: 0,
  };

  let legacyIntervalHandle: unknown = null;
  let legacyInFlight = false;
  let legacyRunning = false;
  let legacyLastSuccessfulPollAtMs = 0;

  const isProviderEnabled = (provider: MarketplaceProvider) => {
    if (!hasProviderConfig) return true;
    return dependencies.providerConfig?.[provider]?.enabled !== false;
  };

  const getProviderIntervalMs = (provider: MarketplaceProvider) => {
    const configured = dependencies.providerConfig?.[provider]?.intervalMs;
    if (Number.isFinite(configured)) {
      return Math.max(1_000, Math.trunc(configured!));
    }
    return defaultIntervalMs;
  };

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
      dependencies.onProviderPollSuccess?.(provider);
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
      dependencies.onProviderPollFailure?.(provider, error);
    }
  };

  const pollProvider = async (
    provider: MarketplaceProvider,
    options?: { enforceCooldown?: boolean }
  ) => {
    if (!isProviderEnabled(provider)) return;
    if (inFlightByProvider[provider] || dependencies.canPoll?.(provider) === false) return;

    const interval = getProviderIntervalMs(provider);
    if (options?.enforceCooldown && lastSuccessfulPollAtMs[provider] > 0) {
      const elapsedSinceSuccess = now() - lastSuccessfulPollAtMs[provider];
      if (elapsedSinceSuccess < interval) {
        return;
      }
    }

    inFlightByProvider[provider] = true;
    const startedAtMs = now();
    console.info('[marketplace-sync]', {
      provider,
      operation: 'poll-started',
    });
    try {
      const openOrdersPromise = dependencies.getOpenMarketplaceOrdersForHistory(provider)
        .then((result) => {
          if (result.error) {
            logError(`[marketplace-sync] ${provider} open marketplace orders failed`, result.error);
          }
          return (result.data ?? []).filter((order) => order.provider === provider);
        })
        .catch((error) => {
          logError(`[marketplace-sync] ${provider} open marketplace orders failed`, error);
          return [];
        });

      await syncProvider(provider, openOrdersPromise);
      lastSuccessfulPollAtMs[provider] = now();
    } finally {
      inFlightByProvider[provider] = false;
      const durationMs = now() - startedAtMs;
      console.info('[marketplace-sync]', {
        provider,
        operation: 'poll-completed',
        durationMs,
      });
      dependencies.onPollComplete?.(durationMs, provider);
    }
  };

  const pollLegacy = async (options?: { enforceCooldown?: boolean }) => {
    if (legacyInFlight || dependencies.canPoll?.() === false) return;

    if (options?.enforceCooldown && legacyLastSuccessfulPollAtMs > 0) {
      const elapsedSinceSuccess = now() - legacyLastSuccessfulPollAtMs;
      if (elapsedSinceSuccess < defaultIntervalMs) {
        return;
      }
    }

    legacyInFlight = true;
    const startedAtMs = now();
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
      legacyLastSuccessfulPollAtMs = now();
    } finally {
      legacyInFlight = false;
      dependencies.onPollComplete?.(now() - startedAtMs);
    }
  };

  const poll = async (targetProvider?: MarketplaceProvider) => {
    if (targetProvider) {
      await pollProvider(targetProvider);
      return;
    }

    if (!hasProviderConfig) {
      await pollLegacy();
      return;
    }

    const enabledProviders = MARKETPLACE_PROVIDERS.filter(isProviderEnabled);
    await Promise.all(enabledProviders.map((provider) => pollProvider(provider)));
  };

  const scheduleNextProviderPoll = (provider: MarketplaceProvider, delayMs?: number) => {
    if (!isRunningByProvider[provider] || !isProviderEnabled(provider)) return;

    const interval = delayMs ?? getProviderIntervalMs(provider);
    if (timerHandleByProvider[provider] !== null) {
      const cancelFn = dependencies.clearTimeout ?? globalThis.clearTimeout;
      cancelFn(timerHandleByProvider[provider] as any);
      timerHandleByProvider[provider] = null;
    }

    const scheduleFn = dependencies.setTimeout ?? globalThis.setTimeout;
    timerHandleByProvider[provider] = scheduleFn(async () => {
      timerHandleByProvider[provider] = null;
      if (!isRunningByProvider[provider] || !isProviderEnabled(provider)) return;
      if (inFlightByProvider[provider]) {
        scheduleNextProviderPoll(provider, 1_000);
        return;
      }

      try {
        await pollProvider(provider);
      } finally {
        if (isRunningByProvider[provider] && isProviderEnabled(provider)) {
          scheduleNextProviderPoll(provider);
        }
      }
    }, interval);
  };

  const startProvider = (provider: MarketplaceProvider) => {
    if (isRunningByProvider[provider]) return Promise.resolve();
    if (!isProviderEnabled(provider)) return Promise.resolve();

    isRunningByProvider[provider] = true;
    const interval = getProviderIntervalMs(provider);
    const initialPoll = pollProvider(provider);

    if (hasCustomInterval) {
      timerHandleByProvider[provider] = dependencies.setInterval!(() => {
        if (!isRunningByProvider[provider] || !isProviderEnabled(provider)) return;
        if (inFlightByProvider[provider]) return;
        void pollProvider(provider);
      }, interval);
    } else {
      void initialPoll.finally(() => {
        if (isRunningByProvider[provider] && isProviderEnabled(provider)) {
          scheduleNextProviderPoll(provider);
        }
      });
    }

    return initialPoll;
  };

  const stopProvider = (provider: MarketplaceProvider) => {
    isRunningByProvider[provider] = false;
    const handle = timerHandleByProvider[provider];
    if (handle !== null) {
      if (hasCustomInterval) {
        dependencies.clearInterval?.(handle);
      } else {
        const cancelFn = dependencies.clearTimeout ?? globalThis.clearTimeout;
        cancelFn(handle as any);
      }
      timerHandleByProvider[provider] = null;
    }
  };

  const scheduleNextLegacyPoll = (delayMs = defaultIntervalMs) => {
    if (!legacyRunning) return;
    if (legacyIntervalHandle !== null) {
      const cancelFn = dependencies.clearTimeout ?? globalThis.clearTimeout;
      cancelFn(legacyIntervalHandle as any);
      legacyIntervalHandle = null;
    }

    const scheduleFn = dependencies.setTimeout ?? globalThis.setTimeout;
    legacyIntervalHandle = scheduleFn(async () => {
      legacyIntervalHandle = null;
      if (!legacyRunning) return;
      if (legacyInFlight) {
        scheduleNextLegacyPoll(1_000);
        return;
      }

      try {
        await pollLegacy();
      } finally {
        if (legacyRunning) {
          scheduleNextLegacyPoll(defaultIntervalMs);
        }
      }
    }, delayMs);
  };

  const startLegacy = () => {
    if (legacyRunning) return Promise.resolve();
    legacyRunning = true;
    const initialPoll = pollLegacy();

    if (hasCustomInterval) {
      legacyIntervalHandle = dependencies.setInterval!(() => {
        if (!legacyRunning || legacyInFlight) return;
        void pollLegacy();
      }, defaultIntervalMs);
    } else {
      void initialPoll.finally(() => {
        if (legacyRunning) {
          scheduleNextLegacyPoll(defaultIntervalMs);
        }
      });
    }

    return initialPoll;
  };

  const stopLegacy = () => {
    legacyRunning = false;
    if (legacyIntervalHandle !== null) {
      if (hasCustomInterval) {
        dependencies.clearInterval?.(legacyIntervalHandle);
      } else {
        const cancelFn = dependencies.clearTimeout ?? globalThis.clearTimeout;
        cancelFn(legacyIntervalHandle as any);
      }
      legacyIntervalHandle = null;
    }
  };

  const start = (targetProvider?: MarketplaceProvider) => {
    if (targetProvider) {
      return startProvider(targetProvider);
    }

    if (!hasProviderConfig) {
      return startLegacy();
    }

    const enabledProviders = MARKETPLACE_PROVIDERS.filter(isProviderEnabled);
    return Promise.all(enabledProviders.map(startProvider)).then(() => undefined);
  };

  const stop = (targetProvider?: MarketplaceProvider) => {
    if (targetProvider) {
      stopProvider(targetProvider);
      return;
    }

    if (!hasProviderConfig) {
      stopLegacy();
      return;
    }

    MARKETPLACE_PROVIDERS.forEach(stopProvider);
  };

  const getLastSuccessfulPollAt = (provider?: MarketplaceProvider) => {
    if (provider) return lastSuccessfulPollAtMs[provider] || null;
    const timestamps = Object.values(lastSuccessfulPollAtMs).filter((t) => t > 0);
    if (!hasProviderConfig && legacyLastSuccessfulPollAtMs > 0) {
      timestamps.push(legacyLastSuccessfulPollAtMs);
    }
    return timestamps.length > 0 ? Math.max(...timestamps) : null;
  };

  return { poll, start, stop, getLastSuccessfulPollAt };
}
