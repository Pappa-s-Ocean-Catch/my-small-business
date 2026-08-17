import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('the print queue dispatches text documents without the image transport', () => {
  const queue = source('lib/print-queue.ts');
  assert.match(queue, /escposPrintDocument/);
  assert.match(queue, /startedJob\.document/);
  assert.match(queue, /payload=text/);
});
