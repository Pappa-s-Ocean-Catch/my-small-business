import assert from 'node:assert/strict';
import test from 'node:test';

test('reserves the first three sellers for the feature column and keeps the remaining ranked products', async () => {
  const modulePath = './top-sellers-presentation.js';
  const { splitTopSellers } = await import(modulePath) as {
    splitTopSellers: <T>(products: T[]) => { featured: T[]; remaining: T[] };
  };

  const result = splitTopSellers(['first', 'second', 'third']);

  assert.deepEqual(result, { featured: ['first', 'second', 'third'], remaining: [] });
});
