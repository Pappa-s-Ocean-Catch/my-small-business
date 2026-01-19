const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function addUsesPermission(androidManifest, name, extras = {}) {
  const manifest = androidManifest.manifest;
  manifest['uses-permission'] = ensureArray(manifest['uses-permission']);

  const existing = manifest['uses-permission'].find((p) => p?.$?.['android:name'] === name);
  if (existing) {
    existing.$ = { ...(existing.$ || {}), ...extras, 'android:name': name };
    return;
  }

  manifest['uses-permission'].push({
    $: {
      'android:name': name,
      ...extras,
    },
  });
}

function withEscPosPrinterPermissions(config) {
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // Storage (legacy). Keep maxSdkVersion where applicable.
    addUsesPermission(androidManifest, 'android.permission.READ_EXTERNAL_STORAGE');
    addUsesPermission(androidManifest, 'android.permission.WRITE_EXTERNAL_STORAGE', {
      'android:maxSdkVersion': '28',
    });

    // Wi-Fi / LAN printing
    addUsesPermission(androidManifest, 'android.permission.INTERNET');

    // Bluetooth (varies by API level). We add a superset and constrain where possible.
    addUsesPermission(androidManifest, 'android.permission.BLUETOOTH', {
      'android:maxSdkVersion': '30',
    });
    addUsesPermission(androidManifest, 'android.permission.BLUETOOTH_ADMIN', {
      'android:maxSdkVersion': '30',
    });

    // Location needed for BT scan on older Android versions.
    addUsesPermission(androidManifest, 'android.permission.ACCESS_COARSE_LOCATION', {
      'android:maxSdkVersion': '28',
    });
    addUsesPermission(androidManifest, 'android.permission.ACCESS_FINE_LOCATION', {
      'android:maxSdkVersion': '30',
    });

    // Android 12+ (API 31+) Bluetooth permissions.
    addUsesPermission(androidManifest, 'android.permission.BLUETOOTH_SCAN', {
      'android:usesPermissionFlags': 'neverForLocation',
    });
    addUsesPermission(androidManifest, 'android.permission.BLUETOOTH_CONNECT');

    return config;
  });

  config = withInfoPlist(config, (config) => {
    config.modResults.NSBluetoothAlwaysUsageDescription =
      config.modResults.NSBluetoothAlwaysUsageDescription ||
      'Allow $(PRODUCT_NAME) to access bluetooth. Required to print the receipt';

    config.modResults.NSBluetoothPeripheralUsageDescription =
      config.modResults.NSBluetoothPeripheralUsageDescription ||
      'Allow $(PRODUCT_NAME) to access bluetooth. Required to print the receipt';

    config.modResults.NSLocalNetworkUsageDescription =
      config.modResults.NSLocalNetworkUsageDescription ||
      'Allow $(PRODUCT_NAME) to access local network. Required to print the receipt';

    config.modResults.NSLocationWhenInUseUsageDescription =
      config.modResults.NSLocationWhenInUseUsageDescription ||
      'Allow $(PRODUCT_NAME) to access local network. Required to print the receipt';

    config.modResults.UISupportedExternalAccessoryProtocols =
      config.modResults.UISupportedExternalAccessoryProtocols || ['com.epson.escpos'];

    return config;
  });

  return config;
}

module.exports = withEscPosPrinterPermissions;
