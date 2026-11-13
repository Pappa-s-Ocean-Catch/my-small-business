import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { getEditedOrderPaymentAction } from '../lib/edit-order-payment';
const jsx = (type: string, props: any) => ({ type, props });
const nodes = (tree: any): any[] => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function dialogs(paired: boolean) {
  const calls: any[] = [];
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync('components/pos/PosDialogs.tsx', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)((id: string) => {
    if (id === 'react') return { useState: (value: unknown) => [value, () => {}], useEffect: () => {}, useCallback: (fn: unknown) => fn };
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-native') return { Platform: { OS: 'android' }, Text: 'Text', View: 'View', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity' };
    if (id === 'react-native-paper') return { Portal: 'Portal', TextInput: { Affix: 'Affix' } };
    if (id.endsWith('/SelectionSheet')) return { SelectionSheet: 'SelectionSheet' };
    if (id.endsWith('/ResponsiveDialog')) return { ResponsiveDialog: Object.assign('Dialog', { Title: 'Title', Content: 'Content', Actions: 'Actions' }) };
    if (id.endsWith('/redesign')) return { designTokens: { color: {} } };
    if (id.endsWith('/pos.styles')) return { styles: {} };
    if (id.endsWith('/instore-smartpay-checkout')) return { getSmartpayCheckoutProgress: () => ({}) };
    return new Proxy({}, { get: () => () => null });
  }, module, module.exports);
  const tree = module.exports.PosDialogs({ total: 10, cashTenderMode: null, smartpayPaired: paired, smartpayProcessing: false, quickOrderNotes: ['Salt', 'No salt'], quickItemNotes: [], saltOptionDialogVisible: true, instorePaymentDialogVisible: true, quickOrderNote: null, isEditingOrder: false, eligibleFreeItemProducts: [], onChooseInstorePayment: (choice: string) => calls.push(choice), setInstorePaymentDialogVisible: (value: boolean) => calls.push(['payment-visible', value]), setQuickOrderNote: (value: string) => calls.push(['salt', value]), setSaltOptionDialogVisible: (value: boolean) => calls.push(['salt-visible', value]) });
  return { calls, sheets: nodes(tree).filter(n => n.type === 'SelectionSheet') };
}
test('POS payment and salt pickers directly dispatch the chosen action and allow Cancel', () => {
  const { calls, sheets } = dialogs(true);
  const payment = sheets.find(n => n.props.selection?.title === 'Complete in-store order')!;
  assert.deepEqual(payment.props.selection.options.map((o: any) => o.label), ['Cash', 'Card', 'SmartPay', 'Unpaid']);
  payment.props.selection.onSelect('smartpay');
  assert.deepEqual(calls, ['smartpay']);
  payment.props.onDismiss();
  assert.deepEqual(calls[1], ['payment-visible', false]);
  const salt = sheets.find(n => n.props.selection?.title === 'Salt preference')!;
  salt.props.selection.onSelect('No salt');
  assert.deepEqual(calls[2], ['salt', 'No salt']);
});
test('unpaired SmartPay stays disabled', () => {
  const { sheets } = dialogs(false);
  assert.equal(sheets.find(n => n.props.selection?.title === 'Complete in-store order')!.props.selection.options.find((o: any) => o.value === 'smartpay').disabled, true);
});
function choosePayment(editing: boolean) {
  const calls: any[] = [];
  const source = ts.createSourceFile('pos.tsx', readFileSync('app/pos.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer: ts.Expression | undefined;
  const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleChooseInstorePayment') initializer = node.initializer; ts.forEachChild(node, visit); };
  visit(source);
  assert.ok(initializer);
  const env = { orderId: editing ? 'existing' : null, setInstorePaymentDialogVisible: (v: boolean) => calls.push(['visible', v]), getEditedOrderPaymentAction, setCashTenderMode: (v: string) => calls.push(['cash-tender', v]), handleCheckout: (v: string) => calls.push(['edit', v]), handleSmartpayInstoreCheckout: () => calls.push(['terminal']), handleInstoreCheckout: (v: string) => calls.push(['instore', v]) };
  const code = ts.transpileModule(`const choose = ${initializer.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return { calls, choose: new Function(...Object.keys(env), `${code}; return choose;`)(...Object.values(env)) };
}
test('new POS payment choices preserve tender and terminal flows', () => {
  for (const [choice, expected] of [['cash', ['cash-tender', 'instore']], ['card', ['instore', 'card']], ['smartpay', ['terminal']], ['unpaid', ['instore', 'unpaid']]] as const) {
    const flow = choosePayment(false);
    flow.choose(choice);
    assert.deepEqual(flow.calls, [['visible', false], [...expected]]);
  }
});
test('edited orders preserve existing payment mappings', () => {
  for (const [choice, expected] of [['cash', ['cash-tender', 'pickup']], ['card', ['edit', 'card']], ['smartpay', ['edit', 'smartpay']], ['unpaid', ['edit', 'no_pay']]] as const) {
    const flow = choosePayment(true);
    flow.choose(choice);
    assert.deepEqual(flow.calls, [['visible', false], [...expected]]);
  }
});

test('POS payment picker defers the next native payment surface until dismissal', () => {
  const { sheets } = dialogs(true);
  assert.equal(sheets.find(n => n.props.selection?.title === 'Complete in-store order')!.props.deferSelectionUntilDismissed, true);
});
