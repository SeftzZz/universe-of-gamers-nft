import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ 
  providedIn: 'root' 
})
export class Wallet {
  // daftar wallets
  private wallets$ = new BehaviorSubject<any[]>(
    JSON.parse(localStorage.getItem('wallets') || '[]')
  );

  // active wallet
  private activeWallet$ = new BehaviorSubject<string | null>(
    localStorage.getItem('walletAddress')
  );

  // === Active Wallet ===
  setActiveWallet(addr: string) {
    localStorage.setItem('walletAddress', addr);
    this.activeWallet$.next(addr);
  }

  getActiveWallet(): Observable<string | null> {
    return this.activeWallet$.asObservable();
  }

  // === Wallets List ===
  setWallets(wallets: any[]) {
    const updated = [...wallets]; // buat array baru
    localStorage.setItem('wallets', JSON.stringify(updated));
    this.wallets$.next(updated);
  }

  getWallets(): Observable<any[]> {
    return this.wallets$.asObservable();
  }

  addWallet(wallet: any) {
    const current = this.wallets$.getValue();
    const updated = [...current, wallet];
    this.setWallets(updated);
  }

  clearWallets() {
    localStorage.removeItem('wallets');
    localStorage.removeItem('walletAddress');
    this.wallets$.next([]);
    this.activeWallet$.next(null);
  }

}
