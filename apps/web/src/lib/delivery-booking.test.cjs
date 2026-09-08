const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadBooking() {
  const filename = path.resolve(__dirname, 'delivery-booking.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(require, module, module.exports);
  return module.exports;
}

const quote = { id: 'estimate-1', provider: 'Courier', fee: 10, currency: 'AUD', pickupAt: null, deliveryAt: null, pickupMinutes: 5, deliveryMinutes: 20 };
function fixture(overrides = {}) {
  let row = {
    id: 'request-1', reference: 'DOD-test', state: 'quoted',
    address: { address_line1: '1 Test St', city: 'Melton', state: 'VIC', postcode: '3337', country: 'AU' },
    recipient: null, order_id: null, shipday_order_id: null,
    quotes: [quote], expires_at: '2030-01-01T00:00:00Z', last_error: null, tracking_url: null,
    selected_provider: null, accepted_fee: null, currency: null, ...overrides,
  };
  const calls = [];
  const repo = {
    get: async () => ({ ...row }),
    claim: async (id, states, patch) => {
      if (!states.includes(row.state)) return null;
      row = { ...row, ...patch };
      return { ...row };
    },
    update: async (id, patch) => { row = { ...row, ...patch }; return { ...row }; },
    linkOrder: async (record) => { calls.push(['link', record.shipday_order_id]); },
  };
  const provider = {
    createOrder: async () => { calls.push(['create']); return '123'; },
    getEstimates: async () => [quote],
    assignDelivery: async (id, selected) => {
      assert.equal(row.shipday_order_id, id, 'provider ID must be durable before assignment');
      calls.push(['assign', id, selected.id]);
      return { status: 'REQUESTED', trackingUrl: 'https://tracking.example/123' };
    },
    findOrderByReference: async () => null,
    getOnDemandDetails: async () => null,
  };
  return { repo, provider, calls, row: () => row };
}
const input = { quoteRequestId: 'request-1', provider: 'Courier', acceptedFee: 10, currency: 'AUD', recipient: { name: 'Customer', phone: '+61400000000' } };

test('standalone booking creates and assigns once with durable provider ID', async () => {
  const { bookDelivery } = loadBooking(); const f = fixture();
  const result = await bookDelivery(input, f.repo, f.provider);
  assert.equal(result.state, 'requested');
  assert.equal(result.shipdayOrderId, '123');
  assert.equal(result.orderId, null);
  assert.deepEqual(f.calls, [['create'], ['assign', '123', 'estimate-1']]);
  await bookDelivery(input, f.repo, f.provider);
  assert.equal(f.calls.length, 2);
});

test('concurrent submissions cannot create or assign twice', async () => {
  const { bookDelivery } = loadBooking(); const f = fixture();
  await Promise.all([bookDelivery(input, f.repo, f.provider), bookDelivery(input, f.repo, f.provider)]);
  assert.equal(f.calls.filter(([type]) => type === 'create').length, 1);
  assert.equal(f.calls.filter(([type]) => type === 'assign').length, 1);
});

test('price increase requires accepting a new quote and reuses the created delivery', async () => {
  const { bookDelivery } = loadBooking(); const f = fixture();
  f.provider.getEstimates = async () => [{ ...quote, id: 'estimate-new', fee: 12 }];
  const result = await bookDelivery(input, f.repo, f.provider);
  assert.equal(result.state, 'needs_confirmation');
  assert.equal(result.quotes[0].fee, 12);
  assert.equal(f.calls.filter(([type]) => type === 'assign').length, 0);
  const confirmed = await bookDelivery({ ...input, acceptedFee: 12 }, f.repo, f.provider);
  assert.equal(confirmed.state, 'requested');
  assert.equal(f.calls.filter(([type]) => type === 'create').length, 1);
});

test('creation timeout is retained and repeated submission does not create blindly', async () => {
  const { bookDelivery } = loadBooking(); const f = fixture();
  f.provider.createOrder = async () => { f.calls.push(['create']); throw new Error('timeout'); };
  const result = await bookDelivery(input, f.repo, f.provider);
  assert.equal(result.state, 'creation_uncertain');
  await bookDelivery(input, f.repo, f.provider);
  assert.equal(f.calls.length, 1);
});

test('read reconciliation finds an order after creation timed out without assigning it', async () => {
  const { reconcileDeliveryRequest } = loadBooking();
  const f = fixture({ state: 'creation_uncertain', selected_provider: 'Courier', accepted_fee: 10, currency: 'AUD' });
  f.provider.findOrderByReference = async () => ({ id: '123' });
  const result = await reconcileDeliveryRequest('request-1', f.repo, f.provider);
  assert.equal(result.state, 'created');
  assert.equal(result.shipdayOrderId, '123');
  assert.equal(f.calls.length, 0);
});

test('assignment timeout reconciles an accepted booking without another assignment', async () => {
  const { bookDelivery, reconcileDeliveryRequest } = loadBooking(); const f = fixture();
  f.provider.assignDelivery = async () => { f.calls.push(['assign']); throw new Error('timeout'); };
  const result = await bookDelivery(input, f.repo, f.provider);
  assert.equal(result.state, 'assignment_uncertain');
  f.provider.getOnDemandDetails = async () => ({ status: 'REQUESTED', trackingUrl: 'https://tracking.example/123' });
  assert.equal((await reconcileDeliveryRequest('request-1', f.repo, f.provider)).state, 'requested');
  assert.equal(f.calls.filter(([type]) => type === 'assign').length, 1);
});

test('unrecognized assignment details cannot be treated as a successful booking', async () => {
  const { reconcileDeliveryRequest } = loadBooking();
  const f = fixture({ state: 'assignment_uncertain', shipday_order_id: '123' });
  f.provider.getOnDemandDetails = async () => ({ success: false, message: 'Not booked' });
  assert.equal((await reconcileDeliveryRequest('request-1', f.repo, f.provider)).state, 'assignment_uncertain');
});

test('unavailable selected courier does not automatically switch provider', async () => {
  const { bookDelivery } = loadBooking(); const f = fixture();
  f.provider.getEstimates = async () => [{ ...quote, provider: 'Other courier' }];
  assert.equal((await bookDelivery(input, f.repo, f.provider)).state, 'needs_confirmation');
  assert.equal(f.calls.filter(([type]) => type === 'assign').length, 0);
});

test('invalid contact, stale quote and fabricated quote selection never create remotely', async () => {
  const { bookDelivery } = loadBooking();
  for (const [record, request] of [
    [{}, { ...input, recipient: { name: '', phone: '' } }],
    [{ expires_at: '2000-01-01T00:00:00Z' }, input],
    [{}, { ...input, acceptedFee: -10 }],
    [{}, { ...input, provider: 'Unknown' }],
  ]) {
    const f = fixture(record);
    await assert.rejects(bookDelivery(request, f.repo, f.provider));
    assert.equal(f.calls.length, 0);
  }
});

test('optional POS link is persisted and linked once provider ID exists', async () => {
  const { bookDelivery } = loadBooking(); const f = fixture();
  const result = await bookDelivery({ ...input, orderId: 'pos-order' }, f.repo, f.provider);
  assert.equal(result.orderId, 'pos-order');
  assert.deepEqual(f.calls, [['create'], ['link', '123'], ['assign', '123', 'estimate-1']]);
});
