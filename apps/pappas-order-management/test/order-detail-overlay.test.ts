import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

type Node = { type: string; props: Record<string, any> };
const jsx = (type: string, props: Record<string, any>): Node => ({ type, props });
function render(showSimulator: boolean, onCustomerPress: () => void = () => {}, overrides: Record<string, any> = {}) {
  const output = ts.transpileModule(readFileSync('components/OrderDetailModal.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as any };
  const noop = () => null;
  new Function('require', 'module', 'exports', output)((id: string) => {
    if (id === 'react') return { useState: (value: unknown) => [value, noop], useCallback: (fn: unknown) => fn, useRef: (current: unknown) => ({ current }), useEffect: noop };
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-native') return { View: 'View', Text: 'Text', Modal: 'Modal', ScrollView: 'ScrollView', StyleSheet: { create: (v: unknown) => v }, useWindowDimensions: () => ({ width: 1366, height: 1024 }) };
    if (id.endsWith('/AppModal')) return { AppModal: 'Modal' };
    if (id === 'react-native-paper') return { Surface: 'Surface', IconButton: 'IconButton', Card: { Title: 'Card.Title', Content: 'Card.Content' } };
    if (id === 'expo-router') return { useRouter: () => ({}) };
    if (id.includes('safe-area')) return { useSafeAreaInsets: () => ({ bottom: 0 }) };
    if (id.endsWith('/redesign')) return { designTokens: { color: {}, radius: {} } };
    if (id.endsWith('/constants')) return { STATUS_COLORS: {}, STATUS_LABELS: {}, PAYMENT_STATUS_COLORS: {}, PAYMENT_STATUS_LABELS: {}, getDeliveryStatusColor: noop, getDeliveryStatusLabel: noop };
    if (id.endsWith('/orderNumber')) return { getFriendlyOrderNumber: (value: string) => value };
    if (id.endsWith('/orderUtils')) return { ...require('../utils/orderUtils') };
    if (id.endsWith('/useCustomerOrderCounts')) return { useCustomerOrderCounts: () => ({ data: {} }) };
    if (id.endsWith('/printerAutomationStore')) return { usePrinterAutomationStore: (fn: any) => fn({ orderPrintStates: {} }) };
    if (id.endsWith('/PrintSimulatorModal')) return { PrintSimulatorModal: 'PrintSimulatorModal' };
    if (id.endsWith('/PayByLinkModal')) return { PayByLinkModal: 'PayByLinkModal' };
    return new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : noop });
  }, module, module.exports);
  return module.exports.OrderDetailModal({ visible: true, showSimulator, order: { id: 'order', order_number: 'P036', customer_name: 'Customer', order_channel: 'third_party', order_type: 'pickup', order_status: 'preparing', payment_status: 'paid', total: 10, subtotal: 10, items: [], created_at: '2026-10-28T00:00:00Z' }, appSettings: { printerPaperWidth: '80mm' }, onClose: noop, onPrint: noop, onCustomerPress, ...overrides });
}
function pathTo(node: any, type: string, ancestors: Node[] = []): Node[] | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const child of node) { const found = pathTo(child, type, ancestors); if (found) return found; } return null; }
  if (node.type === type) return [...ancestors, node];
  return pathTo(node.props?.children, type, [...ancestors, node]);
}
test('receipt preview remains touchable and accessible while order detail background is inert', () => {
  const tree = render(true);
  const path = pathTo(tree, 'PrintSimulatorModal');
  assert.ok(path);
  assert.equal(path.at(-1)!.props.visible, true);
  for (const ancestor of path.slice(0, -1)) {
    assert.notEqual(ancestor.props.pointerEvents, 'none', 'Preview must not inherit blocked touches');
    assert.notEqual(ancestor.props.accessibilityElementsHidden, true, 'Preview must remain accessible');
    assert.notEqual(ancestor.props.importantForAccessibility, 'no-hide-descendants');
  }
});


test('order detail customer names open the customer without a separate View button', () => {
  let opens = 0;
  const tree = render(false, () => { opens++; });
  const targets: any[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (node.props?.accessibilityLabel === 'Open customer Customer') targets.push(node);
    visit(node.props?.children);
    visit(node.props?.subtitle);
  };
  visit(tree);
  assert.equal(targets.length, 2, 'Header and customer summary names are primary targets');
  targets.forEach(target => target.props.onPress());
  assert.equal(opens, 2);
});


test('tablet order detail is full-screen with the shared dark-header component', () => {
  const tree = render(false);
  assert.equal(tree.type, 'Modal');
  assert.equal(tree.props.transparent, false);
  assert.equal(tree.props.presentationStyle, 'fullScreen');
  const headerPath: any[] = [];
  const visit = (n: any) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(visit); return; } if (n.props?.closeLabel === 'Close order details') headerPath.push(n); visit(n.props?.children); };
  visit(tree);
  assert.equal(headerPath.length, 1);
  assert.equal(headerPath[0].props.title, 'Order #P036');
});
