import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sednium.krypton',
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
  },
  
  server: {
    androidScheme: 'https',
  },
};

export default config;
