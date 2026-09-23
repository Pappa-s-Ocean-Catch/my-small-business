import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Settings refreshes the POS catalogue in place', () => {
  const source = readFileSync(resolve(
    __dirname,
    '../../../../app/(drawer)/(tabs)/settings.tsx',
  ), 'utf8');

  assert.match(source, /import \{ posCatalog \} from '@\/providers\/PosCatalogProvider';/);
  assert.match(source, /'Refresh POS catalogue\?'/);
  assert.match(source, /posCatalog\.refresh\('manual'\)/);
});
