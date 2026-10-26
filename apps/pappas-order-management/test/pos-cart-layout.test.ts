import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const cartPaneSource = readFileSync(
  resolve(process.cwd(), 'components/pos/PosCartPane.tsx'),
  'utf8',
);
const cartStylesSource = readFileSync(
  resolve(process.cwd(), 'components/pos/pos.styles.ts'),
  'utf8',
);

test('keeps cart controls in compact shared rows', () => {
  assert.match(cartPaneSource, /styles\.cartCheckoutActions/);
  assert.doesNotMatch(cartPaneSource, /styles\.quickActionsPanel/);
});

test('shows current-order context and an edited-order update indicator', () => {
  assert.match(cartPaneSource, />Current order</);
  assert.match(cartPaneSource, /styles\.cartUpdateIndicator/);
  assert.match(cartPaneSource, /You are updating order/);
});

test('lets an edited order reopen checkout details before updating', () => {
  assert.match(
    cartPaneSource,
    /\{orderId && \([\s\S]*?onPress=\{openCheckout\}[\s\S]*?Edit Checkout Details[\s\S]*?\)\}/,
  );
  assert.match(cartPaneSource, /\{orderId \? 'Update Order' : 'Checkout'\}/);
});

test('lets the salt selector fill the compact header row', () => {
  assert.match(cartStylesSource, /cartHeaderActions: \{[^}]*flex: 1/);
  assert.match(cartStylesSource, /cartSaltButton: \{[^}]*flex: 1/);
});

test('visually separates cart controls from the item list', () => {
  assert.match(cartStylesSource, /cartHeader: \{[^}]*borderBottomWidth: 1/);
  assert.match(cartStylesSource, /cartHeader: \{[^}]*borderBottomColor: tokens\.color\.border/);
});

test('groups repeated add-ons before rendering cart metadata', () => {
  assert.match(cartPaneSource, /import \{ groupAddons \} from '..\/..\/utils\/orderUtils';/);
  assert.match(cartPaneSource, /groupAddons\(\(item\.addons \|\| \[\]\)\.filter/);
  assert.match(cartPaneSource, /addon\.addon_group_name === group/);
  assert.match(cartPaneSource, /key=\{`\$\{item\.id\}-addon-\$\{addonIndex\}`\}/);
  assert.match(cartPaneSource, /addon\.quantity > 1/);
  assert.match(cartPaneSource, /addon\.group/);
});
