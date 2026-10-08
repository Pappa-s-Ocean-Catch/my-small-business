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
test('clearing a completed order cart also removes its schedule for the next order', async t => {
  const previousWindow = global.window;
  const values = new Map(Object.entries({ orderType: 'delivery', pickupOption: 'scheduled', scheduledPickupAt: '2026-10-09T01:00:00Z', scheduledDeliveryAt: '2026-10-09T01:30:00Z', deliveryQuote: '{}' }));
  global.window = { sessionStorage: { getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key) } };
  t.after(() => { global.window = previousWindow; });
  const hooks = { createContext: () => ({ Provider: 'provider' }), useState: value => [value, () => {}], useCallback: callback => callback, useEffect: () => {} };
  const context = load(path.resolve(__dirname, '../contexts/CartContext.tsx'), {
    react: hooks,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '@/lib/order-schedule-session': load(path.resolve(__dirname, 'order-schedule-session.ts'), {}),
  });
  const rendered = context.CartProvider({ children: null });
  await rendered.props.value.clearCart();
  assert.equal(values.get('scheduledPickupAt'), undefined);
  assert.equal(values.get('scheduledDeliveryAt'), undefined);
  assert.equal(values.get('pickupOption'), undefined);
  assert.equal(values.get('deliveryQuote'), undefined);
  assert.equal(values.get('orderType'), 'delivery');
});
