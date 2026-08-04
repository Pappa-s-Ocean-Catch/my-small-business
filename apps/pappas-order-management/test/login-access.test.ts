import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const loginSource = readFileSync(join(process.cwd(), 'app/login.tsx'), 'utf8');

test('permits staff and admin users through the same access check as the app shell', () => {
  assert.match(loginSource, /import \{ canAccessOrderManagement \} from '@\/lib\/auth';/);
  assert.match(loginSource, /canAccess = await canAccessOrderManagement\(userId\);/);
  assert.doesNotMatch(loginSource, /isAdminUser/);
  assert.doesNotMatch(loginSource, /currently restricted to admin users/);
});
