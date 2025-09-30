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

  nftDB: any[] = []; // daftar NFT dari DB
  runesDB: any[] = [];   // list rune dari DB
  latestNfts: any[] = [];
  runeMap: Record<string, any[]> = {};
  nftBC: any[] = [];     //  // list NFT dari Block Chain
  nftRuneBC: any[] = [];
  favorites: Set<string> = new Set();

  constructor(
    private http: HttpClient,
    private auth: Auth,   //inject Auth service
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadNftBC();
    await this.loadNftDB();
    await this.loadRunesDB();
    await this.setLatestNfts();
    // restore favorite dari localStorage
    this.loadFavorites();
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  async loadNftBC() {
    try {
      const data: any = await this.http
        .get(`${environment.apiUrl}/nft/fetch-nft`)
        .toPromise();

      // Pisahkan berdasarkan field
      this.nftBC = data.filter((item: INftItem) => !!item.character);
      this.nftRuneBC = data.filter((item: INftItem) => !!item.rune);

      // console.log('NFT List From Block Chain:', this.nftBC);
      // console.log('RUNES List From Block Chain:', this.nftRuneBC);
    } catch (err) {
      console.error('Error loading NFT:', err);
      this.nftBC = [];
      this.nftRuneBC = [];
    }
  }

  async loadNftDB() {
    try {
      const data: any = await this.http.get(`${environment.apiUrl}/nft/fetch-nftDB`).toPromise();
      this.nftDB = data;
      console.log('NFT List From DB:', this.nftDB);
    } catch (err) {
      console.error('Error loading NFT:', err);
    }
  }

  async loadRunesDB() {
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/rune`)
      );
      this.runesDB = data;
      // console.log("RUNES List From DB:", this.runesDB);

      this.runeMap = data.reduce((acc: Record<string, any[]>, r: any) => {
        acc[r.rarity] = [...(acc[r.rarity] || []), r];
        return acc;
      }, {} as Record<string, any[]>);
    } catch (err) {
      console.error("Error loading RUNES:", err);
      this.runesDB = [];
      this.runeMap = {};
    }
  }

  formatWithZeroCount(num: number): string {
      const str = num.toString();

      if (!str.includes(".")) return `$${str}`;

      const [intPart, decPart] = str.split(".");

      // cari jumlah nol berturut-turut setelah "0."
      let zeroCount = 0;
      for (const ch of decPart) {
        if (ch === "0") zeroCount++;
        else break;
      }

      // ambil sisa digit setelah nol
      const rest = decPart.slice(zeroCount);

      // map angka ke subscript unicode
      const subscripts: Record<string, string> = {
        "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
        "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉"
      };

      const zeroCountStr = zeroCount.toString()
        .split("")
        .map((d) => subscripts[d] || d)
        .join("");

      const result = `${intPart}.0${zeroCountStr}${rest} SOL`;

      // console.log(`formatWithZeroCount(${num}) => ${result}`);
      return result;
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
    let target = this.activeTab === 'character' ? this.nftBC : this.nftRuneBC;

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
    const allNft = [...this.nftDB, ...this.runesDB];

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
    // Tentukan tipe favoritnya
    const type = item.character ? 'favNft' : (item.rune ? 'favRune' : 'other');

    // Buat key unik
    const key = `${type}:${item._id}`;

    if (this.favorites.has(key)) {
      this.favorites.delete(key);
    } else {
      this.favorites.add(key);
    }

    this.saveFavorites();
  }

  isFavorite(item: any): boolean {
    const type = item.character ? 'favNft' : (item.rune ? 'favRune' : 'other');
    const key = `${type}:${item._id}`;
    return this.favorites.has(key);
  }

  saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(Array.from(this.favorites)));
  }

  loadFavorites() {
    const stored = localStorage.getItem('favorites');
    if (stored) {
      this.favorites = new Set(JSON.parse(stored));
    } else {
      this.favorites = new Set();
    }
  }
  // -------------------------------

  logout() {
    this.auth.logout();
  }
}
