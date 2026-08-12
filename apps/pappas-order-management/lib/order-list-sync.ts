export const ORDER_LIST_SYNC_QUERY_KEYS = [
  ['live-orders'],
  ['on-the-way-orders'],
  ['live-orders', 'pre-order-count'],
  ['pre-orders'],
] as const;

export function createOrderListSync(onFlush: () => void, delayMs = 250) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  return {
    notify() {
      if (disposed || timer) return;

      timer = setTimeout(() => {
        timer = null;
        if (!disposed) onFlush();
      }, delayMs);
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
