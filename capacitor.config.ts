import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sednium.kryptonide',
  appName: 'Krypton IDE',
  webDir: 'dist',
  
  android: {
    buildOptions: {
      keystorePath: 'release.keystore',
      keystoreAlias: 'krypton',
      keystorePassword: process.env.KEYSTORE_PASSWORD || '',
      keystoreAliasPassword: process.env.KEYSTORE_PASSWORD || '',
    },
  },

  plugins: {
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0d1117',
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#0d1117',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    GoogleAuth: {
      scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'],
      serverClientId: '228869160750-nqir9tev4919koqbcsrnhfo5puorqtqa.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
  
  server: {
    androidScheme: 'https',
  },
};

export default config;
