import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegisterId, normalizeRegisterName } from './register.js';

test('uses injected UUID generation for a desktop register ID', () => {
  assert.equal(createRegisterId(() => 'desktop-register-1'), 'desktop-register-1');
});

test('normalizes a desktop register name with a safe fallback', () => {
  assert.equal(normalizeRegisterName('  Front counter  '), 'Front counter');
  assert.equal(normalizeRegisterName('   '), 'Desktop Register');
});
