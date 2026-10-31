import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { planProductTap } from '../components/pos/pos-draft';
import { productMenuContext, productTapSkipsCustomization } from '../components/pos/pos-navigation';
import type { PosCartItem, SaleProduct, SaleCategory } from '../app/pos.types';
import type { PosLayoutData } from '../lib/pos-layout-config';

const source = ts.createSourceFile('pos.tsx', readFileSync('app/pos.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name: string, env: Record<string, unknown>): (...args: any[]) => any {
  let initializer: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(initializer);
  const code = ts.transpileModule(`const handler = ${initializer.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(env), `${code}; return handler;`)(...Object.values(env));
}
function setup(categoryId: string, directAdd: boolean, initial: PosCartItem[] = []) {
  const product = { id: 'item', name: 'Test item', sale_price: 2, sale_category_id: categoryId } as SaleProduct;
  const categories = [{ id: categoryId, name: categoryId }] as SaleCategory[];
  const posLayout: PosLayoutData = { version: 1, categories: [{ categoryId, showProductsOnTopLevel: directAdd, products: [] }] };
  let cart = initial;
  let level = 'items';
  let loaded: unknown[] = [];
  const noop = () => {};
  const env = {
    preventPendingCartEdit: () => false,
    buildCartItem: () => ({ id: 'new', product_id: 'item', product_name: 'Test item', quantity: 1, base_price: 2, subtotal: 2, addons: [], comment: '', removed_ingredients: [] }),
    cartItemsForTap: { current: cart }, planProductTap, selectedFreeItemId: null,
    setCartItems: (items: PosCartItem[]) => { cart = items; }, setItemFeedback: noop, editingItemId: null, setEditorQuantity: noop,
    cartItemHasCustomizations: (item: PosCartItem) => !!(item.addons?.length || item.comment || item.removed_ingredients?.length),
    productTapSkipsCustomization, productMenuContext, categories, posLayout, selectedParentCatId: null, selectedCatId: categoryId,
    catalog: { customizableIds: new Set(['item']), productsById: new Map([['item', product]]) },
    editorMenuContext: { current: null }, setQuickListVisible: noop, setSearchVisible: noop, setSelectedProduct: noop, setEditingItemId: noop, setEditorNote: noop, setEditorError: noop,
    setMenuLevel: (value: string) => { level = value; }, loadCustomizations: (...args: unknown[]) => { loaded = args; },
    setNoteItemId: noop, setNoteDraft: noop, products: [], searchProducts: [], topSellers: [], setPhoneViewTab: noop,
    setEditorAddonGroups: noop, setEditorRemovableIngredients: noop, setEditorRemovedIngredientIds: noop,
  };
  return { product, tap: handler('quickAddProduct', env), edit: handler('openCartItemEditor', env), cart: () => cart, level: () => level, loaded: () => loaded };
}
for (const category of ['Sides', 'Seafood sides']) {
  test(`${category} tile adds immediately and cart tap still opens available add-ons`, async () => {
    const flow = setup(category, true);
    await flow.tap(flow.product);
    assert.equal(flow.cart().length, 1);
    assert.equal(flow.level(), 'items');
    assert.deepEqual(flow.loaded(), []);
    flow.edit(flow.cart()[0]);
    assert.equal(flow.level(), 'addons');
    assert.equal(flow.loaded()[0], 'item');
  });
}
test('a customized copy does not override a direct-add category preference', async () => {
  const original = { id: 'custom', product_id: 'item', product_name: 'Test item', quantity: 1, base_price: 2, subtotal: 2, addons: [], comment: 'No salt', removed_ingredients: [] } as unknown as PosCartItem;
  const flow = setup('Sides', true, [original]);
  await flow.tap(flow.product);
  assert.equal(flow.level(), 'items');
  assert.equal(flow.cart().length, 2);
  assert.equal(flow.cart()[0], original);
  assert.equal(flow.cart()[1].comment, '');
});
test('ordinary categories still open add-ons after adding the item', async () => {
  const flow = setup('Fish', false);
  await flow.tap(flow.product);
  assert.equal(flow.cart().length, 1);
  assert.equal(flow.level(), 'addons');
  assert.equal(flow.loaded()[0], 'item');
});
