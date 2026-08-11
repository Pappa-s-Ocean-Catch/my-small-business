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

export async function checkAndApplyUpdate(client: UpdatesClient): Promise<UpdateResult> {
  if (!client.isEnabled) {
    return { kind: 'unavailable' };
  }

  try {
    const update = await client.checkForUpdateAsync();
    if (!update.isAvailable) {
      return { kind: 'up-to-date' };
    }

    await client.fetchUpdateAsync();
    await client.reloadAsync();
    return { kind: 'applied' };
  } catch (error) {
    return { kind: 'failed', message: errorMessage(error) };
  }
}

export async function restartApp(client: UpdatesClient): Promise<UpdateResult> {
  try {
    await client.reloadAsync();
    return { kind: 'restarted' };
  } catch (error) {
    return { kind: 'failed', message: errorMessage(error) };
  }
}
