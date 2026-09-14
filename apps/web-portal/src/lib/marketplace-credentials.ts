import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { authenticateStaffApiRequest } from './staff-api-auth';

export type MarketplaceProvider = 'uber_eats' | 'doordash';

export type MarketplaceCredentialStatus = {
  provider: MarketplaceProvider;
  configured: boolean;
  updatedAt: string | null;
  configuredBy: string | null;
  providerConfig: Record<string, string | number | boolean | null>;
};

const MARKETPLACE_PROVIDERS: MarketplaceProvider[] = ['uber_eats', 'doordash'];

function normalizeCookieHeaderValue(rawValue: string) {
  return rawValue
    .trim()
    .replace(/^cookie\s*:\s*/i, '')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function getMarketplaceSecret(): string {
  const secret = process.env.MARKETPLACE_CONFIG_SECRET;
  if (!secret) {
    throw new Error('Missing MARKETPLACE_CONFIG_SECRET');
  }
  return secret;
}

export function parseMarketplaceProvider(value: string): MarketplaceProvider | null {
  return MARKETPLACE_PROVIDERS.includes(value as MarketplaceProvider)
    ? (value as MarketplaceProvider)
    : null;
}

function getEncryptionKey() {
  return createHash('sha256').update(getMarketplaceSecret()).digest();
}

function encryptCookies(rawCookies: string) {
  const normalizedCookies = normalizeCookieHeaderValue(rawCookies);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalizedCookies, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedCookies: encrypted.toString('base64'),
    encryptionIv: iv.toString('base64'),
    encryptionTag: tag.toString('base64'),
  };
}

function decryptCookies(input: {
  encryptedCookies: string;
  encryptionIv: string;
  encryptionTag: string;
}) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(input.encryptionIv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(input.encryptionTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.encryptedCookies, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export async function authenticateMarketplaceRequest(request: Request) {
  return authenticateStaffApiRequest(request);
}

export async function getMarketplaceCredentialStatus(provider: MarketplaceProvider): Promise<MarketplaceCredentialStatus> {
  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from('marketplace_provider_credentials')
    .select('provider, updated_at, configured_by, provider_config')
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    provider,
    configured: Boolean(data),
    updatedAt: data?.updated_at ?? null,
    configuredBy: data?.configured_by ?? null,
    providerConfig: (data?.provider_config as Record<string, string | number | boolean | null> | null) ?? {},
  };
}

export async function saveMarketplaceCookies(input: {
  provider: MarketplaceProvider;
  cookies: string;
  configuredBy: string | null;
  providerConfig?: Record<string, string | number | boolean | null>;
}) {
  const normalizedCookies = normalizeCookieHeaderValue(input.cookies);
  if (!normalizedCookies) {
    throw new Error('Cookie header is empty');
  }

  const payload = encryptCookies(normalizedCookies);
  const supabase = await createServiceRoleClient();

  const { error } = await supabase
    .from('marketplace_provider_credentials')
    .upsert({
      provider: input.provider,
      encrypted_cookies: payload.encryptedCookies,
      encryption_iv: payload.encryptionIv,
      encryption_tag: payload.encryptionTag,
      provider_config: input.providerConfig ?? {},
      configured_by: input.configuredBy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider' });

  if (error) {
    throw new Error(error.message);
  }

  return getMarketplaceCredentialStatus(input.provider);
}

export async function deleteMarketplaceCookies(provider: MarketplaceProvider) {
  const supabase = await createServiceRoleClient();
  const { error } = await supabase
    .from('marketplace_provider_credentials')
    .delete()
    .eq('provider', provider);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getMarketplaceCookies(provider: MarketplaceProvider) {
  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from('marketplace_provider_credentials')
    .select('encrypted_cookies, encryption_iv, encryption_tag, provider_config')
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`No saved credentials for provider ${provider}`);
  }

  return decryptCookies({
    encryptedCookies: data.encrypted_cookies,
    encryptionIv: data.encryption_iv,
    encryptionTag: data.encryption_tag,
  });
}

export async function getMarketplaceCredentialBundle(provider: MarketplaceProvider) {
  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from('marketplace_provider_credentials')
    .select('encrypted_cookies, encryption_iv, encryption_tag, provider_config, updated_at')
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`No saved credentials for provider ${provider}`);
  }

  return {
    cookies: decryptCookies({
      encryptedCookies: data.encrypted_cookies,
      encryptionIv: data.encryption_iv,
      encryptionTag: data.encryption_tag,
    }),
    providerConfig: (data.provider_config as Record<string, string | number | boolean | null> | null) ?? {},
    updatedAt: data.updated_at ?? null,
  };
}

export async function getMarketplaceSessionBundle(provider: MarketplaceProvider) {
  const { cookies, providerConfig, updatedAt } = await getMarketplaceCredentialBundle(provider);
  return { provider, cookies, providerConfig, updatedAt };
}
