import assert from 'node:assert/strict';
import test from 'node:test';
import { MirrorSession } from '../src/lib/mirror-session';

const cart = (minute: number, total = 12) => ({
  version: 1 as const, updatedAt: `2026-10-02T00:${String(minute).padStart(2, '0')}:00.000Z`,
  itemCount: 1, items: [{ id: '1', name: 'Fish', quantity: 1, unitPrice: total, lineTotal: total }],
  subtotal: total, discount: 0, total,
});

test('first active register keeps ownership while other registers update or clear', () => {
  const session = new MirrorSession(() => Date.parse('2026-10-02T00:05:00Z'));
  session.apply('a', cart(1));
  session.apply('b', cart(2));
  session.apply('b', {});
  session.apply('c', cart(3));
  assert.equal(session.registerId, 'a');
  assert.equal(session.snapshot?.total, 12);
  session.apply('a', cart(4, 20));
  assert.equal(session.snapshot?.total, 20);
});

test('hands off to the next still-active register using its latest cart', () => {
  const session = new MirrorSession(() => Date.parse('2026-10-02T00:05:00Z'));
  session.apply('a', cart(1));
  session.apply('b', cart(2));
  session.apply('c', cart(3));
  session.apply('b', cart(4, 30));
  session.apply('a', {});
  assert.equal(session.registerId, 'b');
  assert.equal(session.snapshot?.total, 30);
  session.apply('b', {});
  assert.equal(session.registerId, 'c');
  session.apply('c', {});
  assert.equal(session.snapshot, null);
});

test('ignores malformed and older updates without releasing the active session', () => {
  const session = new MirrorSession(() => Date.parse('2026-10-02T00:05:00Z'));
  session.apply('a', cart(3));
  session.apply('a', cart(1, 1));
  session.apply('a', { version: 2 });
  assert.equal(session.snapshot?.total, 12);
  assert.equal(session.registerId, 'a');
});

test('an in-flight fetch cannot clear or overwrite registers updated in realtime', () => {
  const session = new MirrorSession(() => Date.parse('2026-10-02T00:05:00Z'));
  session.apply('a', cart(1));
  const revision = session.revision;
  session.apply('a', cart(2, 20));
  session.apply('b', cart(3));
  session.refresh([{ register_id: 'a', current_order: {} }], revision);
  assert.equal(session.registerId, 'a');
  assert.equal(session.snapshot?.total, 20);
  session.apply('a', {});
  assert.equal(session.registerId, 'b');
});

test('an in-flight fetch cannot resurrect a cleared cart', () => {
  const session = new MirrorSession(() => Date.parse('2026-10-02T00:05:00Z'));
  session.apply('a', cart(1));
  const revision = session.revision;
  session.apply('a', {});
  session.refresh([{ register_id: 'a', current_order: cart(1) }], revision);
  assert.equal(session.snapshot, null);
});

test('refresh preserves ownership and clears missing registers before choosing the next', () => {
  const session = new MirrorSession(() => Date.parse('2026-10-02T00:05:00Z'));
  session.apply('a', cart(1));
  session.apply('b', cart(2));
  session.apply('c', cart(3));
  session.refresh([{ register_id: 'a', current_order: cart(4) }, { register_id: 'c', current_order: cart(3) }], session.revision);
  assert.equal(session.registerId, 'a');
  session.refresh([{ register_id: 'c', current_order: cart(3) }], session.revision);
  assert.equal(session.registerId, 'c');
});

test('initial fetch chooses deterministically by snapshot time then register ID', () => {
  const session = new MirrorSession(() => Date.parse('2026-10-02T00:05:00Z'));
  session.refresh([
    { register_id: 'z', current_order: cart(2) },
    { register_id: 'b', current_order: cart(1) },
    { register_id: 'a', current_order: cart(1) },
  ], session.revision);
  assert.equal(session.registerId, 'a');
});

test('cleared waiting registers lose their position when they start a new cart', () => {
  const session = new MirrorSession(() => Date.parse('2026-10-02T00:05:00Z'));
  session.apply('a', cart(1));
  session.apply('b', cart(2));
  session.apply('c', cart(3));
  session.apply('b', {});
  session.apply('b', cart(4));
  session.apply('a', {});
  assert.equal(session.registerId, 'c');
});

test('a duplicate live update fences an older empty fetch result', () => {
  const session = new MirrorSession(() => Date.parse('2026-10-02T00:05:00Z'));
  session.apply('a', cart(1));
  const revision = session.revision;
  session.apply('a', cart(1));
  session.refresh([{ register_id: 'a', current_order: {} }], revision);
  assert.equal(session.registerId, 'a');
});

test('excludes stale fetched and live carts but accepts fresh updates', () => {
  const session = new MirrorSession(() => Date.parse('2026-10-02T00:07:00Z'));
  session.refresh([{ register_id: 'a', current_order: cart(1) }], 0);
  assert.equal(session.snapshot, null);
  session.apply('b', cart(1));
  assert.equal(session.snapshot, null);
  session.apply('a', cart(3));
  session.apply('a', cart(1));
  assert.equal(session.registerId, 'a');
});

test('expires at more than five minutes and skips stale waiting carts without renewing duplicates', () => {
  let now = Date.parse('2026-10-02T00:05:00Z');
  const session = new MirrorSession(() => now);
  session.apply('a', cart(1));
  session.apply('b', cart(1));
  session.apply('c', cart(4));
  now = Date.parse('2026-10-02T00:06:00Z');
  session.expire();
  assert.equal(session.registerId, 'a');
  session.apply('a', cart(1));
  now += 1;
  session.expire();
  assert.equal(session.registerId, 'c');
  session.apply('c', {});
  session.apply('a', cart(1));
  assert.equal(session.snapshot, null);
});
