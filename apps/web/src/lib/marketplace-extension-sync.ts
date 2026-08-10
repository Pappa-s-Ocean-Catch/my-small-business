import { timingSafeEqual } from 'crypto';

export type MarketplaceExtensionProvider = 'uber_eats' | 'doordash';

type ProviderConfig = Record<string, string | number | boolean | null>;

export function getMarketplaceExtensionCorsHeaders(
  origin: string | null,
  configuredOrigins: string | undefined,
): Record<string, string> {
  const allowedOrigins = (configuredOrigins || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origin || !allowedOrigins.includes(origin)) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Marketplace-Sync-Key',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

type ExtensionCredentialSyncInput = {
  provider: MarketplaceExtensionProvider;
  cookies: string;
  validate: (provider: MarketplaceExtensionProvider, cookies: string) => Promise<{
    ok: boolean;
    error?: string;
    providerConfig?: ProviderConfig;
  }>;
  save: (input: {
    provider: MarketplaceExtensionProvider;
    cookies: string;
    providerConfig?: ProviderConfig;
  }) => Promise<void>;
};

export function isMarketplaceExtensionSecretValid(received: string | null, configured: string) {
  const receivedBuffer = Buffer.from(received || '');
  const configuredBuffer = Buffer.from(configured);
  return receivedBuffer.length === configuredBuffer.length
    && timingSafeEqual(receivedBuffer, configuredBuffer);
}

export async function syncMarketplaceExtensionCredentials(input: ExtensionCredentialSyncInput) {
  const validation = await input.validate(input.provider, input.cookies);
  if (!validation.ok) {
    return { success: false as const, error: validation.error || 'Marketplace session validation failed' };
  }

  await input.save({
    provider: input.provider,
    cookies: input.cookies,
    providerConfig: validation.providerConfig,
  });
  return { success: true as const };
}
