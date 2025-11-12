import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CustodialWallet {
  provider: string;
  address: string;
}

export interface Player {
  rank: string;
  totalEarning: number;
  lastActive: string;
}

export interface Referral {
  code: string;
  totalClaimable: number;
  totalClaimed: number;
  isActive: boolean;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  email: string;
  notifyNewItems: boolean;
  notifyEmail: boolean;
  avatar: string;
  custodialWallets: CustodialWallet[];
  wallets?: CustodialWallet[];         // ✅ tambahkan
  role: string;
  authProvider?: string;                // ✅ tambahkan
  player?: Player;
  referral?: Referral;
}

@Injectable({
  providedIn: 'root'
})
export class User {
  private user$ = new BehaviorSubject<UserProfile>({
    name: '',
    email: '',
    notifyNewItems: false,
    notifyEmail: false,
    avatar: '',
    custodialWallets: [],
    wallets: [],                       // ✅ tambahkan default kosong
    role: '',
    authProvider: '',            // ✅ default unknown
    player: undefined,
    referral: undefined
  });

  private avatar$ = new BehaviorSubject<string>('assets/images/avatar/avatar-07.png');

  setUser(profile: Partial<UserProfile>) {
    const current = this.user$.getValue();
    const updated = { ...current, ...profile };

    // ✅ pastikan field penting tidak hilang
    // if (!updated.authProvider) updated.authProvider = 'unknown';
    if (!updated.wallets) updated.wallets = [];
    if (!updated.custodialWallets) updated.custodialWallets = [];

    this.user$.next(updated);

    // simpan ke localStorage
    localStorage.setItem('userProfile', JSON.stringify(updated));
  }

  getUser(): Observable<UserProfile> {
    return this.user$.asObservable();
  }

  // ✅ load dari localStorage saat init service
  loadFromStorage() {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Tambahkan default untuk field baru
      parsed.authProvider = parsed.authProvider;
      parsed.wallets = parsed.wallets || [];
      parsed.custodialWallets = parsed.custodialWallets || [];
      this.user$.next(parsed);
    }
  }

  setAvatar(url: string) {
    this.avatar$.next(url);
    localStorage.setItem('avatar', url);
  }

  getAvatar(): Observable<string> {
    return this.avatar$.asObservable();
  }
}
