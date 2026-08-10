import {
  getCookieHeaderFromRequestHeaders,
  getProviderForRequestUrl,
  getProviderPortalOrigin,
} from './extension-core.mjs';

const capturedCookieHeaders = new Map();

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const provider = getProviderForRequestUrl(details.url);
    const cookies = getCookieHeaderFromRequestHeaders(details.requestHeaders);
    if (provider && cookies) capturedCookieHeaders.set(provider, cookies);
  },
  {
    urls: [
      'https://merchants.ubereats.com/manager/api/*',
      'https://merchant-portal.doordash.com/merchant-analytics-service/api*',
    ],
  },
  ['requestHeaders', 'extraHeaders'],
);

async function getSessionPreview(provider) {
  if (!getProviderPortalOrigin(provider)) return { success: false, error: 'Unsupported marketplace provider.' };
  const cookies = capturedCookieHeaders.get(provider);
  return cookies
    ? { success: true, cookies }
    : { success: false, error: 'No marketplace API request has been captured yet. Refresh the portal, then try again.' };
}

async function syncProviderSession(provider, cookies) {
  const settings = await chrome.storage.local.get(['apiBaseUrl', 'syncSecret']);
  const apiBaseUrl = typeof settings.apiBaseUrl === 'string' ? settings.apiBaseUrl.replace(/\/$/, '') : '';
  const syncSecret = typeof settings.syncSecret === 'string' ? settings.syncSecret : '';
  if (!apiBaseUrl || !syncSecret || !getProviderPortalOrigin(provider)) {
    return { success: false, error: 'Configure the API URL and sync secret in extension settings.' };
  }

  const cookieHeader = typeof cookies === 'string' ? cookies : (await getSessionPreview(provider)).cookies;
  if (!cookieHeader) return { success: false, error: 'No marketplace API request has been captured yet. Refresh the portal, then try again.' };

  try {
    const response = await fetch(`${apiBaseUrl}/api/marketplace/extension-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Marketplace-Sync-Key': syncSecret,
      },
      body: JSON.stringify({ provider, cookies: cookieHeader }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      return { success: false, error: payload?.error || 'Marketplace session sync failed.' };
    }
    capturedCookieHeaders.delete(provider);
    return { success: true };
  } catch {
    return { success: false, error: 'Could not reach the marketplace sync API.' };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PREVIEW_PROVIDER_SESSION') {
    getSessionPreview(message.provider)
      .then(sendResponse)
      .catch(() => sendResponse({ success: false, error: 'Could not read the marketplace session.' }));
    return true;
  }
  if (message?.type !== 'SYNC_PROVIDER_SESSION') return;
  syncProviderSession(message.provider, message.cookies)
    .then(sendResponse)
    .catch(() => sendResponse({ success: false, error: 'Marketplace session sync failed.' }));
  return true;
});
