import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

type Node = { type: string; props: Record<string, any> };
const jsx = (type: string, props: Record<string, any>): Node => ({ type, props });
const nodes = (tree: any): Node[] => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function picker(simulator = true, result = true, withModes = false) {
  const state: any[] = [];
  let index = 0;
  let calls = 0;
  const effects = () => {};
  const jobs = { printJobs: [] };
  const store = Object.assign((fn: any) => fn(jobs), { getState: () => jobs });
  const module = { exports: {} as any };
  const output = ts.transpileModule(readFileSync('components/printer/ManualPrintButton.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', output)((id: string) => {
    if (id === 'react') return { useState: (initial: unknown) => { const i = index++; if (!(i in state)) state[i] = initial; return [state[i], (value: unknown) => { state[i] = value; }]; }, useRef: (initial: unknown) => { const i = index++; return state[i] ??= { current: initial }; }, useEffect: effects, useCallback: (fn: unknown) => fn };
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-native') return { useWindowDimensions: () => ({ width: 1200, height: 900 }), Modal: 'Modal', View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity', Platform: { OS: 'ios' }, StyleSheet: { create: (v: unknown) => v } };
    if (id.endsWith('/modal-layout')) return { getModalLayout: (width: number, height: number) => ({ compact: false, width: width * 0.75, maxHeight: height - 48 }) };
    if (id.includes('safe-area-context')) return { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
    if (id === 'react-native-paper') return { IconButton: 'IconButton', Icon: 'Icon' };
    if (id.endsWith('/AppModal')) return { AppModal: 'Modal' };
    if (id.endsWith('/ActionButton')) return { ActionButton: 'Button' };
    if (id.endsWith('/escpos-printer')) return { isSimulatorPrinter: () => simulator };
    if (id.endsWith('/redesign')) return { designTokens: { color: {} } };
    if (id.endsWith('/manual-print-reconciliation')) return { canRetryManualPrintRequest: () => true };
    if (id.endsWith('/printerAutomationStore')) return { usePrinterAutomationStore: store };
    if (id.endsWith('/useModalFocus')) return { useModalFocus: effects };
    throw new Error(id);
  }, module, module.exports);
  const dispatch = async () => { calls++; return result; };
  const render = () => { index = 0; return nodes(module.exports.ManualPrintButton({ printModes: withModes ? [{ label: 'Kitchen', onSelectPrinter: dispatch }, { label: 'Customer Copy', onSelectPrinter: dispatch }] : undefined, printers: [{ target: simulator ? 'SIMULATOR:test' : 'physical', deviceName: 'Test printer' }], onSelectPrinter: dispatch })); };
  render().find(n => n.type === 'Button')!.props.onPress();
  const printer = () => render().find(n => n.props.accessibilityLabel?.startsWith('Test printer'))!;
  return { render, printer, calls: () => calls };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
test('iOS preview waits for printer picker dismissal and ignores duplicate taps', async () => {
  const p = picker();
  const printer = p.printer();
  printer.props.onPress();
  printer.props.onPress();
  assert.equal(p.calls(), 0, 'Do not present preview while picker is still presented');
  const modal = p.render().find(n => n.type === 'Modal')!;
  assert.equal(modal.props.visible, false);
  modal.props.onDismiss();
  await tick();
  assert.equal(p.calls(), 1);
});
test('physical printer dispatch keeps existing immediate behaviour', async () => {
  const p = picker(false);
  p.printer().props.onPress();
  assert.equal(p.calls(), 1);
  await tick();
});
test('failed preview reopens choices for retry without physical print reconciliation', async () => {
  const p = picker(true, false);
  p.printer().props.onPress();
  p.render().find(n => n.type === 'Modal')!.props.onDismiss();
  await tick();
  assert.equal(p.render().find(n => n.type === 'Modal')!.props.visible, true);
  assert.equal(p.printer().props.disabled, false);
});


test('printer picker Cancel closes without dispatching a print', () => {
  const p = picker(false);
  p.render().find(n => n.props.accessibilityLabel === 'Cancel printing')!.props.onPress();
  assert.equal(p.render().find(n => n.type === 'Modal')!.props.visible, false);
  assert.equal(p.calls(), 0);
});
test('copy type advances on tap and printer tap dispatches without another confirmation', async () => {
  const p = picker(false, true, true);
  p.render().find(n => n.props.accessibilityLabel === 'Kitchen')!.props.onPress();
  assert.equal(p.calls(), 0, 'Staff still choose the destination printer');
  p.printer().props.onPress();
  await tick();
  assert.equal(p.calls(), 1);
  assert.equal(p.render().find(n => n.type === 'Modal')!.props.visible, false);
});
