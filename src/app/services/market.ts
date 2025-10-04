// src/app/services/market.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class Market {
  private nfts$ = new BehaviorSubject<any[]>([]);
  private latestNfts$ = new BehaviorSubject<any[]>([]);
  private topCreators$ = new BehaviorSubject<any[]>([]);
  private history$ = new BehaviorSubject<any[]>([]);
  private users$ = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {}

  // === LOADERS ===
  async loadNfts(): Promise<any[]> {
    try {
      const data: any[] = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/my-nfts`)
      );
      this.nfts$.next(data || []);
      return data || [];
    } catch (err) {
      console.error('Error loadNfts:', err);
      this.nfts$.next([]);
      return []; // ✅ selalu return array
    }
  }

  async loadLatestNfts() {
    try {
      const all = this.nfts$.value.length
        ? this.nfts$.value
        : await this.loadNfts();

      const sorted = (all || []).sort(
        (a, b) =>
          new Date(b?.createdAt ?? 0).getTime() -
          new Date(a?.createdAt ?? 0).getTime()
      );

      this.latestNfts$.next(sorted.slice(0, 4));
    } catch (err) {
      console.error('Error loadLatestNfts:', err);
      this.latestNfts$.next([]);
    }
  }

  async loadTopCreators() {
    try {
      const data: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/nft/top-creators`)
      );
      this.topCreators$.next(data || []);
    } catch (err) {
      console.error('Error loadTopCreators:', err);
      this.topCreators$.next([]);
    }
  }

  async loadHistory() {
    try {
      const data: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/nft/history`)
      );
      this.history$.next(data.history || []);
    } catch (err) {
      console.error('Error loadHistory:', err);
      this.history$.next([]);
    }
  }

  async loadUsers() {
    try {
      const data: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/auth/users/basic`)
      );
      this.users$.next(data || []);
    } catch (err) {
      console.error('Error loadUsers:', err);
      this.users$.next([]);
    }
  }

  // === OBSERVABLES ===
  getNfts() {
    return this.nfts$.asObservable();
  }

  getLatestNfts() {
    return this.latestNfts$.asObservable();
  }

  getTopCreators() {
    return this.topCreators$.asObservable();
  }

  getHistory() {
    return this.history$.asObservable();
  }

  getUsers() {
    return this.users$.asObservable();
  }
}
