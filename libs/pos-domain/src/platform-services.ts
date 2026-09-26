export type PlatformResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

export type PosSecureStoreKey = 'supabase-session' | 'register-id' | 'register-name';

export type PosSecureStore = {
  get(key: PosSecureStoreKey): Promise<PlatformResult<string | null>>;
  set(key: PosSecureStoreKey, value: string): Promise<PlatformResult<void>>;
  remove(key: 'supabase-session'): Promise<PlatformResult<void>>;
};

export type PosPrinterService = {
  readonly kind: 'unsupported' | 'raw-tcp';
  print(): Promise<PlatformResult<void>>;
};

export type PosNotificationService = {
  notify(input: { title: string; body: string }): Promise<PlatformResult<void>>;
};

export type PosFileService = {
  exportJson(input: { suggestedName: string; json: string }): Promise<PlatformResult<void>>;
};

export type PosCallerIdService = {
  readonly supported: boolean;
};

export type PosPlatformServices = {
  secureStore: PosSecureStore;
  printer: PosPrinterService;
  notifications: PosNotificationService;
  files: PosFileService;
  callerId: PosCallerIdService;
};

function unsupported<T>(message: string): PlatformResult<T> {
  return { ok: false, code: 'UNSUPPORTED_PLATFORM', message };
}

export function createUnsupportedPlatformServices(): PosPlatformServices {
  return {
    secureStore: {
      get: async () => unsupported('Secure storage is not available on this platform.'),
      set: async () => unsupported('Secure storage is not available on this platform.'),
      remove: async () => unsupported('Secure storage is not available on this platform.'),
    },
    printer: {
      kind: 'unsupported',
      print: async () => unsupported('Printing is not available on this platform.'),
    },
    notifications: {
      notify: async () => unsupported('Notifications are not available on this platform.'),
    },
    files: {
      exportJson: async () => unsupported('File export is not available on this platform.'),
    },
    callerId: { supported: false },
  };
}
