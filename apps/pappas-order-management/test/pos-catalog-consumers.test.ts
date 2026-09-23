import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('normal POS menu and marketplace matching have no on-demand catalogue query', () => {
  const pos = readFileSync(resolve(process.cwd(), 'app/pos.tsx'), 'utf8');
  const marketplace = readFileSync(resolve(process.cwd(), 'lib/marketplace-pos-order.ts'), 'utf8');
  assert.doesNotMatch(pos, /\.from\('(sale_categories|sale_products|sale_product_addon_groups|sale_product_ingredients|promotions|pos_layouts)'\)/);
  const defaults = marketplace.slice(marketplace.indexOf('const defaultDependencies:'));
  assert.doesNotMatch(defaults, /\.from\('(sale_categories|sale_products|sale_product_addon_groups|sale_product_ingredients)'\)/);
  assert.match(pos, /Retry catalogue load/);
  assert.match(pos, /Refresh POS catalogue/);
});
