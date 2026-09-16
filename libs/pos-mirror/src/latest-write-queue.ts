export type LatestWriteQueue<T> = {
  request(value: T): void;
  flush(): Promise<void>;
};

export function createLatestWriteQueue<T>(write: (value: T) => Promise<void>): LatestWriteQueue<T> {
  let pendingValue: T;
  let hasPendingValue = false;
  let activeDrain: Promise<void> | null = null;

  const drain = async (): Promise<void> => {
    let firstError: unknown;

    while (hasPendingValue) {
      const value = pendingValue;
      hasPendingValue = false;

      try {
        await write(value);
      } catch (error) {
        firstError ??= error;
      }
    }

    if (firstError !== undefined) {
      throw firstError;
    }
  };

  const startDrain = (): void => {
    if (activeDrain || !hasPendingValue) {
      return;
    }

    const currentDrain = drain();
    activeDrain = currentDrain;
    void currentDrain.catch(() => undefined);
    void currentDrain.finally(() => {
      if (activeDrain === currentDrain) {
        activeDrain = null;
        startDrain();
      }
    }).catch(() => undefined);
  };

  return {
    request(value: T): void {
      pendingValue = value;
      hasPendingValue = true;
      startDrain();
    },

    async flush(): Promise<void> {
      while (activeDrain) {
        await activeDrain;
      }
    },
  };
}
