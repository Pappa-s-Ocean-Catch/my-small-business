import test from 'node:test';
import assert from 'node:assert/strict';
import { getNativeRawTcpPrinter } from '../lib/raw-tcp-native';
import { getRawTcpNativeMode, normalizeRawTcpNativeMode, shouldUseRawTcpRawCapture } from '../lib/raw-tcp-native-settings';

test('native printer lookup is unavailable-safe when no native module is installed', () => {
  const printer = getNativeRawTcpPrinter(() => {
    throw new Error('NativeRawTcpPrinter is missing');
  });

  assert.equal(printer, null);
});

test('legacy and invalid rollout values remain JS-only', () => {
  assert.equal(normalizeRawTcpNativeMode(undefined), 'js-only');
  assert.equal(normalizeRawTcpNativeMode('native-now'), 'js-only');
});

test('rollout mode is selected independently for Android and iOS', () => {
  const modes = { rawTcpNativeModeAndroid: 'native-diagnostic' as const, rawTcpNativeModeIos: 'native-enabled' as const };
  assert.equal(getRawTcpNativeMode(modes, 'android'), 'native-diagnostic');
  assert.equal(getRawTcpNativeMode(modes, 'ios'), 'native-enabled');
});

test('standard-quality raw TCP capture avoids Android raw pixels', () => {
  assert.equal(shouldUseRawTcpRawCapture(false), false);
  assert.equal(shouldUseRawTcpRawCapture(true), true);
});
