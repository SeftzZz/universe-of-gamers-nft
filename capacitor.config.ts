import type { CapacitorConfig } from '@capacitor/cli';

const isLiveReload = process.env.LIVE_RELOAD === 'true';

const config: CapacitorConfig = {
  appId: 'com.universeofgamers.nft',
  appName: 'UOG Marketplace',
  webDir: 'www',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      androidClientId: '48240276189-d0p6iafr2in7s8lpjmnm5cblh8v1k6s3.apps.googleusercontent.com'
    }
  },
  ...(isLiveReload
    ? {
        server: {
          url: "http://192.168.18.30:8100",
          cleartext: true
        }
      }
    : {})
};

export default config;

