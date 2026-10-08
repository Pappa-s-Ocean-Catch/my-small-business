const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(filename, dependencies) {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const localRequire = name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name === '@my-small-business/shipday/scheduling') return load(require.resolve(name), dependencies);
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name + '.ts'), dependencies);
    if (name.startsWith('@/')) return load(path.resolve(__dirname, '..', name.slice(2) + '.ts'), dependencies);
    return require(name);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
function fixture(orderType, scheduled) {
  const id = '11111111-1111-4111-8111-111111111111';
  const order = {
    id, order_number: 'TEST-1', order_type: orderType, payment_method: 'online',
    payment_status: 'pending', order_status: 'pending_online_payment',
    created_at: '2026-10-08T01:00:00Z', delivery_eta_minutes: 25,
    scheduled_pickup_at: scheduled ? '2026-10-09T01:00:00Z' : null,
    scheduled_delivery_at: scheduled ? '2026-10-09T01:30:00Z' : null,
    delivery_provider_id: null, delivery_status: 'pending',
    customer_name: 'Test', customer_email: 'test@example.com', customer_phone: '0400000000',
    delivery_address_line1: '1 Test Street', delivery_city: 'Melton', delivery_state: 'VIC', delivery_postcode: '3337',
    subtotal: 10, total: 20, tax: 0, delivery_fee: 10,
    items: [{ product_name: 'Fish', base_price: 10, quantity: 1, subtotal: 10, addons: [] }],
  };
  order.order_items = order.items;
  const payloads = [];
  const client = { from(table) {
    let patch;
    const filters = [];
    const result = single => {
      if (table !== 'orders') return { data: null, error: null };
      if (patch) {
        if (!filters.every(([key, value]) => order[key] === value)) return { data: [], error: null };
        Object.assign(order, patch);
      }
      return { data: !single && patch?.delivery_status === 'quote_requested' ? [{ id }] : { ...order }, error: null };
    };
    const query = {
      select: () => query, eq: (key, value) => { filters.push([key, value]); return query; },
      is: (key, value) => { filters.push([key, value]); return query; },
      update: value => { patch = value; return query; },
      single: async () => result(true), then: (resolve, reject) => Promise.resolve(result(false)).then(resolve, reject),
    };
    return query;
  } };
  const dependencies = {
    '@my-small-business/supabase/server': { createServiceRoleClient: async () => client },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/posthog-server': { getPostHogClient: () => ({ capture() {}, shutdown: async () => {} }) },
    '@/app/actions/email': { sendOrderPlacedEmail: async () => ({ success: true }) },
    '@/app/actions/orders': {
      updatePaymentStatus: async (_id, status) => { order.payment_status = status; return { data: { ...order }, error: null }; },
      updateOrderStatus: async (_id, status) => { order.order_status = status; return { data: { ...order }, error: null }; },
    },
    stripe: class Stripe {
      checkout = { sessions: { retrieve: async () => ({ id: 'cs_test', metadata: { order_id: id }, payment_status: 'paid', status: 'complete' }) } };
      webhooks = { constructEvent: () => ({ type: 'checkout.session.completed', data: { object: { id: 'cs_test', metadata: { order_id: id } } } }) };
    },
  };
  const shipday = load(path.resolve(__dirname, '../../../../libs/shipday/index.ts'), {
    shipday: class Shipday {
      orderService = { insertOrder: async request => { payloads.push(request.getRequestBody()); return { orderId: 123 }; } };
    },
  });
  dependencies['@my-small-business/shipday'] = shipday;
  return {
    id, order, payloads,
    verify: () => load(path.resolve(__dirname, '../app/api/payments/verify-session/route.ts'), dependencies).POST({ json: async () => ({ orderId: id, sessionId: 'cs_test' }) }),
    webhook: () => load(path.resolve(__dirname, '../app/api/webhooks/stripe/route.ts'), dependencies).POST({ text: async () => '{}', headers: new Headers({ 'stripe-signature': 'test' }) }),
  };
}
for (const entry of ['verify', 'webhook']) {
  for (const scenario of [
    { name: 'ASAP delivery', type: 'delivery', scheduled: false, date: '2026-10-08', pickup: '01:10:00', delivery: '01:35:00' },
    { name: 'scheduled delivery', type: 'delivery', scheduled: true, date: '2026-10-09', pickup: '01:00:00', delivery: '01:30:00' },
    { name: 'pickup', type: 'pickup', scheduled: false },
    { name: 'scheduled pickup', type: 'pickup', scheduled: true },
  ]) {
    test(`${entry}: paid ${scenario.name} preserves timing and only delivery creates a Shipday order`, async t => {
      const keys = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SHIPDAY_API_KEY'];
      const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
      keys.forEach(key => { process.env[key] = 'test-only'; });
      t.after(() => keys.forEach(key => { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }));
      const f = fixture(scenario.type, scenario.scheduled);
      const result = await f[entry]();
      assert.equal(result.status, 200);
      assert.equal(f.order.payment_status, 'paid');
      assert.equal(f.order.order_status, 'confirmed');
      assert.equal(f.payloads.length, scenario.type === 'delivery' ? 1 : 0);
      if (scenario.type === 'delivery') {
        assert.equal(f.payloads[0].expectedDeliveryDate, scenario.date);
        assert.equal(f.payloads[0].expectedPickupTime, scenario.pickup);
        assert.equal(f.payloads[0].expectedDeliveryTime, scenario.delivery);
        assert.equal(f.order.delivery_provider_id, 123);
      }
    });
  }
}
