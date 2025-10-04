// src/app/pages/my-favorite/my-favorite.page.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';
import { Market } from '../../services/market';

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

@Component({
  selector: 'app-my-favorite',
  templateUrl: './my-favorite.page.html',
  styleUrls: ['./my-favorite.page.scss'],
  standalone: false,
})
export class MyFavoritePage implements OnInit {
  nftFromDB: INftItem[] = [];
  runesFromDB: any[] = [];
  latestNfts: any[] = [];
  runeMap: Record<string, any[]> = {};
  runes: any[] = [];
  nftCharacter: INftItem[] = [];
  nftRune: INftItem[] = [];
  favorites: Set<string> = new Set();

  // UI state
  isOpen = false;
  selected = '';
  activeTab: 'character' | 'rune' = 'character';
  itemsToShowCharacter = 8;
  itemsToShowRune = 8;
  loadStep = 8;

  constructor(
    private market: Market,
    private auth: Auth,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.loadFavorites();

    // trigger load dari service
    await this.market.loadNfts();
    await this.market.loadLatestNfts();

    // subscribe data global
    this.market.getNfts().subscribe((nfts) => {
      this.nftFromDB = nfts || [];

      // filter hanya NFT favorit (character)
      this.nftCharacter = this.nftFromDB.filter(
        (item) => !!item.character && this.favorites.has(`favNft:${item._id}`),
      );

      // filter hanya NFT favorit (rune)
      this.nftRune = this.nftFromDB.filter(
        (item) => !!item.rune && this.favorites.has(`favRune:${item._id}`),
      );
    });

    this.market.getLatestNfts().subscribe((nfts) => {
      this.latestNfts = nfts || [];
    });
  }

  // ==============================
  // FAVORITES
  // ==============================
  loadFavorites() {
    const stored = localStorage.getItem('favorites');
    if (stored) {
      this.favorites = new Set(JSON.parse(stored));
    }
  }

  // ==============================
  // HELPERS
  // ==============================
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

  goToNftDetail(mintAddress?: string) {
    if (!mintAddress) return;
    this.router.navigate(['/nft-detail', mintAddress]);
  }

  // ==============================
  // UI: Filter, Sort, Tabs
  // ==============================
  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  switchTab(tab: 'character' | 'rune') {
    this.activeTab = tab;
    this.isOpen = false;
  }

  sortData(type: string) {
    let target =
      this.activeTab === 'character' ? this.nftCharacter : this.nftRune;

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

  // ==============================
  // AUTH
  // ==============================
  logout() {
    this.auth.logout();
  }
}
