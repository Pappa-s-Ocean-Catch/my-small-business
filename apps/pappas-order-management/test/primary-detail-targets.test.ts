import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const jsx = (type: string, props: any) => ({ type, props });
const nodes = (tree: any): any[] => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function component(file: string) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', code)((id: string) => {
    if (id === 'react') return {};
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable', TouchableOpacity: 'TouchableOpacity', FlatList: 'FlatList', StyleSheet: { create: (v: unknown) => v }, useWindowDimensions: () => ({ width: 1200, fontScale: 1 }) };
    if (id === 'react-native-paper') return { Card: Object.assign('Card', { Content: 'Card.Content' }), Avatar: { Text: 'Avatar' }, Text: 'Text', Surface: 'Surface', useTheme: () => ({ colors: {} }) };
    if (id.endsWith('/ActionButton')) return { ActionButton: 'Button' };
    if (id.endsWith('/ui')) return { StatusBadge: 'Badge', SearchField: 'Search' };
    if (id.endsWith('/redesign')) return { designTokens: { color: {}, radius: {} } };
    if (id.endsWith('/orderNumber')) return { getFriendlyOrderNumber: (value: string) => value };
    if (id.endsWith('/constants')) return { STATUS_LABELS: {} };
    if (id.endsWith('/orderUtils')) return { paymentSummary: () => 'Pickup' };
    if (id.endsWith('/presentation')) return { fulfilmentTone: () => 'neutral', paymentTone: () => 'neutral', orderPaymentLabel: () => 'Paid' };
    return {};
  }, module, module.exports);
  return module.exports;
}
for (const compact of [false, true]) {
  test(`history ${compact ? 'row' : 'card'} opens order from its primary target and isolates customer taps`, () => {
    const { HistoryOrderListItem } = component('components/HistoryOrderListItem.tsx');
    const calls: string[] = [];
    const tree = HistoryOrderListItem({ compact, order: { id: 'order', order_number: 'P036', customer_name: 'Michael', order_status: 'completed', payment_status: 'paid', total: 10, created_at: '2026-10-30', items: [] }, onOrderPress: () => calls.push('order'), onCustomerPress: () => calls.push('customer') });
    const all = nodes(tree);
    assert.equal(all.filter(n => n.type === 'Button').length, 0);
    assert.equal(typeof tree.props.onPress, 'function');
    tree.props.onPress();
    assert.deepEqual(calls, ['order']);
    calls.length = 0;
    const customer = all.find(n => n.props.accessibilityLabel === 'Open customer Michael');
    assert.ok(customer);
    let stopped = false;
    customer.props.onPress({ stopPropagation: () => { stopped = true; } });
    if (!stopped) tree.props.onPress();
    assert.deepEqual(calls, ['customer']);
    assert.ok(all.some(n => n.props.accessibilityLabel === 'Open order P036'));
  });
}
test('customer directory rows open the customer without a separate View action', () => {
  const { CustomerDirectoryList } = component('components/customers/CustomerDirectoryList.tsx');
  const customer = { id: 'customer', name: 'Michael', totalOrders: 2 };
  const selected: unknown[] = [];
  const tree = CustomerDirectoryList({ customers: [customer], searchQuery: '', onChangeSearchQuery: () => {}, onSelectCustomer: (value: unknown) => selected.push(value) });
  const row = nodes(tree).find(n => n.type === 'FlatList')!.props.renderItem({ item: customer, index: 0 });
  assert.equal(row.props.accessibilityRole, 'button');
  row.props.onPress();
  assert.deepEqual(selected, [customer]);
  assert.equal(nodes(row).filter(n => n.type === 'Button').length, 0);
});

test('pre-order rows open the order while customer-name taps remain separate', () => {
  const source = ts.createSourceFile('pre-orders.tsx', readFileSync('app/(drawer)/pre-orders.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let renderer: ts.Expression | undefined;
  const visit = (node: ts.Node) => { if (ts.isJsxAttribute(node) && node.name.getText(source) === 'renderItem' && node.initializer && ts.isJsxExpression(node.initializer)) renderer = node.initializer.expression; ts.forEachChild(node, visit); };
  visit(source);
  assert.ok(renderer);
  const calls: string[] = [];
  const env = { styles: {}, columns: 2, getFriendlyOrderNumber: (v: string) => v, formatCollectionTime: () => 'Tomorrow', nowMs: 0, StatusBadge: 'Badge', Pressable: 'Pressable', Text: 'Text', View: 'View', PaperButton: 'Button', orderPaymentLabel: () => 'Paid', paymentTone: () => 'neutral', handleOrderPress: () => calls.push('order'), handleCustomerPress: () => calls.push('customer') };
  const code = ts.transpileModule(`const render = ${renderer.getText(source)};`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const render = new Function('require', ...Object.keys(env), `const exports = {}; ${code}; return render;`)(() => ({ jsx, jsxs: jsx }), ...Object.values(env));
  const tree = render({ item: { order_number: 'P036', customer_name: 'Michael', total: 10, items: [] } });
  tree.props.onPress();
  assert.deepEqual(calls, ['order']);
  calls.length = 0;
  let stopped = false;
  nodes(tree).find(n => n.props.accessibilityLabel === 'Open customer Michael')!.props.onPress({ stopPropagation: () => { stopped = true; } });
  if (!stopped) tree.props.onPress();
  assert.deepEqual(calls, ['customer']);
  assert.equal(nodes(tree).filter(n => n.type === 'Button').length, 0);
});
test('customer and order detail surfaces do not retain redundant View action buttons', () => {
  for (const file of ['components/HistoryOrderListItem.tsx', 'components/CustomerModal.tsx', 'components/OrderDetailModal.tsx', 'components/customers/CustomerDirectoryList.tsx', 'app/(drawer)/pre-orders.tsx']) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) && /Button$/.test(node.openingElement.tagName.getText(source))) {
        const label = node.children.filter(ts.isJsxText).map(child => child.text.trim()).join(' ').trim();
        assert.doesNotMatch(label, /^View(?: order| customer)?$/i, file);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
});

test('reward order label opens its order while the separate chevron expands reward details', () => {
  const source = ts.createSourceFile('CustomerModal.tsx', readFileSync('components/CustomerModal.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let renderer: ts.ArrowFunction | undefined;
  const visit = (node: ts.Node) => { if (ts.isArrowFunction(node) && ts.isBlock(node.body) && node.body.statements.some(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(d => d.name.getText(source) === 'rewardTitle'))) renderer = node; ts.forEachChild(node, visit); };
  visit(source);
  assert.ok(renderer);
  const calls: string[] = [];
  const env = { customer: { orders: [{ id: 'order', orderNumber: 'P036' }] }, rewardHistoryTone: () => ({ label: 'Earned' }), getFriendlyOrderNumber: (v: string) => v, styles: {}, expandedRewards: {}, View: 'View', TouchableOpacity: 'TouchableOpacity', IconButton: 'IconButton', Text: 'Text', StatusBadge: 'Badge', t: { color: {} }, formatDate: () => 'Today', setDetailOrderId: (id: string) => calls.push(id), setExpandedRewards: () => calls.push('expand') };
  const code = ts.transpileModule(`const render = ${renderer.getText(source)};`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const render = new Function('require', ...Object.keys(env), `const exports = {}; ${code}; return render;`)(() => ({ jsx, jsxs: jsx }), ...Object.values(env));
  const all = nodes(render({ id: 'reward', orderId: 'order', type: 'earned', points: 10 }));
  all.find(n => n.props.accessibilityLabel === 'Open order P036')!.props.onPress();
  assert.deepEqual(calls, ['order']);
  all.find(n => n.props.accessibilityLabel === 'Show reward details')!.props.onPress();
  assert.deepEqual(calls, ['order', 'expand']);
});
