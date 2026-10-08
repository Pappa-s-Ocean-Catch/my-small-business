const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(filename, dependencies) {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-08T01:00:00Z'])); }
  }
  new Function('require', 'module', 'exports', 'Date', output)(name => dependencies[name], module, module.exports, Clock);
  return module.exports;
}
const address = { address_line1: '1 Test Street', city: 'Melton', state: 'VIC', postcode: '3337' };
for (const scenario of [
  { name: 'scheduled delivery derives pickup ten minutes earlier', data: { scheduled_delivery_at: '2026-10-09T01:30:00Z' }, status: 200, pickup: '2026-10-09T01:20:00.000Z', delivery: '2026-10-09T01:30:00Z' },
  { name: 'ASAP delivery still requests a realtime quote', data: {}, status: 200 },
  { name: 'delivery with insufficient future pickup time is rejected', data: { scheduled_delivery_at: '2026-10-08T01:05:00Z' }, status: 400 },
  { name: 'invalid selected delivery date is rejected', data: { scheduled_delivery_at: 'invalid' }, status: 400 },
]) {
  test(`delivery quote: ${scenario.name}`, async () => {
    const calls = [];
    const scheduling = load(require.resolve('@my-small-business/shipday/scheduling'), {});
    const route = load(path.resolve(__dirname, '../app/api/delivery/quote/route.ts'), {
      '@my-small-business/shipday/scheduling': scheduling,
      'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
      '@my-small-business/shipday': { getShipdayClient: () => ({ requestQuote: async (pickup, dropoff, schedule) => { calls.push({ pickup, dropoff, schedule }); return { quote_id: 'test-quote', fee: 10, currency: 'AUD' }; } }) },
    });
    const result = await route.POST({ json: async () => ({ pickup_address: address, dropoff_address: address, ...scenario.data }) });
    assert.equal(result.status, scenario.status);
    if (scenario.status === 200) {
      assert.equal(result.body.data.fee, 10);
      assert.equal(calls[0].schedule.pickup_at, scenario.pickup);
      assert.equal(calls[0].schedule.delivery_at, scenario.delivery);
    } else assert.equal(calls.length, 0);
  });
}
