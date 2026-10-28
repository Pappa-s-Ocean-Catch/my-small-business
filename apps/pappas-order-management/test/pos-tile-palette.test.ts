import test from 'node:test';
import assert from 'node:assert/strict';
import { productTilePalette, PRODUCT_TILE_PALETTE, POS_TILE_COLORS, tileBorderColor, tileTextColor } from '../lib/pos-tile-palette';
import { normalizePosLayout, resolvePosTileAppearance } from '../lib/pos-layout-config';

test('unconfigured products use the stable preset background', () => {
  for (const id of ['chips', 'coke', 'fish', 'burger']) {
    const preset = productTilePalette(id);
    assert.ok(PRODUCT_TILE_PALETTE.includes(preset));
    assert.deepEqual(productTilePalette(id), preset);
    assert.equal(resolvePosTileAppearance(null, undefined, { background: preset.backgroundColor }).background, preset.backgroundColor);
  }
  assert.notEqual(productTilePalette('a').backgroundColor, productTilePalette('b').backgroundColor);
});

test('configured global or product backgrounds win over the preset', () => {
  const fallback = { background: productTilePalette('chips').backgroundColor };
  const layout = normalizePosLayout({ appearance: { background: '#ffffff', text: '#112233' }, categories: [] });
  assert.equal(resolvePosTileAppearance(layout, undefined, fallback).background, '#ffffff');
  assert.equal(resolvePosTileAppearance(layout, { color: '#223344' }, fallback).background, '#223344');
  const tile = resolvePosTileAppearance(layout, { background: '#334455', label: 'Small', visible: false, align: 'right' }, fallback);
  assert.equal(tile.background, '#334455');
  assert.equal(tile.text, '#112233');
  assert.equal(tile.label, 'Small');
  assert.equal(tile.visible, false);
  assert.equal(tile.align, 'right');
});


test('fallback selection covers all 16 layout colours with matching borders', () => {
  assert.equal(POS_TILE_COLORS.length, 16);
  assert.deepEqual(PRODUCT_TILE_PALETTE.map(p => p.backgroundColor), [...POS_TILE_COLORS]);
  assert.equal(new Set(Array.from({ length: 1000 }, (_, i) => productTilePalette(`product-${i}`).backgroundColor)).size, 16);
  assert.equal(new Set(PRODUCT_TILE_PALETTE.map(p => p.borderColor)).size, 16);
  for (const preset of PRODUCT_TILE_PALETTE) {
    assert.equal(preset.borderColor, tileBorderColor(preset.backgroundColor));
    assert.notEqual(preset.borderColor, preset.backgroundColor);
    assert.notEqual(preset.borderColor.toLowerCase(), '#d7cba7');
    assert.equal(resolvePosTileAppearance(null, undefined, { background: preset.backgroundColor }).text, tileTextColor(preset.backgroundColor));
  }
});

test('automatic text follows the effective fill while explicit text wins', () => {
  const fallback = { background: '#1d4ed8' };
  assert.equal(resolvePosTileAppearance(null, undefined, fallback).text, '#FFFFFF');
  const white = normalizePosLayout({ appearance: { background: '#ffffff' }, categories: [] });
  assert.equal(resolvePosTileAppearance(white, undefined, fallback).text, tileTextColor('#ffffff'));
  assert.equal(resolvePosTileAppearance(white, { background: '#1f2937' }, fallback).text, '#FFFFFF');
  assert.equal(resolvePosTileAppearance(white, { background: '#1f2937', text: '#abcdef' }, fallback).text, '#abcdef');
  assert.notEqual(tileBorderColor('#ffffff'), tileBorderColor('#1f2937'));
});


test('every preset has readable automatic text', () => {
  const luminance = (hex: string) => [1, 3, 5].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  for (const background of POS_TILE_COLORS) {
    const values = [luminance(background), luminance(tileTextColor(background))].sort((a, b) => a - b);
    assert.ok((values[1] + 0.05) / (values[0] + 0.05) >= 4.5, background);
  }
});
