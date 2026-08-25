import type { MarketplaceTransport } from '@my-small-business/marketplace';

export type MarketplaceNativeCookie = {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  version?: string;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  maxAge?: number;
};

export type MarketplaceCookieStore = {
  getAsArray(url: string): Promise<readonly MarketplaceNativeCookie[]>;
  set(url: string, cookie: MarketplaceNativeCookie): Promise<boolean>;
  clearByName(url: string, name: string): Promise<boolean>;
};

type CookieStoreTransportInput = {
  cookieStore: MarketplaceCookieStore;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  onDiagnostic?: (event: { operation: 'native-cookie-seeded' | 'native-cookie-cleanup-failed'; host: string; cookies: number }) => void;
};

function parseCookieHeader(value: string) {
  return value.split(';').flatMap((part) => {
    const index = part.indexOf('=');
    if (index <= 0) return [];
    const name = part.slice(0, index).trim();
    const cookieValue = part.slice(index + 1).trim();
    return name ? [{ name, value: cookieValue, path: '/', secure: true }] : [];
  });
}

async function clearAndRestoreCookies(input: CookieStoreTransportInput, url: string, names: readonly string[], existing: readonly MarketplaceNativeCookie[]) {
  try {
    for (const name of names) await input.cookieStore.clearByName(url, name);
    for (const cookie of existing) {
      if (names.includes(cookie.name)) await input.cookieStore.set(url, cookie);
    }
  } catch {
    input.onDiagnostic?.({ operation: 'native-cookie-cleanup-failed', host: new URL(url).hostname, cookies: names.length });
  }
}

export function createMarketplaceCookieStoreTransport(input: CookieStoreTransportInput): MarketplaceTransport {
  return async ({ url, init }) => {
    const headers = new Headers(init.headers);
    const rawCookies = headers.get('cookie');
    if (!rawCookies) return input.fetch(url, init);

    const cookies = parseCookieHeader(rawCookies);
    if (!cookies.length) return input.fetch(url, init);

    const existing = await input.cookieStore.getAsArray(url);
    try {
      for (const cookie of cookies) await input.cookieStore.set(url, cookie);
    } catch (error) {
      throw new Error('Marketplace native cookie-store seed failed', { cause: error });
    }
    input.onDiagnostic?.({ operation: 'native-cookie-seeded', host: new URL(url).hostname, cookies: cookies.length });

    headers.delete('cookie');
    const names = [...new Set(cookies.map((cookie) => cookie.name))];
    try {
      return await input.fetch(url, { ...init, headers });
    } finally {
      await clearAndRestoreCookies(input, url, names, existing);
    }
  };
}
