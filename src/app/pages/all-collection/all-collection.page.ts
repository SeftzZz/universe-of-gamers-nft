import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';
import { MarketLayoutPage } from '../market-layout/market-layout.page';

interface Collection {
  id: string;
  name: string;
  image: string;
  creator: string;
  items: number;
}

@Component({
  selector: 'app-all-collection',
  templateUrl: './all-collection.page.html',
  styleUrls: ['./all-collection.page.scss'],
})
export class AllCollectionPage implements OnInit {
  collections: Collection[] = [];

  nft: any[] = []; // daftar NFT dari backend
  runes: any[] = [];   // daftar rune dari backend
  latestNfts: any[] = [];
  runeMap: Record<string, any[]> = {};

  constructor(
    private http: HttpClient,
    private auth: Auth,   //inject Auth service
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadNft();
    await this.loadRunes();
    await this.setLatestNfts();
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  async loadNft() {
    try {
      const data: any = await this.http.get(`${environment.apiUrl}/nft/fetch-nft`).toPromise();
      this.nft = data;
      console.log('📦 NFT List:', this.nft);
    } catch (err) {
      console.error('❌ Error loading NFT:', err);
    }
  }

  async loadRunes() {
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/rune`)
      );
      this.runes = data;
      console.log("Runes:", this.runes);

      this.runeMap = data.reduce((acc: Record<string, any[]>, r: any) => {
        acc[r.rarity] = [...(acc[r.rarity] || []), r];
        return acc;
      }, {} as Record<string, any[]>);
    } catch (err) {
      console.error("❌ Error loading runes:", err);
      this.runes = [];
      this.runeMap = {};
    }
  }

  goToNftDetail(mintAddress: string) {
    if (!mintAddress) return;
    console.log("Navigating to NFT detail:", mintAddress);
    this.router.navigate(['/nft-detail', mintAddress]);
  }

  async setLatestNfts() {
    // gabungkan semua NFT & Rune
    const allNft = [...this.nft, ...this.runes];

    if (allNft.length > 0) {
      // urutkan dari terbaru
      this.latestNfts = allNft
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4); // ambil 4 terbaru
    }
  }

  logout() {
    this.auth.logout();
  }
}
