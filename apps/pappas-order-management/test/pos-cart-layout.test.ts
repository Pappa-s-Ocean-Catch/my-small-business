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
  assert.match(cartPaneSource, /styles\.cartHeaderActions/);
  assert.match(cartPaneSource, /styles\.cartCheckoutActions/);
  assert.doesNotMatch(cartPaneSource, /styles\.quickActionsPanel/);
});

test('uses a compact update indicator instead of a current-order heading', () => {
  assert.doesNotMatch(cartPaneSource, />Current Order</);
  assert.match(cartPaneSource, /styles\.cartUpdateIndicator/);
  assert.match(cartPaneSource, /You are updating order/);
});

test('lets the salt selector fill the compact header row', () => {
  assert.match(cartStylesSource, /cartHeaderActions: \{[^}]*flex: 1/);
  assert.match(cartStylesSource, /cartSaltButton: \{[^}]*flex: 1/);
});

test('visually separates cart controls from the item list', () => {
  assert.match(cartStylesSource, /cartHeader: \{[^}]*borderBottomWidth: 1/);
  assert.match(cartStylesSource, /cartHeader: \{[^}]*borderBottomColor: '#e5e7eb'/);
});

test('groups repeated add-ons before rendering cart metadata', () => {
  assert.match(cartPaneSource, /import \{ groupAddons \} from '..\/..\/utils\/orderUtils';/);
  assert.match(cartPaneSource, /groupAddons\(item\.addons \|\| \[\]\)\.map\(\(addon, addonIndex\)/);
  assert.match(cartPaneSource, /key=\{`\$\{item\.id\}-addon-\$\{addonIndex\}`\}/);
  assert.match(cartPaneSource, /addon\.quantity > 1 \? `\$\{addon\.quantity\}x ` : '\+ '/);
});
