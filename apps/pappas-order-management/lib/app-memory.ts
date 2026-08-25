export type AppMemorySample = {
  totalBytes: number;
  appFootprintBytes: number;
  availableBytes: number | null;
};

export type AppMemoryClient = {
  getCurrentMemoryAsync(): Promise<AppMemorySample>;
};

export type AppMemorySnapshot =
  | {
      kind: 'available';
      totalBytes: number;
      appFootprintBytes: number;
      availableBytes: number | null;
      formattedTotal: string;
      formattedAppFootprint: string;
      formattedAvailable: string;
    }
  | { kind: 'unavailable' }
  | { kind: 'failed'; message: string };

export async function getAppMemorySnapshot(client: AppMemoryClient | null): Promise<AppMemorySnapshot> {
  if (!client) {
    return { kind: 'unavailable' };
  }

  try {
    const { totalBytes, appFootprintBytes, availableBytes } = await client.getCurrentMemoryAsync();
    if (
      !Number.isFinite(totalBytes) ||
      !Number.isFinite(appFootprintBytes) ||
      totalBytes <= 0 ||
      appFootprintBytes < 0 ||
      (availableBytes !== null && (!Number.isFinite(availableBytes) || availableBytes < 0))
    ) {
      throw new Error('Native memory lookup returned an invalid footprint');
    }

    return {
      kind: 'available',
      totalBytes,
      appFootprintBytes,
      availableBytes,
      formattedTotal: formatMemoryBytes(totalBytes),
      formattedAppFootprint: formatMemoryBytes(appFootprintBytes),
      formattedAvailable: availableBytes === null ? 'Not reported by this platform' : formatMemoryBytes(availableBytes),
    };
  } catch (error) {
    return {
      kind: 'failed',
      message: error instanceof Error ? error.message : 'Unable to read app memory',
    };
  }
}

function formatMemoryBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1024 ? `${(megabytes / 1024).toFixed(1)} GB` : `${megabytes.toFixed(1)} MB`;
}
