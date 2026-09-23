import assert from 'node:assert/strict';
import test from 'node:test';
import { createPosCatalogCoordinator } from '../lib/pos-catalog-coordinator';
import type { PosCatalogSource } from '../lib/pos-catalog-snapshot';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const source = (name: string): PosCatalogSource => ({
  categories: [], products: [{ id: name, name, description: null, search_term: null, sale_price: 1, image_url: null, sale_category_id: null, sub_category_id: null, sort_order: null, is_active: true }],
  addonLinks: [], ingredients: [], promotions: [], layouts: [], selectedLayoutId: null,
});

test('invalidation during loading schedules one follow-up and publishes its result', async () => {
  const first = deferred<PosCatalogSource>();
  const second = deferred<PosCatalogSource>();
  let calls = 0;
  const coordinator = createPosCatalogCoordinator(async () => ++calls === 1 ? first.promise : second.promise);
  const start = coordinator.refresh('startup');
  const later = coordinator.refresh('realtime');
  coordinator.refresh('realtime');
  first.resolve(source('old'));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  second.resolve(source('new'));
  await Promise.all([start, later]);
  assert.equal(coordinator.getState().snapshot?.products[0].name, 'new');
  assert.equal(calls, 2);
});

test('a refresh error retains a complete previous catalogue', async () => {
  let calls = 0;
  const coordinator = createPosCatalogCoordinator(async () => {
    if (++calls === 1) return source('current');
    throw new Error('offline');
  });
  await coordinator.refresh('startup');
  await coordinator.refresh('manual');
  assert.equal(coordinator.getState().snapshot?.products[0].name, 'current');
  assert.equal(coordinator.getState().status, 'ready');
  assert.match(coordinator.getState().error ?? '', /offline/);
});

test('logout discards an in-flight response', async () => {
  const pending = deferred<PosCatalogSource>();
  const coordinator = createPosCatalogCoordinator(async () => pending.promise);
  const load = coordinator.refresh('startup');
  coordinator.reset();
  pending.resolve(source('private'));
  await load;
  assert.equal(coordinator.getState().snapshot, null);
});
