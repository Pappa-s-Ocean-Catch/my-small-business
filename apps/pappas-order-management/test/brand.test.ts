import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BRAND_COLORS } from '../utils/brand';

test('uses the Pappas navy for navigation and modal headers', () => {
  assert.equal(BRAND_COLORS.header, '#0F3858');
});

test('uses the brand header on Coupon Management', () => {
  const source = readFileSync('app/(drawer)/coupons.tsx', 'utf8');

  assert.match(source, /import \{ BRAND_COLORS \} from '@\/utils\/brand';/);
  assert.match(source, /<Appbar\.Header style=\{styles\.appbar\}>/);
  assert.match(source, /backgroundColor: BRAND_COLORS\.header/);
});

test('uses the brand navy for Add Customer actions', () => {
  const directorySource = readFileSync('components/customers/CustomerDirectoryList.tsx', 'utf8');
  const modalSource = readFileSync('components/customers/AddCustomerModal.tsx', 'utf8');

  assert.match(directorySource, /buttonColor=\{BRAND_COLORS\.header\}/);
  assert.match(modalSource, /backgroundColor: BRAND_COLORS\.header/);
});

test('uses the brand header on About', () => {
  const source = readFileSync('app/(drawer)/about.tsx', 'utf8');

  assert.match(source, /<Appbar\.Header style=\{styles\.appbar\}>/);
  assert.match(source, /iconColor="#fff"/);
  assert.match(source, /backgroundColor: BRAND_COLORS\.header/);
});
