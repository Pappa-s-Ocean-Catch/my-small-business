// Expo CLI automatically loads .env files with EXPO_PUBLIC_ prefix
// No need for dotenv - see: https://docs.expo.dev/guides/environment-variables/
module.exports = {
  expo: {
    name: 'Pappas Order Management',
    slug: 'pappas-order-management',
    version: '1.0.0',
    // Respect device orientation (use OS rotation / orientation lock)
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.pappas.orderManagement',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.pappas.ordermanagement',
      supportsTablet: true,
      // Helps avoid TextInput focus "jumping" due to keyboard resize behavior on Android
      softwareKeyboardLayoutMode: 'resize',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-av',
        {
          microphonePermission: false,
        },
      ],
    ],
    scheme: 'pappas-order',
  },
};
