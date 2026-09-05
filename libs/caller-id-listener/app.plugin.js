const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

module.exports = function withCallerIdListener(config) {
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }
    
    const hasInternet = androidManifest['uses-permission'].some(
      (p) => p.$['android:name'] === 'android.permission.INTERNET'
    );
    
    if (!hasInternet) {
      androidManifest['uses-permission'].push({
        $: {
          'android:name': 'android.permission.INTERNET'
        }
      });
    }
    
    return config;
  });

  config = withInfoPlist(config, (config) => {
    if (!config.modResults.NSLocalNetworkUsageDescription) {
      config.modResults.NSLocalNetworkUsageDescription = 'Required to listen for incoming caller ID packets on the local network.';
    }
    return config;
  });

  return config;
};
