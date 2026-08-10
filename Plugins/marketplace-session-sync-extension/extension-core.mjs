const PROVIDERS = {
  uber_eats: {
    portalOrigin: 'https://merchants.ubereats.com',
    portalPath: '/manager/',
  },
  doordash: {
    portalOrigin: 'https://www.doordash.com',
    portalPath: '/merchant/',
  },
};

const REQUEST_PATTERNS = {
  uber_eats: {
    origin: 'https://merchants.ubereats.com',
    path: '/manager/api/',
  },
  doordash: {
    origin: 'https://merchant-portal.doordash.com',
    path: '/merchant-analytics-service/api',
  },
};

export function getProviderForUrl(value) {
  try {
    const url = new URL(value);
    return Object.entries(PROVIDERS).find(([, config]) => (
      url.origin === config.portalOrigin && url.pathname.startsWith(config.portalPath)
    ))?.[0] || null;
  } catch {
    return null;
  }
}

export function getProviderForRequestUrl(value) {
  try {
    const url = new URL(value);
    return Object.entries(REQUEST_PATTERNS).find(([, pattern]) => (
      url.origin === pattern.origin && url.pathname.startsWith(pattern.path)
    ))?.[0] || null;
  } catch {
    return null;
  }
}

export function getCookieHeaderFromRequestHeaders(headers) {
  return headers?.find((header) => header?.name?.toLowerCase() === 'cookie')?.value?.trim() || '';
}

export function getProviderPortalOrigin(provider) {
  return PROVIDERS[provider]?.portalOrigin || null;
}
