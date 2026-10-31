import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

type Node = { type: string; props: Record<string, any> };
const jsx = (type: string, props: Record<string, any>): Node => ({ type, props });
const nodes = (tree: any): Node[] => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = (tree: any): string => tree == null ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(text).join('') : text(tree.props?.children);
const noop = () => {};
function component(file: string, width = 390) {
  const module = { exports: {} as any };
  const output = ts.transpileModule(readFileSync(`components/pos/${file}.tsx`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', output)((id: string) => {
    if (id === 'react') return { memo: (fn: any) => fn, useState: (v: any) => [v, noop], useMemo: (fn: any) => fn(), useEffect: noop, Fragment: 'Fragment' };
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-native') return { View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', FlatList: 'FlatList', ScrollView: 'ScrollView', Platform: { OS: 'android' }, StyleSheet: { create: (v: any) => v }, useWindowDimensions: () => ({ width, height: 640 }) };
    if (id.includes('safe-area-context')) return { useSafeAreaInsets: () => ({ bottom: 0 }) };
    if (id === 'react-native-paper') return { Divider: 'Divider', IconButton: 'IconButton' };
    if (id.endsWith('ActionButton')) return { ActionButton: 'Button' };
    if (id.endsWith('/ui')) return { FormField: 'FormField' };
    if (id.endsWith('/redesign')) return { designTokens: { color: {} } };
    if (id.endsWith('/pos.styles')) return { styles: new Proxy({}, { get: (_t, key) => ({ name: key }) }) };
    if (id.endsWith('/orderNumber')) return { getFriendlyOrderNumber: (v: any) => v };
    if (id.endsWith('/orderUtils')) return { groupAddons: () => [] };
    return new Proxy({}, { get: (_t, key) => key === '__esModule' ? true : String(key) });
  }, module, module.exports);
  return module.exports[file];
}

for (const phone of [false, true]) {
  test(`cart ${phone ? 'phone' : 'tablet'} keeps edit actions in the same scroll list as five items`, () => {
    let updates = 0;
    const render = component('PosCartPane');
    const tree = render({ orderId: 'order', cartItems: Array.from({ length: 5 }, (_, i) => ({ id: String(i), quantity: 1 })), totals: { subtotal: 50, total: 50 }, handleCheckout: () => updates++, isPhoneLayout: phone });
    const list = nodes(tree).find(n => n.type === 'FlatList')!;
    assert.equal(list.props.data.length, 5);
    assert.ok(list.props.ListHeaderComponent);
    const footer = nodes(list.props.ListFooterComponent);
    const update = footer.find(n => n.type === 'Button' && text(n) === 'Update Order');
    assert.ok(update, 'Update Order must be inside the scrollable footer');
    assert.equal(nodes(tree).filter(n => n.type === 'Button' && text(n) === 'Update Order').length, 0, 'No clipped sibling footer');
    update.props.onPress(); assert.equal(updates, 1);
  });
}

const pickupProps = (overrides: any = {}) => ({ customerLookupStatus: 'idle', customerPhone: '0400000000', customerName: '', rewardPointsEnabled: false, rewardPointsBalance: 0, cartItemsCount: 5, isPreOrder: false, orderNoteText: '', creatingOrder: false, smartpayProcessing: false, ...overrides });
for (const width of [320, 390, 599]) {
  test(`pickup action at ${width}px stays outside scrolling form and preserves unpaid flow`, () => {
    const calls: string[] = [];
    const tree = component('PosPickupCheckoutForm', width)(pickupProps({ handleCheckout: (choice: string) => calls.push(choice) }));
    const scroll = nodes(tree).find(n => n.type === 'ScrollView')!;
    const submit = nodes(tree).filter(n => n.type === 'Button' && text(n) === 'Create pickup order');
    assert.equal(submit.length, 1);
    assert.ok(!nodes(scroll).includes(submit[0]), 'Primary action must not scroll out of view');
    assert.equal(submit[0].props.disabled, false);
    submit[0].props.onPress(); assert.deepEqual(calls, ['no_pay']);
  });
}
test('pickup validation and update label remain intact', () => {
  const render = component('PosPickupCheckoutForm');
  for (const override of [{ customerPhone: '' }, { cartItemsCount: 0 }, { creatingOrder: true }, { smartpayProcessing: true }]) {
    const tree = render(pickupProps(override));
    assert.equal(nodes(tree).find(n => n.type === 'Button' && text(n) === 'Create pickup order')?.props.disabled, true);
  }
  const tree = render(pickupProps({ orderId: 'order', customerPhone: '' }));
  assert.equal(nodes(tree).find(n => n.type === 'Button' && text(n) === 'Update order')?.props.disabled, false);
});

test('small-phone customer fields share a compact row with accessible search actions', () => {
  const tree = component('PosCustomerSelector', 320)(pickupProps());
  for (const label of ['Enter customer phone', 'Enter customer name']) {
    const fieldParent = nodes(tree).find(n => nodes(n.props?.children).some(child => child.props?.accessibilityLabel === label) && Array.isArray(n.props?.children) && n.props.children.some((child: any) => child?.props?.accessibilityLabel === label));
    assert.ok(fieldParent);
    const style = Object.assign({}, ...[fieldParent.props.style].flat().filter(Boolean));
    assert.equal(style.minWidth, 0, 'Fields may shrink instead of stacking on narrow phones');
  }
  for (const label of ['Find customer', 'Recent calls']) {
    assert.ok(nodes(tree).some(n => n.type === 'IconButton' && n.props.accessibilityLabel === label));
  }
});
