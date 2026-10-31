import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function hookRuntime() {
  const slots: any[] = [];
  let index = 0;
  let effects: (() => void)[] = [];
  const memo = (build: () => unknown, deps: unknown[]) => {
    const i = index++;
    if (!slots[i] || deps.some((v, n) => v !== slots[i].deps[n])) slots[i] = { deps, value: build() };
    return slots[i].value;
  };
  const react = { useMemo: memo, useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps), useRef: (initial: unknown) => { const i = index++; return slots[i] ??= { current: initial }; }, useLayoutEffect: (effect: () => void) => { effects.push(effect); } };
  const code = ts.transpileModule(readFileSync('hooks/useProductTilePress.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', code)(() => react, module, module.exports);
  return { hook: module.exports.useProductTilePress, render: (fn: () => any) => { index = 0; effects = []; const result = fn(); effects.forEach(effect => effect()); return result; } };
}
test('stable product handlers use the latest committed cart state and ignore removed products', () => {
  const runtime = hookRuntime();
  const calls: string[] = [];
  const products = [{ id: 'chips' }];
  const first = runtime.render(() => runtime.hook(products, () => calls.push('old cart')));
  const next = runtime.render(() => runtime.hook(products, () => calls.push('new cart')));
  assert.equal(first, next);
  first('chips');
  assert.deepEqual(calls, ['new cart']);
  runtime.render(() => runtime.hook([], () => calls.push('removed')));
  first('chips');
  assert.deepEqual(calls, ['new cart']);
});
test('cart updates change only the affected product tile props, allowing memoized tiles to skip work', () => {
  const runtime = hookRuntime();
  const source = ts.createSourceFile('pane.tsx', readFileSync('components/pos/PosMenuPane.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const grid = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ProductGrid');
  assert.ok(grid);
  const code = ts.transpileModule(grid.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const jsx = (type: string, props: any) => ({ type, props });
  const renderGrid = new Function('require', 'useProductTilePress', 'FlatList', 'styles', 'PosProductTile', 'findPosProductConfig', `const exports = {}; ${code}; return ProductGrid;`)(() => ({ jsx, jsxs: jsx }), runtime.hook, 'FlatList', {}, 'Tile', () => undefined);
  const products = [{ id: 'chips', name: 'Chips' }, { id: 'fish', name: 'Fish' }];
  const base = { data: products, gridColumns: 3, listKey: 'group-products', productTilePalette: () => ({ borderColor: '#112233' }), getGroupName: () => 'Menu', hasAddons: () => true };
  const before = runtime.render(() => renderGrid({ ...base, getQuantity: () => 0, onPressProduct: () => {} }));
  const old = products.map(item => before.props.renderItem({ item }).props);
  const after = runtime.render(() => renderGrid({ ...base, getQuantity: (id: string) => id === 'chips' ? 1 : 0, onPressProduct: () => {} }));
  const next = products.map(item => after.props.renderItem({ item }).props);
  assert.deepEqual(Object.keys(old[0]).filter(key => old[0][key] !== next[0][key]), ['quantity']);
  assert.deepEqual(Object.keys(old[1]).filter(key => old[1][key] !== next[1][key]), []);
});
