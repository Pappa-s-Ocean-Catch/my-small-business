const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(filename, dependencies) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'module', 'exports', output)(name => dependencies[name] || {}, module, module.exports);
  return module.exports;
}
function walk(node, match) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) return node.map(child => walk(child, match)).find(Boolean);
  if (match(node)) return node;
  return walk(node.props?.children, match);
}
function fixture(isOpen, hoursError = false) {
  let cursor = 0;
  const state = [];
  const routes = [];
  const quotes = [];
  const values = new Map();
  const session = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const AddressForm = () => null;
  const dependencies = {
    react: { useState(value) { const index = cursor++; if (!(index in state)) state[index] = value; return [state[index], next => { state[index] = next; }]; } },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'next/navigation': { useRouter: () => ({ push: route => routes.push(route) }) },
    '@/components/DeliveryAddressForm': { DeliveryAddressForm: AddressForm },
    '@/app/actions/store-hours': { getStoreHoursForOrder: async () => { if (hoursError) throw new Error('hours unavailable'); return { isOpenNow: isOpen }; } },
    '@/lib/order-schedule-session': load(path.resolve(__dirname, 'order-schedule-session.ts'), {}),
  };
  const page = load(path.resolve(__dirname, '../app/order/delivery/page.tsx'), dependencies).default;
  return {
    render: () => { cursor = 0; return page(); }, AddressForm, session, routes, quotes,
    fetch: async (_url, options) => { quotes.push(JSON.parse(options.body)); return { json: async () => ({ success: true, data: { fee: 10, estimated_duration_minutes: 30 } }) }; },
  };
}
const address = { address_line1: '1 Test Street', city: 'Melton', state: 'VIC', postcode: '3337' };
for (const open of [false, true]) {
  test(`${open ? 'open' : 'closed'} store: delivery entry can reach the menu without requiring a realtime quote when closed`, async t => {
    const originalFetch = global.fetch;
    const originalStorage = global.sessionStorage;
    const f = fixture(open);
    global.fetch = f.fetch;
    global.sessionStorage = f.session;
    t.after(() => { global.fetch = originalFetch; global.sessionStorage = originalStorage; });
    const form = walk(f.render(), node => node.type === f.AddressForm);
    await form.props.onAddressSelect(address);
    assert.equal(f.quotes.length, open ? 1 : 0);
    const button = walk(f.render(), node => node.type === 'button' && node.props.onClick?.name === 'handleContinue');
    assert.ok(button, 'Start Ordering is available');
    button.props.onClick();
    assert.equal(f.routes.at(-1), '/order');
    assert.equal(f.session.getItem('orderType'), 'delivery');
    assert.equal(f.session.getItem('deliveryAddress'), JSON.stringify(address));
  });
}
test('delivery entry blocks continuation when store hours cannot be loaded', async t => {
  const originalFetch = global.fetch;
  const f = fixture(false, true);
  global.fetch = f.fetch;
  t.after(() => { global.fetch = originalFetch; });
  await walk(f.render(), node => node.type === f.AddressForm).props.onAddressSelect(address);
  assert.equal(f.quotes.length, 0);
  assert.equal(walk(f.render(), node => node.type === 'button' && node.props.onClick?.name === 'handleContinue'), undefined);
});
