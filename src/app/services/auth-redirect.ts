import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthRedirect {
  private readonly key = 'nextRoute';

  constructor(private router: Router) {}

  // Simpan tujuan sebelum login
  setNextRoute(route: string) {
    localStorage.setItem(this.key, route);
  }

  // Ambil tujuan setelah login
  getNextRoute(): string | null {
    return localStorage.getItem(this.key);
  }

  // Hapus setelah dipakai
  clearNextRoute() {
    localStorage.removeItem(this.key);
  }

  // Shortcut: langsung arahkan ke tujuan setelah login
  redirectAfterLogin(defaultRoute: string = '/market-layout') {
    const next = this.getNextRoute();
    if (next) {
      this.router.navigate([next]);
      this.clearNextRoute();
    } else {
      this.router.navigate([defaultRoute]);
    }
  }
}
