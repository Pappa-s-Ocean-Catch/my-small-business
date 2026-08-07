import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Settings confirms that clearing POS cache keeps the user signed in', () => {
  const source = readFileSync(resolve(
    __dirname,
    '../../../../app/(drawer)/(tabs)/settings.tsx',
  ), 'utf8');

  assert.match(source, /import \{ posCatalogCacheStore \} from '@\/stores\/posCatalogCacheStore';/);
  assert.match(source, /'Clear POS cache\?'/);
  assert.match(source, /posCatalogCacheStore\.getState\(\)\.clear\(\)/);
  assert.match(source, /keeps you signed in/i);
});
