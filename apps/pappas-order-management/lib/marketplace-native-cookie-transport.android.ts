import CookieManager from '@preeternal/react-native-cookie-manager';
import type { MarketplaceTransport } from '@my-small-business/marketplace';

import { createMarketplaceCookieStoreTransport } from './marketplace-native-cookie-transport-core';

export function getMarketplaceAndroidCookieTransport(): MarketplaceTransport {
  return createMarketplaceCookieStoreTransport({
    cookieStore: CookieManager,
    fetch: (url, init) => fetch(url, init),
    onDiagnostic: (event) => console.info('[marketplace]', { transport: 'android-native-cookie-store', ...event }),
  });
}
