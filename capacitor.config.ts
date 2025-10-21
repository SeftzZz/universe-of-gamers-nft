import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.universeofgamers.nft',
  appName: 'UOG Marketplace',
  webDir: 'www',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      androidClientId: '48240276189-d0p6iafr2in7s8lpjmnm5cblh8v1k6s3.apps.googleusercontent.com',
      forceCodeForRefreshToken: false
    }
  }
};

export default config;
