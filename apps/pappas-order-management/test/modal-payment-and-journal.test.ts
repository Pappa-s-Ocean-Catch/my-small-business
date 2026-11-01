import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { usePendingOnlinePaymentsStore as paymentStore } from '../stores/pendingOnlinePaymentsStore';
import { refreshPendingPayment } from '../lib/pending-payment-monitor';

const jsx = (type: string, props: any) => ({ type, props });
const nodes = (tree: any): any[] => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const noop = () => {};
function load(file: string, extra: (id: string) => unknown) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)((id: string) => {
    const supplied = extra(id); if (supplied) return supplied;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react') return { useRef: (current: any) => ({ current }), useState: (value: any) => [value, noop], useMemo: (fn: any) => fn(), useEffect: noop };
    if (id === 'react-native') return { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable', StyleSheet: { create: (v: any) => v }, useWindowDimensions: () => ({ width: 1200, height: 900 }) };
    if (id.includes('safe-area-context')) return { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
    if (id.endsWith('/useModalFocus')) return { useModalFocus: noop };
    if (id.endsWith('/redesign')) return { designTokens: { color: {}, radius: {} }, getWindowSizeClass: () => 'expanded' };
    return new Proxy({}, { get: (_t, key) => key === '__esModule' ? true : String(key) });
  }, module, module.exports);
  return module.exports;
}

test('online payment minimises, reopens the same session and survives a polling failure', async () => {
  paymentStore.setState({ sessions: [] });
  paymentStore.getState().upsertSession({ orderId: 'order', orderNumber: 'P001', customerName: 'Test', customerPhone: '0400000000', paymentUrl: 'https://example.test/payment', deliveryAddress: null, deliveryEtaMinutes: null, totalAmount: 20, deliveryFee: 0, serviceFee: 0, isTestPayment: true, itemSummaries: [] });
  const component = load('lib/PendingOnlinePaymentsOverlay.tsx', id => {
    if (id.endsWith('/pendingOnlinePaymentsStore')) return { usePendingOnlinePaymentsStore: (selector: any) => selector(paymentStore.getState()) };
    if (id.endsWith('/FullScreenModal')) return { FullScreenModal: 'FullScreen' };
    if (id === 'react-native-paper') return { Surface: 'Surface', Text: 'Text', Card: Object.assign('Card', { Content: 'CardContent' }), Button: 'Button' };
    return undefined;
  }).PendingOnlinePaymentsOverlay;
  let tree = component();
  const screen = nodes(tree).find(n => n.type === 'FullScreen')!;
  assert.equal(screen.props.closeLabel, 'Minimise payment');
  screen.props.onClose();
  assert.equal(paymentStore.getState().sessions[0].minimized, true);
  await refreshPendingPayment('order', async () => ({ data: null, error: 'offline' }), paymentStore.getState().removeSession);
  assert.equal(paymentStore.getState().sessions[0].status, 'pending');
  tree = component();
  assert.equal(nodes(tree).some(n => n.type === 'FullScreen'), false);
  nodes(tree).find(n => n.type === 'Button' && n.props.children === 'Open')!.props.onPress();
  assert.equal(paymentStore.getState().sessions[0].minimized, false);
  assert.equal(nodes(component()).find(n => n.type === 'FullScreen')?.props.title, 'Order P001');
  assert.equal(paymentStore.getState().sessions[0].paymentUrl, 'https://example.test/payment');
  paymentStore.setState({ sessions: [] });
});

test('full-screen frame fills the native window and Back minimises without cancelling payment', () => {
  let minimised = 0;
  const component = load('components/ui/FullScreenModal.tsx', id => id.endsWith('/AppModal') ? { AppModal: 'Modal' } : undefined).FullScreenModal;
  const all = nodes(component({ visible: true, title: 'Waiting for payment', onClose: () => minimised++, children: 'Payment information' }));
  const modal = all.find(n => n.type === 'Modal')!;
  assert.equal(modal.props.transparent, false);
  assert.equal(modal.props.presentationStyle, 'fullScreen');
  modal.props.onRequestClose();
  assert.equal(minimised, 1);
});

test('sidebar Journal opens locally without leaving or closing the current POS draft', () => {
  let open = false;
  const calls: string[] = [];
  const component = load('components/navigation/AppNavigation.tsx', id => {
    if (id === 'react') return { useState: () => [open, (value: boolean) => { open = value; }] };
    if (id === 'expo-router') return { usePathname: () => '/pos', useRouter: () => ({ navigate: () => calls.push('navigate') }) };
    if (id.endsWith('/PrintLogsModal')) return { JournalLogsModal: 'Journal' };
    if (id.endsWith('/journal-config')) return { JOURNAL_LOGS_ENABLED: true };
    return undefined;
  }).AppNavigation;
  nodes(component({ onNavigate: () => calls.push('close') })).find(n => n.props.accessibilityLabel === 'Journal')!.props.onPress();
  assert.equal(open, true);
  assert.deepEqual(calls, []);
  nodes(component({})).find(n => n.type === 'Journal')!.props.onClose();
  assert.equal(open, false);
});


test('POS SmartPay minimise is immediate and leaves payment processing running', () => {
  const source = ts.createSourceFile('pos.tsx', readFileSync('app/pos.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = '';
  const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'confirmDismissSmartpayLock') expression = node.initializer!.getText(source); ts.forEachChild(node, visit); };
  visit(source);
  const calls: boolean[] = [];
  const handler = new Function('smartpayProcessing', 'setSmartpayDialogMinimized', `return (${expression})`)(true, (value: boolean) => calls.push(value));
  handler();
  assert.deepEqual(calls, [true]);
  assert.doesNotMatch(expression, /Alert|setSmartpayProcessing|cancel|abort/);
});

test('full-screen header shares the dark presentation and an accessible minimise action', () => {
  let minimised = false;
  const header = load('components/ui/FullScreenModal.tsx', () => undefined).FullScreenModalHeader({ title: 'Waiting for payment', subtitle: 'Order #P001', closeLabel: 'Minimise payment', closeIcon: 'window-minimize', onClose: () => { minimised = true; } });
  assert.equal(Object.assign({}, ...header.props.style).backgroundColor, '#10243f');
  const close = nodes(header).find(n => n.props.accessibilityLabel === 'Minimise payment')!;
  assert.equal(close.props.icon, 'window-minimize');
  close.props.onPress();
  assert.equal(minimised, true);
});
