export type BuildMetadata = {
  appVersion: string;
  buildDate: string;
  gitSha: string;
};

export type UpdateResult =
  | { kind: 'unavailable' }
  | { kind: 'up-to-date' }
  | { kind: 'applied' }
  | { kind: 'restarted' }
  | { kind: 'failed'; message: string };

export type UpdatesClient = {
  isEnabled: boolean;
  checkForUpdateAsync(): Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync(): Promise<unknown>;
  reloadAsync(): Promise<void>;
};

type ReloadFailureHandler = (result: Extract<UpdateResult, { kind: 'failed' }>) => void;
type ReloadHandlers = {
  onStarted?: () => void;
  onFailure?: ReloadFailureHandler;
};

type PublicEnv = Record<string, string | undefined>;

function metadataValue(value: string | undefined): string {
  return value?.trim() || 'Unknown';
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Unable to complete the update action.';
}

export function getBuildMetadata(env: PublicEnv, appVersion: string): BuildMetadata {
  return {
    appVersion: metadataValue(appVersion),
    buildDate: metadataValue(env.EXPO_PUBLIC_BUILD_DATE),
    gitSha: metadataValue(env.EXPO_PUBLIC_GIT_SHA),
  };
}

function initiateReload(client: UpdatesClient, handlers?: ReloadHandlers): void {
  handlers?.onStarted?.();

  // Expo schedules the native reload after this call resolves. Do not await it or
  // run UI cleanup in that continuation: the native runtime may already be gone.
  void client.reloadAsync().catch((error) => {
    handlers?.onFailure?.({ kind: 'failed', message: errorMessage(error) });
  });
}

export async function checkAndApplyUpdate(
  client: UpdatesClient,
  reloadHandlers?: ReloadHandlers,
): Promise<UpdateResult> {
  if (!client.isEnabled) {
    return { kind: 'unavailable' };
  }

  try {
    const update = await client.checkForUpdateAsync();
    if (!update.isAvailable) {
      return { kind: 'up-to-date' };
    }

    await client.fetchUpdateAsync();
    initiateReload(client, reloadHandlers);
    return { kind: 'applied' };
  } catch (error) {
    return { kind: 'failed', message: errorMessage(error) };
  }
}

export function restartApp(client: UpdatesClient, reloadHandlers?: ReloadHandlers): UpdateResult {
  if (!client.isEnabled) {
    return { kind: 'unavailable' };
  }

  initiateReload(client, reloadHandlers);

  return { kind: 'restarted' };
}
