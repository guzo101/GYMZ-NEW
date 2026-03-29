// Use relative paths so Expo Go and dev client can resolve and display the icon.
// Absolute paths (path.resolve) can cause a blank icon in Expo Go.
const splashLogoPath = './assets/gymzLogo.png';
const appIconPath = './assets/gymzLogoIcon.png';

module.exports = {
  expo: {
    name: 'Gymz',
    slug: 'gym-member-app',
    scheme: 'gymz',
    version: '1.0.0',
    orientation: 'portrait',
    icon: appIconPath,
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    jsEngine: 'jsc',
    splash: {
      image: splashLogoPath,
      backgroundColor: '#0A120A',
      resizeMode: 'contain',
      dark: {
        image: splashLogoPath,
        backgroundColor: '#060D06',
      },
    },
    ios: {
      jsEngine: 'hermes',
      supportsTablet: true,
      bundleIdentifier: 'com.gym.memberapp',
      associatedDomains: ['applinks:gymz.app'],
      infoPlist: {
        NSMotionUsageDescription:
          'Gymz uses motion and fitness data to count your steps and show your daily activity.',
      },
    },
    android: {
      jsEngine: 'hermes',
      package: 'com.gym.memberapp',
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: {
        foregroundImage: appIconPath,
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        'CAMERA',
        'NOTIFICATIONS',
        'android.permission.CAMERA',
        'android.permission.ACTIVITY_RECOGNITION',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.READ_CALENDAR',
        'android.permission.WRITE_CALENDAR',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'gymz.app',
              pathPrefix: '/auth/callback',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      favicon: './assets/favicon.png',
      jsEngine: 'jsc',
    },
    plugins: [
      [
        'expo-splash-screen',
        {
          image: splashLogoPath,
          backgroundColor: '#0A120A',
          resizeMode: 'contain',
          dark: {
            image: splashLogoPath,
            backgroundColor: '#060D06',
          },
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: '35.0.0',
          },
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow $(PRODUCT_NAME) to access your camera to scan QR codes for check-in and food barcodes for nutrition logging.',
          barcodeScannerEnabled: true,
          recordAudioAndroid: false,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow $(PRODUCT_NAME) to access your photos for profile pictures and community posts.',
          cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera to take photos.',
          microphonePermission: false,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification_icon.png',
          color: '#ffffff',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'd2226084-a971-416d-978a-d34d1274bf70',
      },
    },
    owner: 'disonedis01123',
  },
};
