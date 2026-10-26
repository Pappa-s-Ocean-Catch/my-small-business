import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';
const now = Date.now();
const yesterday = new Date(now - 86400000).toISOString();
const tomorrow = new Date(now + 86400000).toISOString();
const rows = [
  { id: 'current', is_active: true, starts_at: yesterday, ends_at: tomorrow },
  { id: 'unlimited', is_active: true, starts_at: null, ends_at: null },
  { id: 'expired', is_active: true, starts_at: null, ends_at: yesterday },
  { id: 'scheduled', is_active: true, starts_at: tomorrow, ends_at: null },
  { id: 'disabled', is_active: false, starts_at: null, ends_at: null },
];
const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = (request, parent, isMain) => {
  if (request === './supabase' && String((parent as { filename?: string })?.filename).endsWith('/lib/coupons.js')) {
    return { supabase: { from: () => {
      let result = [...rows];
      const query = {
        select: () => query, order: () => query,
        eq: (column: string, value: unknown) => { result = result.filter(row => row[column as keyof typeof row] === value); return query; },
        lt: (column: string, value: string) => { result = result.filter(row => { const actual = row[column as keyof typeof row]; return typeof actual === 'string' && actual < value; }); return query; },
        or: (filter: string) => { result = result.filter(row => filter.split(',').some(part => {
          const [column, op, ...rest] = part.split('.');
          const actual = row[column as keyof typeof row];
          const value = rest.join('.');
          return op === 'is' ? actual == null : typeof actual === 'string' && (op === 'gte' ? actual >= value : actual <= value);
        })); return query; },
        range: async (from: number, to: number) => ({ data: result.slice(from, to + 1), count: result.length, error: null }),
      }; return query;
    } } };
  }
  return originalLoad(request, parent, isMain);
};
const { getCouponsList } = require('../lib/coupons') as typeof import('../lib/coupons');
test('Active directory excludes expired and future coupons while retaining open date ranges', async () => {
  const result = await getCouponsList({ filter: 'active' });
  assert.equal(result.error, null);
  assert.deepEqual(result.data.map(row => row.id), ['current', 'unlimited']);
  assert.equal(result.totalCount, 2);
});
test('Inactive and Expired remain separate directory filters', async () => {
  assert.deepEqual((await getCouponsList({ filter: 'inactive' })).data.map(row => row.id), ['disabled']);
  assert.deepEqual((await getCouponsList({ filter: 'expired' })).data.map(row => row.id), ['expired']);
});
