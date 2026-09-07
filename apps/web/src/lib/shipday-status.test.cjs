const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute the real handlers, replacing only the external SDK/database and Next response adapter.
function loadSource(filename, dependencies) {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name.startsWith('@/')) return loadSource(path.resolve(__dirname, '..', name.slice(2) + '.ts'), dependencies);
    return require(name);
  };
  new Function('require', 'module', 'exports', output)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

function setup({ status, duplicate = false, orderStatus = 'ready', paymentStatus = 'paid', updateError = null, webhookBody, sdkResponse, concurrentOrderStatus, storedDeliveryStatus }) {
  const order = {
    id: 'local-order', order_number: 'ORD-123', order_type: 'delivery',
    order_status: orderStatus, payment_status: paymentStatus,
    delivery_provider_id: '123', delivery_status: storedDeliveryStatus ?? (duplicate ? status : 'assigned'),
  };
  const writes = [];
  const events = [];
  const supabase = {
    from(table) {
      let update;
      const filters = [];
      const result = () => {
        if (update && updateError) return { data: null, error: { message: updateError } };
        if (update && !filters.every(([key, value]) => order[key] === value)) return { data: null, error: null };
        if (update) {
          writes.push(update);
          Object.assign(order, update);
        }
        return { data: table === 'orders' ? { ...order } : duplicate ? { id: 'existing-event' } : null, error: null };
      };
      const query = {
        select: () => query,
        eq: (key, value) => { filters.push([key, value]); return query; },
        order: () => query,
        limit: () => query,
        update: (value) => {
          update = value;
          if (concurrentOrderStatus) {
            order.order_status = concurrentOrderStatus;
            concurrentOrderStatus = null;
          }
          return query;
        },
        insert: (value) => { events.push(value); return Promise.resolve({ error: null }); },
        single: async () => result(),
        maybeSingle: async () => result(),
        then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
      };
      return query;
    },
  };
  const dependencies = {
    '@my-small-business/supabase/server': { createServiceRoleClient: async () => supabase },
    '@my-small-business/shipday': { getShipdayClient: () => ({ getDeliveryStatus: async () => ({ delivery_id: '123', status }) }) },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  };
  if (sdkResponse) {
    const clientModule = loadSource(path.resolve(__dirname, '../../../../libs/shipday/index.ts'), {
      shipday: class {
        orderService = {
          getOrderDetails: async (orderNumber) => {
            assert.equal(orderNumber, 'ORD-123', 'SDK endpoint expects the merchant order number');
            return sdkResponse;
          },
        };
      },
    });
    dependencies['@my-small-business/shipday'] = {
      getShipdayClient: () => {
        const previous = process.env.SHIPDAY_API_KEY;
        process.env.SHIPDAY_API_KEY = 'test-only';
        try { return clientModule.getShipdayClient(); }
        finally {
          if (previous === undefined) delete process.env.SHIPDAY_API_KEY;
          else process.env.SHIPDAY_API_KEY = previous;
        }
      },
    };
  }
  const actions = loadSource(path.resolve(__dirname, '../app/actions/shipday.ts'), dependencies);
  const webhook = loadSource(path.resolve(__dirname, '../app/api/webhooks/shipday/route.ts'), dependencies);
  return {
    order, writes, events,
    refresh: () => actions.refreshShipdayOrderStatus(order.id),
    webhook: () => webhook.POST({
      headers: new Headers({ token: process.env.SHIPDAY_WEBHOOK_SECRET || '' }),
      json: async () => webhookBody || ({ orderId: '123', orderNumber: 'ORD-123', status }),
    }),
  };
}

for (const method of ['refresh', 'webhook']) {
  for (const [status, expected] of [['inflight', 'on_the_way'], ['delivered', 'completed']]) {
    test(`${method}: ${status} advances the stored order status to ${expected}`, async () => {
      const fixture = setup({ status });
      await fixture[method]();
      assert.equal(fixture.order.delivery_status, status);
      assert.equal(fixture.order.order_status, expected);
    });

    test(`${method}: repeated ${status} payload repairs a stuck order without another event`, async () => {
      const fixture = setup({ status, duplicate: true });
      await fixture[method]();
      assert.equal(fixture.order.order_status, expected);
      assert.equal(fixture.events.length, 0);
      assert.equal(fixture.writes.length, 1);
      await fixture[method]();
      assert.equal(fixture.writes.length, 1, 'an already reconciled duplicate must not write again');
    });
  }

  for (const orderStatus of ['completed', 'cancelled', 'refunded']) {
    test(`${method}: late pickup does not reopen ${orderStatus} orders`, async () => {
      const fixture = setup({ status: 'inflight', orderStatus });
      await fixture[method]();
      assert.equal(fixture.order.order_status, orderStatus);
    });
  }

  test(`${method}: delivered does not complete a refunded payment`, async () => {
    const fixture = setup({ status: 'delivered', paymentStatus: 'refunded' });
    await fixture[method]();
    assert.equal(fixture.order.order_status, 'ready');
  });

  test(`${method}: delivered does not reopen a cancelled order`, async () => {
    const fixture = setup({ status: 'delivered', orderStatus: 'cancelled' });
    await fixture[method]();
    assert.equal(fixture.order.order_status, 'cancelled');
  });

  test(`${method}: assignment does not move an order out of the kitchen`, async () => {
    const fixture = setup({ status: 'assigned' });
    await fixture[method]();
    assert.equal(fixture.order.order_status, 'ready');
  });

  test(`${method}: a concurrent pickup does not silently discard completion`, async () => {
    const fixture = setup({ status: 'delivered', concurrentOrderStatus: 'on_the_way' });
    const result = await fixture[method]();
    if (method === 'webhook') assert.equal(result.status, 503);
    else assert.equal(result.success, false);
    assert.equal(fixture.events.length, 0, 'a conflict must not be recorded as processed');
    await fixture[method]();
    assert.equal(fixture.order.order_status, 'completed');
  });

  test(`${method}: duplicate reconciliation repairs delivery status alongside order status`, async () => {
    const fixture = setup({ status: 'delivered', duplicate: true, storedDeliveryStatus: 'pending' });
    await fixture[method]();
    assert.equal(fixture.order.order_status, 'completed');
    assert.equal(fixture.order.delivery_status, 'delivered');
    assert.equal(fixture.events.length, 0);
  });
}

for (const [event, expected] of [['ORDER_PIKEDUP', 'on_the_way'], ['ORDER_COMPLETED', 'completed']]) {
  test(`webhook uses ${event} when a payload has no order status`, async () => {
    const fixture = setup({ webhookBody: { event, order: { id: 123, order_number: 'ORD-123' } } });
    await fixture.webhook();
    assert.equal(fixture.order.order_status, expected);
  });
}

test('refresh reports a reconciliation failure instead of acknowledging a duplicate as synced', async () => {
  const fixture = setup({ status: 'delivered', duplicate: true, updateError: 'write failed' });
  const result = await fixture.refresh();
  assert.equal(result.success, false);
  assert.equal(result.error, 'write failed');
  assert.equal(fixture.order.order_status, 'ready');
});

for (const [status, event, expected] of [
  ['PICKED_UP', 'ORDER_PIKEDUP', 'on_the_way'],
  ['ALREADY_DELIVERED', 'ORDER_COMPLETED', 'completed'],
  ['FAILED_DELIVERY', 'ORDER_FAILED', 'ready'],
  ['READY_TO_DELIVER', 'ORDER_ONTHEWAY', 'on_the_way'],
]) {
  test(`webhook handles documented ${status} payload despite unrelated carrier status`, async () => {
    const fixture = setup({ status, webhookBody: {
      company: { id: 999 }, carrier: { id: 888, status: 'ONLINE' },
      event, order_status: status, order: { id: 123, order_number: 'ORD-123' },
    } });
    const result = await fixture.webhook();
    assert.equal(result.body.external_delivery_id, '123');
    assert.equal(fixture.order.order_status, expected);
    assert.equal(fixture.order.delivery_status, status === 'FAILED_DELIVERY' ? 'failed' : expected === 'completed' ? 'delivered' : 'inflight');
  });

  test(`refresh reads nested ${status} from the matching delivery in the SDK array`, async () => {
    const fixture = setup({ status, sdkResponse: [
      { orderId: 456, orderNumber: 'ORD-123', orderStatus: { orderState: 'ALREADY_DELIVERED' } },
      { orderId: 123, orderNumber: 'ORD-123', assignedCarrier: { status: 'ONLINE' }, orderStatus: { orderState: status } },
    ] });
    const result = await fixture.refresh();
    assert.equal(result.success, true, result.error);
    assert.equal(fixture.order.order_status, expected);
  });
}

test('refresh does not reset status when Shipday returns no matching delivery', async () => {
  const fixture = setup({ status: 'inflight', sdkResponse: [] });
  const result = await fixture.refresh();
  assert.equal(result.success, false);
  assert.match(result.error, /Linked Shipday delivery not found/);
  assert.equal(fixture.writes.length, 0);
});
