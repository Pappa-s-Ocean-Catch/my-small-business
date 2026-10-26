import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BRAND_COLORS } from '../utils/brand';

test('uses the Pappas navy for navigation and modal headers', () => {
  assert.equal(BRAND_COLORS.header, '#122E40');
});

test('uses the shared redesign header on Coupon Management', () => {
  const source = readFileSync('app/(drawer)/coupons.tsx', 'utf8');

  assert.match(source, /<WorkspaceHeader title="Coupons"/);
  assert.match(source, /backgroundColor: t\.color\.surface/);
});

test('uses the shared redesign header on About', () => {
  const source = readFileSync('app/(drawer)/about.tsx', 'utf8');

  assert.match(source, /<WorkspaceHeader title="About this register"/);
});
