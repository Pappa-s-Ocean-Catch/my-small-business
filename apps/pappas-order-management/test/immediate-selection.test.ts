import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
type Node = { type: string; props: Record<string, any> };
const jsx = (type: string, props: Record<string, any>): Node => ({ type, props });
const nodes = (tree: any): Node[] => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function render(platform = 'android', deferSelectionUntilDismissed = false) {
  const calls: string[] = [];
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync('components/ui/SelectionSheet.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', code)((id: string) => {
    if (id === 'react') return { useState: (v: unknown) => [v, () => {}], useEffect: () => {}, useRef: (v: unknown) => ({ current: v }) };
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-native') return { Platform: { OS: platform }, Pressable: 'Pressable', Text: 'Text', View: 'View' };
    if (id === 'react-native-paper') return { RadioButton: { Android: 'Radio' } };
    if (id.endsWith('ActionButton')) return { ActionButton: 'Button' };
    if (id.endsWith('EditorSheet')) return { EditorSheet: 'Sheet' };
    if (id.endsWith('/redesign')) return { designTokens: { color: {}, radius: {} } };
    throw new Error(id);
  }, module, module.exports);
  const tree = module.exports.SelectionSheet({ deferSelectionUntilDismissed, selection: { title: 'Payment', value: 'cash', options: [{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }, { value: 'smartpay', label: 'SmartPay', disabled: true }], onSelect: (v: string) => calls.push(v) }, onDismiss: () => calls.push('dismiss') });
  return { tree, calls, options: nodes(tree).filter(n => n.type === 'Pressable'), footer: nodes(tree.props.footer) };
}
test('choice tap invokes its action once and dismisses without confirmation', () => {
  const { options, calls, footer } = render();
  options[1].props.onPress();
  options[1].props.onPress();
  assert.deepEqual(calls, ['card', 'dismiss']);
  assert.equal(footer.filter(n => n.type === 'Button').length, 1, 'Only Cancel remains in the footer');
});
test('Cancel dismisses without selecting and disabled choices cannot run', () => {
  const { options, footer, calls } = render();
  assert.equal(options[2].props.disabled, true);
  options[2].props.onPress();
  assert.deepEqual(calls, []);
  footer.find(n => n.type === 'Button')!.props.onPress();
  assert.deepEqual(calls, ['dismiss']);
});

for (const platform of ['ios', 'android', 'web']) {
  test(`payment handoff on ${platform} waits for native dismissal only when required`, () => {
    const { tree, options, calls } = render(platform, true);
    options[0].props.onPress();
    options[0].props.onPress();
    if (platform === 'ios') {
      assert.deepEqual(calls, ['dismiss'], 'Do not present cash tender over the closing payment picker');
      tree.props.onDismissed();
      tree.props.onDismissed();
      assert.deepEqual(calls, ['dismiss', 'cash'], 'The deferred selection runs exactly once');
    } else {
      assert.deepEqual(calls, ['cash', 'dismiss']);
    }
  });
}
