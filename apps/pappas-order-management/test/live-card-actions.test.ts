import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

type Element = { type: string; props: Record<string, any> };
// Render the actual component's JSX and invoke its event handlers without a native runtime.
const jsx = (type: string, props: Record<string, any>): Element => ({ type, props });
const output = ts.transpileModule(readFileSync('components/LiveOrderListItem.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const componentModule = { exports: {} as any };
new Function('require', 'module', 'exports', output)((id: string) => {
  if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (id === 'react') return {};
  if (id === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (styles: any) => styles } };
  if (id.endsWith('/ActionButton')) return { ActionButton: 'Button' };
  if (id.endsWith('/ManualPrintButton')) return { ManualPrintButton: 'Print' };
  if (id.endsWith('/ui')) return { StatusBadge: 'Badge' };
  if (id.endsWith('/presentation')) return { fulfilmentTone: () => 'neutral', paymentTone: () => 'neutral', orderPaymentLabel: (value: string) => value };
  if (id.endsWith('/redesign')) return { designTokens: { color: {}, radius: {} } };
  if (id.endsWith('/orderNumber')) return { getFriendlyOrderNumber: (value: string) => value };
  if (id.endsWith('/constants')) return { STATUS_LABELS: { preparing: 'Preparing' }, getDeliveryStatusLabel: () => '' };
  if (id.endsWith('/orderUtils')) return { getOrderChannel: (order: any) => order.order_channel || 'instore', paymentSummary: () => 'Pickup', getNextQuickAction: () => ({ action: 'ready', label: 'Mark ready' }), formatElapsed: () => ({ text: '1m', minutes: 1 }) };
  if (id.endsWith('/order-status-feedback')) return { getOrderActionFeedback: (_id: string, _updating: any, label: string) => ({ label, isUpdating: false }) };
  throw new Error(`Unexpected component dependency: ${id}`);
}, componentModule, componentModule.exports);
const nodes = (tree: any): Element[] => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = (tree: any): string => typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(text).join('') : tree?.props ? text(tree.props.children) : '';
function render(overrides: Record<string, any> = {}) {
  const calls: string[] = [];
  const order = { id: 'order', order_number: 'P01', payment_status: 'pending', order_status: 'preparing', total: 10, items: [], created_at: '2026-10-28', customer_name: 'Customer' };
  const tree = componentModule.exports.LiveOrderListItem({ order, nowMs: 0, updatingStatus: null, availablePrinters: [], onOrderPress: () => calls.push('detail'), onCustomerPress: () => calls.push('customer'), onQuickAction: () => calls.push('status'), onStatusUpdate: () => calls.push('status-menu'), onPaymentStatusUpdate: () => calls.push('payment'), onSmartpayPayment: () => calls.push('smartpay'), smartpayPaired: true, ...overrides });
  return { tree, calls, all: nodes(tree) };
}
test('tapping live card opens details without a separate View order action', () => {
  const { tree, calls, all } = render();
  assert.equal(tree.type, 'Pressable');
  tree.props.onPress();
  assert.deepEqual(calls, ['detail']);
  assert.equal(all.some(node => node.type === 'Button' && text(node) === 'View order'), false);
});
test('payment badge and SmartPay remain independent without a duplicate payment button', () => {
  const { calls, all } = render();
  let stopped = 0;
  const event = { stopPropagation: () => stopped++ };
  const payment = all.find(node => node.props.accessibilityLabel === 'Payment: pending');
  assert.ok(payment, 'Tappable payment badge');
  assert.equal(all.some(node => node.type === 'Button' && text(node) === 'Change payment'), false);
  payment.props.onPress(event);
  const smartpay = all.find(node => node.type === 'Button' && text(node) === 'SmartPay');
  assert.ok(smartpay);
  smartpay.props.onPress(event);
  assert.deepEqual(calls, ['payment', 'smartpay']);
  assert.equal(stopped, 2, 'Child actions do not also open order details');
});
test('paid and busy orders keep payment guards', () => {
  const paid = render({ order: { id: 'paid', order_number: 'P02', payment_status: 'paid', order_status: 'preparing', total: 10, items: [] } });
  assert.equal(paid.all.some(node => node.type === 'Button' && ['Change payment', 'SmartPay'].includes(text(node))), false);
  const busy = render({ updatingStatus: 'order' });
  assert.equal(busy.all.find(node => node.props.accessibilityLabel === 'Payment: pending')?.props.disabled, true);
});
test('customer, status and print controls do not also open detail', () => {
  const { calls, all } = render();
  const event = { stopPropagation() {} };
  all.find(node => node.props.accessibilityLabel === 'Customer Customer')!.props.onPress(event);
  all.find(node => node.props.accessibilityLabel === 'Status: Preparing')!.props.onPress(event);
  all.find(node => node.type === 'Button' && text(node) === 'Mark ready')!.props.onPress(event);
  const print = all.find(node => node.type === 'Print')!.props.renderTrigger({ onPress: () => calls.push('print-picker'), disabled: false, loading: false });
  print.props.onPress(event);
  assert.deepEqual(calls, ['customer', 'status-menu', 'status', 'print-picker']);
});
test('SmartPay remains visible but cannot start without pairing', () => {
  const { all } = render({ smartpayPaired: false });
  assert.equal(all.find(node => node.type === 'Button' && text(node) === 'SmartPay')?.props.disabled, true);
});
const flatStyle = (style: any): Record<string, any> => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity).filter(Boolean) : [style]));
test('one, five and ten item live cards share fixed section heights', () => {
  const results = [1, 5, 10].map(count => {
    const result = render({ order: { id: 'order', order_number: 'P01', payment_status: 'pending', order_status: 'preparing', total: 10, customer_name: 'A long customer name that wraps on narrow cards', external_order_number: 'external-id', items: Array.from({ length: count }, (_, index) => ({ id: String(index), quantity: 1, product_name: `A long product name for item ${index}` })) }, successfulOrderCount: count, printState: count > 1 ? { status: 'success' } : null });
    const preview = result.all.find(node => node.props.testID === 'live-order-item-preview');
    assert.ok(preview, 'Bounded item preview');
    const height = flatStyle(result.tree.props.style).height;
    assert.ok(height > 0, 'Card has a consistent explicit height');
    return { ...result, height, previewHeight: flatStyle(preview.props.style).height };
  });
  assert.deepEqual(results.map(result => result.height), [results[0].height, results[0].height, results[0].height]);
  assert.deepEqual(results.map(result => result.previewHeight), [results[0].previewHeight, results[0].previewHeight, results[0].previewHeight]);
  assert.equal(results[0].all.some(node => node.props.accessibilityLabel === 'View 0 more items'), false);
  const more = results[2].all.find(node => node.props.accessibilityLabel === 'View 7 more items');
  assert.ok(more, 'Overflow items remain reachable');
  let stopped = false;
  more.props.onPress({ stopPropagation: () => { stopped = true; } });
  assert.deepEqual(results[2].calls, ['detail']);
  assert.equal(stopped, true);
});
test('larger configured previews scroll within the same card height', () => {
  const order = { id: 'order', order_number: 'P01', payment_status: 'pending', order_status: 'preparing', total: 10, items: Array.from({ length: 12 }, (_, index) => ({ id: String(index), quantity: 1, product_name: `Product ${index}` })) };
  const normal = render({ order, previewItemsLimit: 3 });
  const expanded = render({ order, previewItemsLimit: 12 });
  assert.equal(flatStyle(normal.tree.props.style).height, flatStyle(expanded.tree.props.style).height);
  const preview = expanded.all.find(node => node.props.testID === 'live-order-item-preview');
  assert.equal(preview?.type, 'ScrollView');
  assert.equal(nodes(preview).filter(node => node.type === 'Text').length, 12);
  const compact = render({ order, compact: true });
  assert.ok(flatStyle(compact.tree.props.style).height < flatStyle(normal.tree.props.style).height);
});


test('marketplace header shows provider and external ID once for pickup and delivery', () => {
  for (const partner of ['Uber Eats', 'DoorDash']) {
    for (const orderType of ['pickup', 'delivery']) {
      const { all } = render({ order: { id: 'marketplace', order_number: 'P036', customer_name: 'Michael T', order_channel: 'third_party', order_type: orderType, delivery_partner_name: partner, external_order_number: '90A74', payment_status: 'paid', order_status: 'preparing', total: 32.40, items: [] } });
      const labels = all.filter(node => node.type === 'Text').map(text);
      assert.equal(labels.filter(label => label.includes(partner)).length, 1);
      assert.equal(labels.filter(label => label.includes('90A74')).length, 1);
      assert.ok(labels.includes(`${partner} • ID 90A74`));
    }
  }
});
test('marketplace header handles missing external ID without hiding the provider', () => {
  const { all } = render({ order: { id: 'marketplace', order_number: 'P036', order_channel: 'third_party', delivery_partner_name: 'Uber Eats', payment_status: 'paid', order_status: 'preparing', total: 10, items: [] } });
  const labels = all.filter(node => node.type === 'Text').map(text);
  assert.equal(labels.filter(label => label.includes('Uber Eats')).length, 1);
  assert.ok(labels.includes('Uber Eats'));
  assert.ok(!labels.some(label => label.includes('External ID')));
});
