import { requireNativeModule } from 'expo-modules-core';

export type NativeAppMemory = {
  getCurrentMemoryAsync(): Promise<{
    totalBytes: number;
    appFootprintBytes: number;
    availableBytes: number | null;
  }>;
};

export function getNativeAppMemory(): NativeAppMemory | null {
  try {
    return requireNativeModule<NativeAppMemory>('AppMemory');
  } catch {
    return null;
  }
}
