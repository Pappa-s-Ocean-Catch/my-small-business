import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePosLayout, resolvePosTileAppearance, getPosLayoutColumns, getPosLayoutMenuWidth, updatePosTileAppearance, findPosProductConfig, isPosTileVisible } from '../lib/pos-layout-config';
test('normalization retains legacy labels, colors, virtual groups and additional settings', () => {
  const value = normalizePosLayout({ version: 1, quickOrderNotes: [], quickItemNotes: ['  pack  '], separator: 'line', categories: [{ categoryId: 'virtual', title: 'Packs', color: '#123456', sourceCategoryIds: ['a','b'], hideSourceCategories: true, showProductsOnTopLevel: true, customSetting: 4, products: [{ productId: 'p', color: '#abcdef', showOnQuickList: true, visible: false }] }] });
  assert.deepEqual(value.quickOrderNotes, []);
  assert.deepEqual(value.quickItemNotes, ['pack']);
  assert.deepEqual(value.categories[0].sourceCategoryIds, ['a','b']);
  assert.equal(value.categories[0].title, 'Packs');
  assert.equal(value.categories[0].hideSourceCategories, true);
  assert.equal((value as unknown as {separator: string}).separator, 'line');
  assert.equal(resolvePosTileAppearance(value, value.categories[0]).background, '#123456');
  assert.equal(findPosProductConfig(value, 'p')?.showOnQuickList, true);
  assert.equal(isPosTileVisible(findPosProductConfig(value, 'p')), false);
});
test('global appearance inherits with per tile overrides and safe bounds', () => {
  const layout = normalizePosLayout({ appearance: { background: '#ffffff', text: '#112233', fontSize: 200, height: 0 }, categories: [] });
  const tile = resolvePosTileAppearance(layout, { background: '#ff0000', fontWeight: 600, align: 'right', label: 'Alias' });
  assert.equal(tile.background, '#ff0000'); assert.equal(tile.text, '#112233'); assert.equal(tile.fontSize, 40); assert.equal(tile.height, 64); assert.equal(tile.align, 'right'); assert.equal(tile.label, 'Alias');
});
test('selected and all scope preserve labels visibility order and quick list settings', () => {
  const original = normalizePosLayout({ categories: [{ categoryId: 'g', title: 'Legacy', color: '#123456', products: [{ productId: 'p', label: 'Alias', visible: false, showOnQuickList: true, background: '#112233' }] }] });
  const selected = updatePosTileAppearance(original, { categoryId: 'g', productId: 'p' }, { text: '#ffffff' }, 'selected');
  assert.equal(selected.categories[0].text, undefined);
  const all = updatePosTileAppearance(selected, { categoryId: 'g' }, { background: '#eeeeee' }, 'all');
  assert.equal(resolvePosTileAppearance(all, all.categories[0]).background, '#eeeeee');
  assert.equal(resolvePosTileAppearance(all, all.categories[0].products[0]).background, '#eeeeee');
  assert.equal(all.categories[0].products[0].label, 'Alias'); assert.equal(all.categories[0].products[0].visible, false); assert.equal(all.categories[0].products[0].showOnQuickList, true);
  assert.equal(original.categories[0].color, '#123456');
});
test('responsive columns use device breakpoints with automatic and accessibility sizing', () => {
  const layout = normalizePosLayout({ columnsExpanded: 4, columnsMedium: 3, columnsPhone: 2 });
  assert.equal(getPosLayoutColumns(layout, 1366), 4); assert.equal(getPosLayoutColumns(layout, 1024), 3); assert.equal(getPosLayoutColumns(layout, 390), 2);
  assert.equal(getPosLayoutColumns(undefined, 320), 1); assert.equal(getPosLayoutColumns(undefined, 1024, 2), 3);
});


test('responsive breakpoints stay on the device while automatic density uses the real menu pane', () => {
  const layout = normalizePosLayout({ columnsExpanded: 4, columnsMedium: 3, columnsPhone: 2 });
  assert.equal(getPosLayoutColumns(layout, 1366, 1, 854), 4);
  assert.equal(getPosLayoutColumns(layout, 1024, 1, 588), 3);
  assert.equal(getPosLayoutColumns(layout, 390, 1, 358), 2);
  assert.equal(getPosLayoutColumns(layout, 1366, 2, 854), 4);
  const automatic = normalizePosLayout({ columnsMedium: 'auto' });
  assert.equal(getPosLayoutColumns(automatic, 1024, 1, 588), 3);
  assert.equal(getPosLayoutColumns(automatic, 1366, 1, 854), 4);
  assert.equal(getPosLayoutColumns(automatic, 1366, 1, 358), 2);
  assert.equal(getPosLayoutColumns(automatic, 1024, 2, 588), 1);
});
test('device preview reserves the same navigation rail, gutters and cart as the live POS', () => {
  assert.equal(getPosLayoutMenuWidth(1366), 894);
  assert.equal(getPosLayoutMenuWidth(1024), 636);
  assert.equal(getPosLayoutMenuWidth(390), 366);
  assert.equal(getPosLayoutMenuWidth(768), 380);
  assert.equal(getPosLayoutMenuWidth(1024, 2), 636);
});
