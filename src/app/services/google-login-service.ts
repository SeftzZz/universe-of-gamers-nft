import { Injectable } from '@angular/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { environment } from 'src/environments/environment';

interface GoogleUser {
  name?: string;
  email?: string;
  imageUrl?: string;
  authentication?: {
    idToken?: string;
    id_token?: string;
  };
  idToken?: string; // fallback native
}

@Injectable({ providedIn: 'root' })
export class GoogleLoginService {
  private initialized = false;

  constructor() {
    this.init();
  }

  /** 🔹 Inisialisasi GSI / GoogleAuth */
  async init() {
    try {
      const platform = Capacitor.getPlatform();
      console.log(`🧭 [init] Platform = ${platform}`);

      if (platform === 'web' && !this.initialized) {
        console.log('🌐 [init] Checking GSI script...');
        if (!(window as any).google?.accounts?.id) {
          console.log('⬇️ [init] Loading https://accounts.google.com/gsi/client ...');
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => {
              console.log('✅ [init] GSI script loaded successfully');
              resolve();
            };
            script.onerror = () => reject('❌ Failed to load GSI client');
            document.head.appendChild(script);
          });
        } else {
          console.log('✅ [init] GSI script already present');
        }

        console.log('⚙️ [init] Calling GoogleAuth.initialize() ...');
        await GoogleAuth.initialize({
          clientId: '48240276189-d0p6iafr2in7s8lpjmnm5cblh8v1k6s3.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });
        this.initialized = true;
        console.log('✅ [init] GoogleAuth initialized for Web');
      }
      if (Capacitor.getPlatform() === 'android') {
        await GoogleAuth.initialize({
          clientId: '48240276189-d0p6iafr2in7s8lpjmnm5cblh8v1k6s3.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: false,
        });
      }
    } catch (err) {
      console.warn('⚠️ [init] Failed to initialize GoogleAuth:', err);
    }
  }

  /** 🔹 Login flow lengkap dengan tracing */
  async loginWithGoogle(): Promise<any> {
    const platform = Capacitor.getPlatform();
    console.log(`🚀 Starting login on platform: ${platform}`);

    if (platform === 'web') {
      return this.loginWithGSI(); // 👈 pakai Google Identity Services modern
    } else {
      return this.loginWithPlugin(); // 👈 tetap pakai @codetrix-studio/capacitor-google-auth
    }
  }

  private async loginWithGSI(): Promise<any> {
    console.log('🌐 Using Google Identity Services (GSI) flow...');

    // Pastikan script sudah ter-load
    if (!(window as any).google?.accounts?.id) {
      console.log('⬇️ Loading GSI client...');
      await new Promise<void>((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    }

    return new Promise((resolve) => {
      (window as any).google.accounts.id.initialize({
        client_id: '48240276189-d0p6iafr2in7s8lpjmnm5cblh8v1k6s3.apps.googleusercontent.com',
        callback: (response: any) => {
          console.log('✅ GSI login success:', response);
          const token = response.credential;

          // 🧩 Decode JWT payload untuk ambil info user
          const payload = JSON.parse(atob(token.split('.')[1]));

          console.log('🧩 Decoded JWT payload:', payload);

          resolve({
            idToken: token,
            email: payload.email,
            name: payload.name || payload.given_name,
            photo: payload.picture,
            platform: 'web',
          });
        },
      });

      (window as any).google.accounts.id.prompt((notification: any) => {
        console.log('🔔 GSI prompt status:', notification);
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.warn('⚠️ GSI prompt was skipped or not displayed.');
        }
      });
    });
  }

  private async loginWithPlugin(): Promise<any> {
    console.log('📱 Using Capacitor GoogleAuth plugin flow...');
    await this.init();

    const user = (await GoogleAuth.signIn()) as GoogleUser;

    if (!user) return null;

    const idToken =
      user.authentication?.idToken ||
      user.authentication?.id_token ||
      user.idToken;
    console.log('✅ Got idToken:', idToken ? idToken.substring(0, 20) + '...' : 'none');

    return {
      name: user.name,
      email: user.email,
      photo: user.imageUrl,
      idToken,
      platform: Capacitor.getPlatform(),
    };
  }

  /** 🔹 Logout */
  async logout() {
    try {
      await GoogleAuth.signOut();
      console.log('👋 [logout] User logged out from Google');
    } catch (err) {
      console.error('❌ [logout] Google logout failed:', err);
    }
  }
}
