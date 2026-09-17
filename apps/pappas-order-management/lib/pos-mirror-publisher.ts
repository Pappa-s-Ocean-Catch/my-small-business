import {
  createLatestWriteQueue,
  type EmptyMirrorOrder,
  type MirrorOrderSnapshotV1,
} from '@my-small-business/pos-mirror';

export type PosMirrorOrder = MirrorOrderSnapshotV1 | EmptyMirrorOrder;

export type PosMirrorRow = {
  register_id: string;
  register_name?: string;
  current_order: PosMirrorOrder;
};

export type PosMirrorPublisher = {
  schedule(snapshot: PosMirrorOrder): void;
  flush(): Promise<void>;
  flushBestEffort(): void;
};

export type CreatePosMirrorPublisherOptions = {
  loadRegister: () => Promise<{ id: string; name: string }>;
  upsert: (row: PosMirrorRow) => Promise<void>;
  debounceMs: number;
  logError?: (message: string, error: unknown) => void;
};

export type PosMirrorPublisherStore = {
  getOrCreate(options: CreatePosMirrorPublisherOptions): PosMirrorPublisher;
};

const registerSuffix = (registerId: string | null): string => (
  registerId ? `…${registerId.slice(-4)}` : 'unknown'
);

export function createPosMirrorPublisher({
  loadRegister,
  upsert,
  debounceMs,
  logError = (message, error) => console.warn(message, error),
}: CreatePosMirrorPublisherOptions): PosMirrorPublisher {
  let registerPromise: Promise<{ id: string; name: string }> | null = null;
  let lastRegisterId: string | null = null;
  let scheduledSnapshot: PosMirrorOrder | null = null;
  let hasScheduledSnapshot = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const getRegister = (): Promise<{ id: string; name: string }> => {
    if (registerPromise) return registerPromise;

    const currentLoad = loadRegister();
    registerPromise = currentLoad;
    void currentLoad.then((register) => {
      lastRegisterId = register.id;
    }).catch(() => {
      if (registerPromise === currentLoad) registerPromise = null;
    });
    return currentLoad;
  };

  const queue = createLatestWriteQueue<PosMirrorOrder>(async (currentOrder) => {
    try {
      const register = await getRegister();
      lastRegisterId = register.id;
      await upsert({
        register_id: register.id,
        register_name: register.name,
        current_order: currentOrder,
      });
    } catch (error) {
      logError(`POS mirror publish failed for register ${registerSuffix(lastRegisterId)}`, error);
      throw error;
    }
  });

  const enqueueScheduledSnapshot = (): void => {
    if (!hasScheduledSnapshot || scheduledSnapshot === null) return;

    const snapshot = scheduledSnapshot;
    scheduledSnapshot = null;
    hasScheduledSnapshot = false;
    debounceTimer = null;
    queue.request(snapshot);
  };

  const flush = async (): Promise<void> => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    enqueueScheduledSnapshot();

    try {
      await queue.flush();
    } catch {
      // Mirror availability must never affect checkout or other POS work.
    }
  };

  return {
    schedule(snapshot): void {
      scheduledSnapshot = snapshot;
      hasScheduledSnapshot = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(enqueueScheduledSnapshot, debounceMs);
    },

    flush,

    flushBestEffort(): void {
      void flush();
    },
  };
}

export function createPosMirrorPublisherStore(): PosMirrorPublisherStore {
  let publisher: PosMirrorPublisher | null = null;

  return {
    getOrCreate(options): PosMirrorPublisher {
      if (!publisher) publisher = createPosMirrorPublisher(options);
      return publisher;
    },
  };
}
