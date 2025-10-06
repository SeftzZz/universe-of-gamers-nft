// src/app/pages/my-nfts/my-nfts.page.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { Auth } from '../../services/auth';
import { Market } from '../../services/market';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';

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
  selector: 'app-my-nfts',
  templateUrl: './my-nfts.page.html',
  styleUrls: ['./my-nfts.page.scss'],
  standalone: false,
})
export class MyNftsPage implements OnInit {
  collections: Collection[] = [];

  nftDB: any[] = [];
  runesDB: any[] = [];
  latestNfts: any[] = [];
  runeMap: Record<string, any[]> = {};
  nftBC: any[] = [];
  nftRuneBC: any[] = [];
  favorites: Set<string> = new Set();

  // === User Info ===
  userName = '';
  userAvatar = 'assets/images/avatar/avatar-small-01.png';
  userAddress: string | null = null;
  userRole: string | null = null;

  // === NFT Related ===
  fetchnft: INftItem[] = [];
  isSell = false;

  // === Top Creators ===
  topCreators: Creator[] = [];
  allUsers: any[] = [];

  // === UI State ===
  isOpen = false;
  selected = '';
  activeTab: 'character' | 'rune' = 'character';
  itemsToShowCharacter = 8;
  itemsToShowRune = 8;
  loadStep = 8;

  history: any[] = [];

  constructor(
    private market: Market,
    private auth: Auth,
    private router: Router,
    private loadingCtrl: LoadingController,
    private http: HttpClient,
  ) {}

  async ngOnInit() {
    await this.refreshAll();
  }

  async ionViewWillEnter() {
    await this.refreshAll();
  }

  private async refreshAll() {
    await this.market.loadNfts();
    await this.market.loadMyNfts();
    await this.market.loadLatestNfts();
    await this.market.loadTopCreators();
    await this.market.loadHistory();
    await this.market.loadUsers();

    // ambil cache dari service
    this.market.getMyNfts().subscribe((myNfts) => {
      this.fetchnft = myNfts || [];
      this.nftBC = this.fetchnft.filter((n) => !!n.character);
      this.nftRuneBC = this.fetchnft.filter((n) => !!n.rune);
    });

    this.market.getLatestNfts().subscribe((data) => (this.latestNfts = data));
    this.market.getTopCreators().subscribe((data) => (this.topCreators = data));
    this.market.getHistory().subscribe((data) => (this.history = data));
    this.market.getUsers().subscribe((data) => (this.allUsers = data));

    this.loadFavorites();
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  formatWithZeroCount(num?: number): string {
    if (num == null) return '-';
    const str = num.toString();

    if (!str.includes('.')) return `${str} SOL`;

    const [intPart, decPart] = str.split('.');
    let zeroCount = 0;
    for (const ch of decPart) {
      if (ch === '0') zeroCount++;
      else break;
    }
    const rest = decPart.slice(zeroCount);

    const subscripts: Record<string, string> = {
      '0': '₀',
      '1': '₁',
      '2': '₂',
      '3': '₃',
      '4': '₄',
      '5': '₅',
      '6': '₆',
      '7': '₇',
      '8': '₈',
      '9': '₉',
    };

    const zeroCountStr = zeroCount
      .toString()
      .split('')
      .map((d) => subscripts[d] || d)
      .join('');

    return `${intPart}.0${zeroCountStr}${rest} SOL`;
  }

  goToNftDetail(mintAddress: string, sell: boolean = false) {
    if (!mintAddress) return;
    this.router.navigate(['/market-layout/nft-detail', mintAddress], {
      queryParams: { sell: sell ? '1' : '0' },
    });
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
      target.sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
      );
      this.selected = 'Recently added';
    } else if (type === 'low') {
      target.sort((a, b) => (a.price || 0) - (b.price || 0));
      this.selected = 'Price: Low to High';
    } else if (type === 'high') {
      target.sort((a, b) => (b.price || 0) - (a.price || 0));
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
  // FAVORITE FEATURE
  // -------------------------------
  toggleFavorite(item: any) {
    const type = item.character ? 'favNft' : item.rune ? 'favRune' : 'other';
    const key = `${type}:${item._id}`;
    if (this.favorites.has(key)) {
      this.favorites.delete(key);
    } else {
      this.favorites.add(key);
    }
    this.saveFavorites();
  }

  isFavorite(item: any): boolean {
    const type = item.character ? 'favNft' : item.rune ? 'favRune' : 'other';
    const key = `${type}:${item._id}`;
    return this.favorites.has(key);
  }

  saveFavorites() {
    localStorage.setItem(
      'favorites',
      JSON.stringify(Array.from(this.favorites)),
    );
  }

  loadFavorites() {
    const stored = localStorage.getItem('favorites');
    if (stored) {
      this.favorites = new Set(JSON.parse(stored));
    } else {
      this.favorites = new Set();
    }
  }

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

  async delistNft(mintAddress: string) {
    try {
      console.log('🔄 Delisting NFT:', mintAddress);

      const resp: any = await this.http
        .post(`${environment.apiUrl}/auth/nft/${mintAddress}/delist`, {})
        .toPromise();

      if (resp.success) {
        await this.refreshAll();
        console.log('✅ NFT delisted:', resp);
      } else {
        console.error('❌ Failed to delist:', resp.error || resp);
        alert('Failed to delist NFT');
      }
    } catch (err) {
      console.error('❌ Error delisting NFT:', err);
      alert('Error delisting NFT');
    }
  }
}
