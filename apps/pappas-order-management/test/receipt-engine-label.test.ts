import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('image receipt template labels its rendering engine', () => {
  const template = readFileSync(join(process.cwd(), 'components/ReceiptTemplate.tsx'), 'utf8');
  assert.match(template, /Engine = Image/);
});
