const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(filename, dependencies, now) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return new Date(now).getTime(); }
  }
  new Function('require', 'module', 'exports', 'Date', output)(name => dependencies[name] || {}, module, module.exports, Clock);
  return module.exports;
}
function fixture(app, now = '2026-10-07T22:00:00Z') {
  const hours = Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, { open: '10:00', close: '21:00' }]));
  const inserts = [];
  let order = null;
  let orderItems = [];
  const client = { from(table) {
    let key;
    const result = (single = false) => {
      if (table === 'settings') return { data: { value: key === 'store_hours' ? hours : {} }, error: null };
      if (table === 'orders') return { data: order, error: null };
      if (table === 'order_items') return { data: orderItems, error: null };
      if (table === 'sale_products') return { data: [{ id: 'test', name: 'Fish', section: 'Fried', sale_category_id: null, sub_category_id: null }], error: null };
      return { data: single ? null : [], error: null };
    };
    const query = {
      select() { return query; }, eq(_, value) { key = value; return query; },
      in() { return query; }, order() { return query; },
      maybeSingle: async () => result(true),
      insert(value) {
        inserts.push({ table, value });
        if (table === 'orders') order = { id: 'order-test', order_number: 'TEST-1', created_at: now, ...value };
        if (table === 'order_items') orderItems = value.map((item, i) => ({ id: `item-${i}`, ...item }));
        return query;
      },
      single: async () => result(true),
      then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  } };
  const root = path.resolve(__dirname, '../../../..');
  const storeHours = load(path.join(root, `apps/${app}/src/lib/store-hours.ts`), {}, now);
  const scheduling = load(path.join(root, 'libs/shipday/scheduling.ts'), {}, now);
  const actions = load(path.join(root, `apps/${app}/src/app/actions/orders.ts`), {
    '@my-small-business/supabase/server': { createServiceRoleClient: async () => client },
    '@/lib/store-hours': storeHours,
    '@/lib/posthog-server': { getPostHogClient: () => ({ capture() {}, shutdown: async () => {} }) },
    '@my-small-business/shipday/scheduling': scheduling,
  }, now);
  return { actions, inserts };
}
const input = { customer_email: 'test@example.com', customer_phone: '0400000000', order_type: 'delivery', payment_method: 'online', items: [{ product_id: 'test', product_name: 'Fish', base_price: 10, subtotal: 10, quantity: 1, addons: [] }], subtotal: 10, total: 10 };
for (const app of ['web', 'api', 'web-portal']) {
  test(`${app}: closed delivery rejects missing pickup and delivery times before database insert`, async () => {
    const { actions, inserts } = fixture(app);
    const result = await actions.createOrder(input);
    assert.match(result.error, /closed/);
    assert.equal(inserts.length, 0);
  });
  test(`${app}: closed delivery requires arrival time even with a valid pickup schedule`, async () => {
    const { actions, inserts } = fixture(app);
    const result = await actions.createOrder({ ...input, scheduled_pickup_at: '2026-10-08T00:00:00Z' });
    assert.ok(result.error);
    assert.equal(inserts.length, 0);
  });
  test(`${app}: valid scheduled delivery persists both instants`, async () => {
    const { actions, inserts } = fixture(app);
    const result = await actions.createOrder({ ...input, scheduled_pickup_at: '2026-10-08T00:00:00Z', scheduled_delivery_at: '2026-10-08T00:30:00Z' });
    assert.equal(result.error, null);
    assert.equal(result.data.items.length, 1);
    assert.equal(inserts.length, 2);
    assert.equal(inserts[0].value.scheduled_pickup_at, '2026-10-08T00:00:00Z');
    assert.equal(inserts[0].value.scheduled_delivery_at, '2026-10-08T00:30:00Z');
  });
  test(`${app}: closed pickup rejects ASAP orders`, async () => {
    const { actions, inserts } = fixture(app);
    const result = await actions.createOrder({ ...input, order_type: 'pickup' });
    assert.match(result.error, /closed/);
    assert.equal(inserts.length, 0);
  });
}

for (const app of ['web', 'api', 'web-portal']) {
  for (const scenario of [
    { name: 'ASAP pickup paid online', order_type: 'pickup', payment_method: 'online' },
    { name: 'ASAP pickup paid at store', order_type: 'pickup', payment_method: 'store' },
    { name: 'ASAP delivery paid online', order_type: 'delivery', payment_method: 'online' },
    { name: 'scheduled pickup paid online', order_type: 'pickup', payment_method: 'online', scheduled_pickup_at: '2026-10-09T01:00:00Z' },
    { name: 'scheduled pickup paid at store', order_type: 'pickup', payment_method: 'store', scheduled_pickup_at: '2026-10-09T01:00:00Z' },
    { name: 'scheduled delivery paid online', order_type: 'delivery', payment_method: 'online', scheduled_pickup_at: '2026-10-09T01:00:00Z', scheduled_delivery_at: '2026-10-09T01:30:00Z' },
  ]) {
    test(`${app}: ${scenario.name} creates and returns a complete order`, async () => {
      const { actions } = fixture(app, '2026-10-08T01:00:00Z'); // Noon Melbourne, store open.
      const result = await actions.createOrder({ ...input, ...scenario });
      assert.equal(result.error, null);
      assert.equal(result.data.order_type, scenario.order_type);
      assert.equal(result.data.payment_method, scenario.payment_method);
      assert.equal(result.data.order_status, scenario.payment_method === 'online' ? 'pending_online_payment' : 'pending');
      assert.equal(result.data.scheduled_pickup_at, scenario.scheduled_pickup_at ?? null);
      assert.equal(result.data.scheduled_delivery_at, scenario.scheduled_delivery_at ?? null);
      assert.equal(result.data.items.length, 1);
      assert.equal(result.data.items[0].product_name, 'Fish');
      assert.equal(result.data.total, 10);
    });
  }
  for (const scenario of [
    { name: 'past pickup', order_type: 'pickup', scheduled_pickup_at: '2026-10-08T00:00:00Z' },
    { name: 'pickup after closing', order_type: 'pickup', scheduled_pickup_at: '2026-10-08T11:00:00Z' },
    { name: 'preorder beyond seven days', order_type: 'pickup', scheduled_pickup_at: '2026-10-15T01:00:00Z' },
    { name: 'delivery before pickup', order_type: 'delivery', scheduled_pickup_at: '2026-10-09T01:00:00Z', scheduled_delivery_at: '2026-10-09T00:30:00Z' },
    { name: 'pay-at-store delivery', order_type: 'delivery', payment_method: 'store' },
  ]) {
    test(`${app}: rejects ${scenario.name} without creating an order`, async () => {
      const { actions, inserts } = fixture(app, '2026-10-08T01:00:00Z');
      const result = await actions.createOrder({ ...input, ...scenario });
      assert.ok(result.error);
      assert.equal(inserts.length, 0);
    });
  }
}
