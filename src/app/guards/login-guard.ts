import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Auth } from '../services/auth';

@Injectable({ providedIn: 'root' })
export class LoginGuard implements CanActivate {
  private redirecting = false;

  constructor(private auth: Auth, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    const isLoggedIn = this.auth.isLoggedIn();
    console.log(`🔑 isLoggedIn() → ${isLoggedIn ? 'true' : 'false'} | token = ${isLoggedIn ? 'ada' : 'tidak ada'}`);

    // 🧭 Bypass guard kalau pakai ?forceLogin=true
    const forceLogin = state.url.includes('forceLogin=true');

    if (isLoggedIn && !forceLogin) {
      if (!this.redirecting) {
        this.redirecting = true;

        // 🔍 Ambil data user dari localStorage
        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        const provider = userProfile.authProvider || 'unknown';

        // 🎯 Tentukan halaman redirect berdasarkan provider
        let target = '/market-layout/my-nfts';
        if (provider === 'google') {
          target = '/market-layout/my-nfts';
        } else if (provider === 'wallet') {
          target = '/market-layout/my-nfts';
        }

        console.log(`🔄 LoginGuard → sudah login via ${provider}, redirect ke ${target}`);

        this.router.navigate([target]).then(() => {
          this.redirecting = false;
        });
      }
      return false;
    }

    console.log('🟢 LoginGuard → akses login diizinkan');
    return true;
  }
}
