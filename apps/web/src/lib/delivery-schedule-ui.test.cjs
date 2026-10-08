const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = fs.readFileSync(path.resolve(__dirname, '../app/order/summary/components/OrderScheduleSelector.tsx'), 'utf8');
const moduleSource = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', moduleSource)(require, loaded, loaded.exports);
const { OrderScheduleSelector } = loaded.exports;
const props = {
  isOpen: false, option: 'scheduled', days: [{ date: '2026-10-09', dateLabel: 'Fri, 9 Oct', slots: [{ value: '2026-10-09T00:15:00Z', label: '11:15' }] }],
  selectedDate: '2026-10-09', selectedTime: null, onOptionChange() {}, onDateChange() {}, onTimeChange() {},
};
test('scheduled delivery shows only delivery date and time, with no pickup or ready selector', () => {
  const html = renderToStaticMarkup(React.createElement(OrderScheduleSelector, { ...props, orderType: 'delivery' }));
  assert.equal((html.match(/<select\b/g) || []).length, 2);
  assert.match(html, /Delivery date/);
  assert.match(html, /Delivery time \(required\)/);
  assert.doesNotMatch(html, /pickup|ready|As soon/i);
});
test('scheduled pickup still shows its own pickup time selection', () => {
  const html = renderToStaticMarkup(React.createElement(OrderScheduleSelector, { ...props, orderType: 'pickup' }));
  assert.equal((html.match(/<select\b/g) || []).length, 2);
  assert.match(html, /Pickup time \(required\)/);
  assert.doesNotMatch(html, /Delivery time/);
});
test('open-store ASAP delivery stays available without a forced schedule', () => {
  const html = renderToStaticMarkup(React.createElement(OrderScheduleSelector, { ...props, orderType: 'delivery', isOpen: true, option: 'asap' }));
  assert.match(html, /As soon as possible/);
  assert.doesNotMatch(html, /<select\b/);
});
