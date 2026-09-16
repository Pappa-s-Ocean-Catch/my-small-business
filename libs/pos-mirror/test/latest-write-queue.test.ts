import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestWriteQueue } from '../index';

test('coalesces pending values and writes the latest value after the active write', async () => {
  const writes: string[] = [];
  const gates: Array<() => void> = [];
  const queue = createLatestWriteQueue(async (value: string) => {
    writes.push(value);
    await new Promise<void>((resolve) => gates.push(resolve));
  });

  queue.request('first');
  queue.request('second');
  queue.request('latest');
  gates.shift()?.();

  const flushed = queue.flush();
  await new Promise<void>((resolve) => setImmediate(resolve));
  gates.shift()?.();
  await flushed;

  assert.deepEqual(writes, ['first', 'latest']);
});

test('allows only one write in flight', async () => {
  let activeWrites = 0;
  let maximumActiveWrites = 0;
  const gates: Array<() => void> = [];
  const queue = createLatestWriteQueue(async () => {
    activeWrites += 1;
    maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
    await new Promise<void>((resolve) => gates.push(resolve));
    activeWrites -= 1;
  });

  queue.request('first');
  queue.request('latest');
  gates.shift()?.();

  const flushed = queue.flush();
  await new Promise<void>((resolve) => setImmediate(resolve));
  gates.shift()?.();
  await flushed;

  assert.equal(maximumActiveWrites, 1);
});

test('accepts a future request after a rejected write', async () => {
  const writes: string[] = [];
  const queue = createLatestWriteQueue(async (value: string) => {
    writes.push(value);
    if (value === 'fails') {
      throw new Error('write failed');
    }
  });

  queue.request('fails');
  await assert.rejects(queue.flush(), /write failed/);

  queue.request('recovers');
  await queue.flush();

  assert.deepEqual(writes, ['fails', 'recovers']);
});
