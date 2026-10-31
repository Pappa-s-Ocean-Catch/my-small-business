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

test('manual reload during loading schedules one follow-up and publishes its result', async () => {
  const first = deferred<PosCatalogSource>();
  const second = deferred<PosCatalogSource>();
  let calls = 0;
  const coordinator = createPosCatalogCoordinator(async () => ++calls === 1 ? first.promise : second.promise);
  const start = coordinator.refresh('startup');
  const later = coordinator.refresh('manual');
  coordinator.refresh('manual');
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


test('startup requests reuse the catalogue indefinitely until an explicit manual reload', async () => {
  let calls = 0;
  const coordinator = createPosCatalogCoordinator(async () => source(`load-${++calls}`));
  await coordinator.refresh('startup');
  const first = coordinator.getState().snapshot;
  for (let i = 0; i < 100; i++) await coordinator.refresh('startup');
  assert.equal(calls, 1);
  assert.equal(coordinator.getState().snapshot, first);
  await coordinator.refresh('manual');
  assert.equal(calls, 2);
  assert.notEqual(coordinator.getState().snapshot, first);
});
test('failed startup waits for manual retry instead of refetching automatically', async () => {
  let calls = 0;
  const coordinator = createPosCatalogCoordinator(async () => { calls++; throw new Error('Offline'); });
  await coordinator.refresh('startup');
  await coordinator.refresh('startup');
  assert.equal(calls, 1);
  await coordinator.refresh('manual');
  assert.equal(calls, 2);
});
test('applying and saving layout choices update local metadata without reloading catalogue data', async () => {
  let calls = 0;
  const coordinator = createPosCatalogCoordinator(async () => source(`load-${++calls}`));
  await coordinator.refresh('startup');
  const first = coordinator.getState().snapshot!;
  const record = { id: 'local', name: 'Counter', layout: { version: 1 as const, categories: [] }, is_default: true, created_at: '', updated_at: '' };
  coordinator.saveLayoutRecord(record);
  assert.equal(coordinator.getState().snapshot?.preferredLayout, first.preferredLayout);
  coordinator.applyLayout(record);
  assert.equal(coordinator.getState().snapshot?.preferredLayout, record);
  assert.equal(coordinator.getState().snapshot?.products, first.products);
  assert.equal(coordinator.getState().snapshot?.customizations, first.customizations);
  assert.equal(calls, 1);
});


test('legacy background/selection requests cannot bypass the manual-only refresh rule', async () => {
  let calls = 0;
  const coordinator = createPosCatalogCoordinator(async () => source(`load-${++calls}`));
  await coordinator.refresh('startup');
  const refresh = coordinator.refresh as (reason: string) => Promise<void>;
  await refresh('realtime');
  await refresh('selection');
  assert.equal(calls, 1);
});
