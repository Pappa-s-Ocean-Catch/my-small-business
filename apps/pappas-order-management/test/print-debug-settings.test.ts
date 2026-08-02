import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDiagnosticSettings } from '../lib/settings-diagnostics';

test('diagnostic settings default a missing or invalid persisted value safely', () => {
    assert.deepEqual(normalizeDiagnosticSettings(null), {
        registerName: '',
        printerDebugFooter: false,
    });
    assert.deepEqual(normalizeDiagnosticSettings({
        registerName: 42,
        printerDebugFooter: 'enabled',
    }), {
        registerName: '',
        printerDebugFooter: false,
    });
});

test('diagnostic settings trim the register name and preserve an enabled footer', () => {
    assert.deepEqual(normalizeDiagnosticSettings({
        registerName: '  Counter 2  ',
        printerDebugFooter: true,
    }), {
        registerName: 'Counter 2',
        printerDebugFooter: true,
    });
});
