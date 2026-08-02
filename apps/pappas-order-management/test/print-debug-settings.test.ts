import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('settings preserve a blank register name and disable the diagnostic footer by default', () => {
    const settingsSource = source('lib/settings.ts');

    assert.match(settingsSource, /registerName:\s*string;/);
    assert.match(settingsSource, /printerDebugFooter:\s*boolean;/);
    assert.match(settingsSource, /registerName:\s*''/);
    assert.match(settingsSource, /printerDebugFooter:\s*false/);
});

test('settings screen saves the register name and diagnostic footer preference', () => {
    const screenSource = source('app/(drawer)/(tabs)/settings.tsx');

    assert.match(screenSource, /label="Register name"/);
    assert.match(screenSource, /label}>Print diagnostic footer<\/Text>/);
    assert.match(screenSource, /registerName,/);
    assert.match(screenSource, /printerDebugFooter,/);
});
