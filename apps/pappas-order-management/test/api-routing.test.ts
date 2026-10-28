import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the actual clients without loading React Native or opening a network connection.
function loadClient(path: string, env: Record<string, string>, fetch: typeof globalThis.fetch) {
  const module = { exports: {} as Record<string, (...args: any[]) => any> };
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(source, {
    module, exports: module.exports, process: { env }, fetch, URLSearchParams, console,
    require: (name: string) => {
      if (name.endsWith('/orderUtils')) return loadClient('utils/orderUtils.ts', env, fetch);
      if (name === './supabase') return {
        supabase: {
          auth: { getSession: async () => ({ data: { session: { access_token: 'staff-token' } } }) },
          from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
        },
      };
      if (name === './pos-api-auth') return {
        buildStaffAuthorizationHeader: (token: string) => ({ Authorization: `Bearer ${token}` }),
      };
      return {};
    },
  });
  return module.exports;
}

for (const base of ['https://api.example.test', 'https://api.example.test/api', 'https://api.example.test/api/']) {
  test(`delivery clients route to the API host with base ${base}`, async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetch: typeof globalThis.fetch = async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ success: true, data: [] }));
    };
    const env = { EXPO_PUBLIC_API_URL: base, EXPO_PUBLIC_SITE_URL: 'https://website.example.test' };
    const delivery = loadClient('lib/delivery.ts', env, fetch);
    const management = loadClient('lib/delivery-management.ts', env, fetch);
    const orders = loadClient('lib/orders.ts', env, fetch);

    await delivery.fetchAddressSuggestions('12 Main Street');
    await delivery.fetchAddressDetails('place-1');
    await delivery.requestDeliveryQuote({ address_line1: '12 Main Street' });
    await delivery.calculateDeliveryFees({ subtotal: 10, tax: 0, deliveryFee: 5 });
    await delivery.createStripeCheckoutSession({ orderId: 'order-1' });
    await delivery.sendPaymentLinkSms({ phone: '0400000000', paymentUrl: 'https://pay.example.test' });
    await management.getDeliveryOrders({ from: '2026-10-01', to: '2026-10-26', page: 1 });
    await management.getDeliveryOrderDetail('order-1', 'ref-1');
    await management.lookupOrder('ref-1');
    await management.getDeliveryQuotes({ address_line1: '12 Main Street' });
    await management.requestDelivery({ quoteRequestId: 'quote-1' });
    await management.getDeliveryRequestStatus('request-1');
    await orders.notifyDeliveryReady('order-1');
    await orders.refreshDeliveryStatus('order-1');

    assert.deepEqual(requests.map(({ url }) => new URL(url).origin), Array(14).fill('https://api.example.test'));
    assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), [
      '/api/places/autocomplete', '/api/places/details', '/api/delivery/quote',
      '/api/payments/calculate-fees', '/api/payments/create-checkout-session', '/api/pos/send-payment-link-sms',
      '/api/pos/delivery-management/orders', '/api/pos/delivery-management/orders/order-1',
      '/api/pos/delivery-management/lookup-order', '/api/pos/delivery-management/quotes',
      '/api/pos/delivery-management/requests', '/api/pos/delivery-management/requests/request-1',
      '/api/delivery/ready', '/api/delivery/status',
    ]);
    assert.equal(new URL(requests[0].url).searchParams.get('input'), '12 Main Street');
    assert.equal(new URL(requests[0].url).searchParams.get('country'), 'au');
    assert.equal((requests[5].init?.headers as Record<string, string>).Authorization, 'Bearer staff-token');
    assert.equal((requests[6].init?.headers as Record<string, string>).Authorization, 'Bearer staff-token');
  });
}
