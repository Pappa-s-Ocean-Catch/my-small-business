export type RawTcpNativeMode = 'js-only' | 'native-diagnostic' | 'native-enabled';
export type RawTcpNativePlatform = 'android' | 'ios';
export type RawTcpNativeModeSettings = {
  rawTcpNativeModeAndroid?: unknown;
  rawTcpNativeModeIos?: unknown;
};

export function normalizeRawTcpNativeMode(value: unknown): RawTcpNativeMode {
  return value === 'native-diagnostic' || value === 'native-enabled' ? value : 'js-only';
}

export function getRawTcpNativeMode(settings: RawTcpNativeModeSettings, platform: RawTcpNativePlatform): RawTcpNativeMode {
  return normalizeRawTcpNativeMode(platform === 'android'
    ? settings.rawTcpNativeModeAndroid
    : settings.rawTcpNativeModeIos);
}
