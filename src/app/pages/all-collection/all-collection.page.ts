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

interface INftItem {
  _id: string;
  name: string;
  description: string;
  image: string;
  owner: string;
  character?: string;
  rune?: string;
  [key: string]: any;
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
  nftCharacter: any[] = [];
  nftRune: any[] = [];
  favorites: Set<string> = new Set();

  constructor(
    private http: HttpClient,
    private auth: Auth,   //inject Auth service
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadNft();
    await this.loadRunes();
    await this.setLatestNfts();
    // restore favorite dari localStorage
    this.loadFavorites();
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  async loadNft() {
    try {
      const data: any = await this.http
        .get(`${environment.apiUrl}/nft/fetch-nft`)
        .toPromise();

      // Pisahkan berdasarkan field
      this.nftCharacter = data.filter((item: INftItem) => !!item.character);
      this.nftRune = data.filter((item: INftItem) => !!item.rune);

      console.log('NFT Character:', this.nftCharacter);
      console.log('NFT Rune:', this.nftRune);
    } catch (err) {
      console.error('Error loading NFT:', err);
      this.nftCharacter = [];
      this.nftRune = [];
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

  isOpen = false;
  selected = '';
  activeTab: 'character' | 'rune' = 'character';

  // pagination more item
  itemsToShowCharacter = 8;
  itemsToShowRune = 8;
  loadStep = 8;

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  switchTab(tab: 'character' | 'rune') {
    this.activeTab = tab;
    this.isOpen = false; // tutup dropdown saat ganti tab
  }

  sortData(type: string) {
    let target = this.activeTab === 'character' ? this.nftCharacter : this.nftRune;

    if (type === 'recent') {
      target.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.selected = 'Recently added';
    } else if (type === 'low') {
      target.sort((a, b) => a.price - b.price);
      this.selected = 'Price: Low to High';
    } else if (type === 'high') {
      target.sort((a, b) => b.price - a.price);
      this.selected = 'Price: High to Low';
    }

    this.isOpen = false; // otomatis tutup dropdown setelah pilih
  }

  loadMoreCharacter() {
    this.itemsToShowCharacter += this.loadStep;
  }

  loadMoreRune() {
    this.itemsToShowRune += this.loadStep;
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

  // -------------------------------
  // FAVORITE FEATURE
  // -------------------------------
  toggleFavorite(item: any) {
    if (this.favorites.has(item._id)) {
      this.favorites.delete(item._id);
    } else {
      this.favorites.add(item._id);
    }
    this.saveFavorites();
  }

  isFavorite(item: any): boolean {
    return this.favorites.has(item._id);
  }

  saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(Array.from(this.favorites)));
  }

  loadFavorites() {
    const stored = localStorage.getItem('favorites');
    if (stored) {
      this.favorites = new Set(JSON.parse(stored));
    }
  }
  // -------------------------------

  logout() {
    this.auth.logout();
  }
}
