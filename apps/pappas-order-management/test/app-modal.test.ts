import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const jsx = (type: string, props: any) => ({ type, props });
const nodes = (tree: any): any[] => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function render(active: boolean) {
  let closes = 0;
  let dismisses = 0;
  let nativeDismissed = 0;
  let layer = 0;
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync('components/ui/AppModal.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', code)((id: string) => {
    if (id === 'react') return { useContext: () => 2 };
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-native') return { View: 'View', Modal: 'NativeModal' };
    if (id.endsWith('/app-dialog')) return { appDialogStore: { getSnapshot: () => ({ dialog: active ? {} : null }), dismiss: () => { dismisses++; } } };
    if (id.endsWith('/AppDialogHost')) return { DialogLayerContext: { Provider: 'Provider' }, useAppDialogHost: (_visible: boolean, value: number) => { layer = value; return { hostId: 42, active }; }, AppDialogOverlay: 'Overlay' };
    throw new Error(id);
  }, module, module.exports);
  const all = nodes(module.exports.AppModal({ visible: true, children: 'Editor', onRequestClose: () => { closes++; }, onDismiss: () => { nativeDismissed++; } }));
  return { all, layer, native: all.find(n => n.type === 'NativeModal')!, counts: () => ({ closes, dismisses, nativeDismissed }) };
}
test('a nested custom dialog blocks the modal body while keeping its overlay interactive', () => {
  const result = render(true);
  assert.equal(result.layer, 103);
  assert.ok(result.all.some(n => n.props.children === 'Editor' && n.props.pointerEvents === 'none' && n.props.accessibilityElementsHidden === true));
  assert.equal(result.all.find(n => n.type === 'Overlay')!.props.hostId, 42);
  result.native.props.onRequestClose({});
  assert.deepEqual(result.counts(), { closes: 0, dismisses: 1, nativeDismissed: 0 });
});
test('ordinary native-modal close and dismissal callbacks are forwarded unchanged', () => {
  const result = render(false);
  result.native.props.onRequestClose({});
  result.native.props.onDismiss();
  assert.deepEqual(result.counts(), { closes: 1, dismisses: 0, nativeDismissed: 1 });
});
