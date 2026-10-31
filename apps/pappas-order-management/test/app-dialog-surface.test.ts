import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createAppDialogStore } from '../lib/app-dialog';
const jsx = (type: string, props: any) => ({ type, props });
const nodes = (tree: any): any[] => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function surface(store: ReturnType<typeof createAppDialogStore>) {
  let escape: () => void = () => {};
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync('components/ui/AppDialogHost.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', code)((id: string) => {
    if (id === 'react') return { createContext: () => ({}), useContext: () => 0, useEffect: () => {}, useRef: (v: unknown) => ({ current: v }), useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() };
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (v: unknown) => v } };
    if (id === 'react-native-paper') return { IconButton: 'IconButton' };
    if (id.endsWith('/app-dialog')) return { appDialogStore: store };
    if (id.endsWith('/redesign')) return { designTokens: { color: {}, radius: {} } };
    if (id.endsWith('/useModalFocus')) return { useModalFocus: (_ref: unknown, _visible: boolean, close: () => void) => { escape = close; } };
    if (id.endsWith('/ActionButton')) return { ActionButton: 'Button' };
    if (id === '@react-navigation/native') return {};
    throw new Error(id);
  }, module, module.exports);
  return { render: (hostId: number) => nodes(module.exports.AppDialogOverlay({ hostId })), escape: () => escape() };
}
test('custom choice modal invokes a payment-like action on tap and provides Cancel', async () => {
  const store = createAppDialogStore();
  const hostId = store.registerHost(1);
  const calls: string[] = [];
  store.alert('Select payment', '', [{ text: 'Cash', onPress: () => { calls.push('cash'); } }, { text: 'Card', onPress: () => { calls.push('card'); } }]);
  const view = surface(store);
  const buttons = view.render(hostId).filter(n => n.type === 'Button');
  assert.deepEqual(buttons.map(n => n.props.children), ['Cash', 'Card', 'Cancel']);
  buttons[0].props.onPress();
  buttons[0].props.onPress();
  assert.deepEqual(calls, ['cash']);
  assert.equal(store.getSnapshot().dialog, null);
});
test('custom destructive confirmation cancels on Escape without executing its action', () => {
  const store = createAppDialogStore();
  const hostId = store.registerHost(101);
  let deleted = false;
  store.alert('Delete?', 'Cannot undo', [{ text: 'Delete', style: 'destructive', onPress: () => { deleted = true; } }]);
  const view = surface(store);
  const rendered = view.render(hostId);
  assert.ok(rendered.some(n => n.props.accessibilityLabel === 'Close Delete?'));
  view.escape();
  assert.equal(deleted, false);
  assert.equal(store.getSnapshot().dialog, null);
});
test('only the topmost modal renders the queued dialog', () => {
  const store = createAppDialogStore();
  const parent = store.registerHost(1);
  const child = store.registerHost(101);
  store.alert('Nested error');
  const view = surface(store);
  assert.equal(view.render(parent).length, 0);
  assert.ok(view.render(child).some(n => n.props.children === 'Nested error'));
});
