export const ORDER_LIST_SYNC_QUERY_KEYS = [
  ['live-orders'],
  ['on-the-way-orders'],
  ['live-orders', 'pre-order-count'],
  ['pre-orders'],
] as const;

export function createOrderListSync(onFlush: (signalCount: number) => void, delayMs = 250) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let signalCount = 0;

  return {
    notify() {
      if (disposed) return;
      signalCount += 1;
      if (timer) return;

      timer = setTimeout(() => {
        timer = null;
        const flushedSignalCount = signalCount;
        signalCount = 0;
        if (!disposed) onFlush(flushedSignalCount);
      }, delayMs);
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      signalCount = 0;
    },
  };
}
