import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { MirrorSession } from '../src/lib/mirror-session';

const cart = (updatedAt: string) => ({ version: 1, updatedAt, itemCount: 1,
  items: [{ id: '1', name: 'Fish', quantity: 1, unitPrice: 12, lineTotal: 12 }], subtotal: 12, discount: 0, total: 12 });

function mount(ids: string[], rows: unknown[]) {
  let now = Date.parse('2026-10-31T00:00:00Z');
  let current: any = null;
  let stateIndex = 0;
  let changes: (payload: unknown) => void = () => {};
  let queryIds: string[] = [];
  let pending = false;
  const timers: { callback: () => void; interval: number }[] = [];
  const channel: any = { on: (_type: unknown, _filter: unknown, callback: typeof changes) => { changes = callback; return channel; }, subscribe: () => channel };
  const query = { in: (_field: string, selection: string[]) => { queryIds = selection; return query; }, then: (resolve: (value: unknown) => void) => { if (!pending) resolve({ data: rows, error: null }); } };
  const supabase = { from: () => ({ select: () => query }), channel: () => channel,
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, removeChannel() {} };
  const module = { exports: {} as any };
  const source = ts.transpileModule(readFileSync(resolve('src/hooks/useMirrorState.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: (id: string) => {
    if (id === 'react') return { useState: () => { const index = stateIndex++; return [null, (value: any) => { if (index === 0) current = value; }]; }, useEffect: (effect: () => void) => effect() };
    if (id === 'react-native') return { AppState: { addEventListener: () => ({ remove() {} }) } };
    if (id.endsWith('mirror-settings')) return { ALL_REGISTERS: '*' };
    if (id.endsWith('mirror-session')) return { MirrorSession: class extends MirrorSession { constructor() { super(() => now); } } };
    if (id.endsWith('supabase')) return { supabase };
    throw new Error(id);
  }, setInterval: (callback: () => void, interval: number) => { timers.push({ callback, interval }); }, clearInterval() {}, setTimeout() {} });
  module.exports.useMirrorState(ids);
  return { get snapshot() { return current; }, get queryIds() { return queryIds; },
    async settle() { await new Promise(resolve => setImmediate(resolve)); },
    emit(id: string) { changes({ eventType: 'UPDATE', new: { register_id: id, current_order: cart(new Date(now).toISOString()) } }); },
    expireWhileFetchHangs() { pending = true; timers.find(timer => timer.interval === 10000)!.callback(); now += 300001; timers.find(timer => timer.interval === 1000)!.callback(); },
  };
}

test('filters selected registers for fetch and realtime, ignoring unselected carts', async () => {
  const hook = mount(['a', 'b'], []);
  await hook.settle();
  assert.deepEqual(Array.from(hook.queryIds), ['a', 'b']);
  hook.emit('c'); assert.equal(hook.snapshot, null);
  hook.emit('b'); assert.equal((hook.snapshot as any)?.total, 12);
});

test('an independent timer clears the displayed cart while a refresh hangs', async () => {
  const hook = mount(['a'], [{ register_id: 'a', current_order: cart('2026-10-31T00:00:00Z') }]);
  await hook.settle();
  assert.equal((hook.snapshot as any)?.total, 12);
  hook.expireWhileFetchHangs();
  assert.equal(hook.snapshot, null);
});

test('all-register selection accepts activity from any register', async () => {
  const hook = mount(['*'], []);
  await hook.settle();
  hook.emit('new-register');
  assert.equal((hook.snapshot as any)?.total, 12);
});
