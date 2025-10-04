// src/app/pages/all-collection/all-collection.page.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';
import { Market } from '../../services/market';   // ✅ pakai Market service
import { LoadingController } from '@ionic/angular';

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
  isSell?: boolean;
  price?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  mintAddress?: string;   // ✅ tambahin ini
  [key: string]: any;
}

interface Creator {
  owner: string;
  count: number;
  avatar: string;
  name?: string;
}

@Component({
  selector: 'app-all-collection',
  templateUrl: './all-collection.page.html',
  styleUrls: ['./all-collection.page.scss'],
  standalone: false,
})
export class AllCollectionPage implements OnInit {
  // === User Info ===
  userName: string = '';
  userAvatar: string = 'assets/images/avatar/avatar-small-01.png';
  userAddress: string | null = null;
  userRole: string | null = null;

  // === NFT Related ===
  nftBC: INftItem[] = [];
  nftRuneBC: INftItem[] = [];
  latestNfts: INftItem[] = [];
  history: any[] = [];
  favorites: Set<string> = new Set();

  // === Top Creators & Users ===
  topCreators: Creator[] = [];
  allUsers: any[] = [];

  // === UI State ===
  isOpen = false;
  selected = '';
  activeTab: 'character' | 'rune' = 'character';
  itemsToShowCharacter = 8;
  itemsToShowRune = 8;
  loadStep = 8;

  constructor(
    private auth: Auth,
    private router: Router,
    private loadingCtrl: LoadingController,
    private market: Market      // ✅ inject Market
  ) {}

  async ngOnInit() {
    await this.refreshData();
    await this.loadFavorites();
  }

  async ionViewWillEnter() {
    await this.refreshData();  // refresh setiap kali halaman aktif kembali
  }

  private async refreshData() {
    // load lewat service
    await this.market.loadNfts();
    await this.market.loadLatestNfts();
    await this.market.loadTopCreators();
    await this.market.loadUsers();
    await this.market.loadHistory();

    // subscribe hasil ke variabel lokal
    this.market.getNfts().subscribe(nfts => {
      this.nftBC = nfts.filter(n => !!n.character);
      this.nftRuneBC = nfts.filter(n => !!n.rune);
    });
    this.market.getLatestNfts().subscribe(latest => (this.latestNfts = latest));
    this.market.getTopCreators().subscribe(creators => (this.topCreators = creators));
    this.market.getUsers().subscribe(users => (this.allUsers = users));
    this.market.getHistory().subscribe(h => (this.history = h));
  }

  // -------------------------------
  // FAVORITE FEATURE
  // -------------------------------
  toggleFavorite(item: INftItem) {
    const type = item.character ? 'favNft' : (item.rune ? 'favRune' : 'other');
    const key = `${type}:${item._id}`;
    if (this.favorites.has(key)) {
      this.favorites.delete(key);
    } else {
      this.favorites.add(key);
    }
    this.saveFavorites();
  }

  isFavorite(item: INftItem): boolean {
    const type = item.character ? 'favNft' : (item.rune ? 'favRune' : 'other');
    const key = `${type}:${item._id}`;
    return this.favorites.has(key);
  }

  saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(Array.from(this.favorites)));
  }

  async loadFavorites() {
    const stored = localStorage.getItem('favorites');
    this.favorites = stored ? new Set(JSON.parse(stored)) : new Set();
  }

  // -------------------------------
  // UI HELPERS
  // -------------------------------
  shorten(addr?: string) {
    if (!addr) return 'Unknown';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  formatWithZeroCount(num?: number): string {
    if (num == null) return '-';   // handle undefined/null
    const str = num.toString();

    if (!str.includes(".")) return `${str} SOL`;

    const [intPart, decPart] = str.split(".");
    let zeroCount = 0;
    for (const ch of decPart) {
      if (ch === "0") zeroCount++;
      else break;
    }
    const rest = decPart.slice(zeroCount);
    const subscripts: Record<string, string> = {
      "0": "₀","1": "₁","2": "₂","3": "₃","4": "₄",
      "5": "₅","6": "₆","7": "₇","8": "₈","9": "₉"
    };
    const zeroCountStr = zeroCount.toString()
      .split("")
      .map((d) => subscripts[d] || d)
      .join("");

    return `${intPart}.0${zeroCountStr}${rest} SOL`;
  }

  goToNftDetail(mintAddress?: string) {
    if (!mintAddress) return;
    this.router.navigate(['/nft-detail', mintAddress]);
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  switchTab(tab: 'character' | 'rune') {
    this.activeTab = tab;
    this.isOpen = false;
  }

  sortData(type: string) {
    let target = this.activeTab === 'character' ? this.nftBC : this.nftRuneBC;
    if (type === 'recent') {
      target.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
      this.selected = 'Recently added';
    } else if (type === 'low') {
      target.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      this.selected = 'Price: Low to High';
    } else if (type === 'high') {
      target.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      this.selected = 'Price: High to Low';
    }
    this.isOpen = false;
  }

  loadMoreCharacter() {
    this.itemsToShowCharacter += this.loadStep;
  }

  loadMoreRune() {
    this.itemsToShowRune += this.loadStep;
  }

  // -------------------------------
  // AUTH
  // -------------------------------
  async showLoading(message: string = 'Loading...') {
    const loading = await this.loadingCtrl.create({
      message,
      spinner: 'crescent',
    });
    await loading.present();
    return loading;
  }

  async logout() {
    const loading = await this.showLoading('Logging out...');
    try {
      await this.auth.logout();
    } catch (err) {
      console.error(err);
    } finally {
      loading.dismiss();
    }
  }
}
