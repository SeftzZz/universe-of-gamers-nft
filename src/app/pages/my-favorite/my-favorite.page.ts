// src/app/pages/my-favorite/my-favorite.page.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';
import { Market } from '../../services/market';
import { IonContent } from '@ionic/angular';

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

  @ViewChild(IonContent, { static: false }) ionContent!: IonContent;
  scrollIsActive = false;

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

  onScroll(event: CustomEvent) {
    if (!event) return;

    // ✅ Coba ambil dari detail dulu
    let scrollEl = event.detail?.scrollElement as HTMLElement | null;

    // 🔁 Jika undefined, ambil manual dari ion-content (DOM)
    if (!scrollEl) {
      const ionContent = document.querySelector('ion-content');
      scrollEl = ionContent?.shadowRoot?.querySelector('.inner-scroll') as HTMLElement | null;
    }

    if (!scrollEl) {
      console.warn('⚠️ Tidak bisa menemukan elemen scroll (scrollEl)');
      return;
    }

    const scrollTop = scrollEl.scrollTop || 0;
    const scrollHeight = scrollEl.scrollHeight || 1;
    const clientHeight = scrollEl.clientHeight || 1;

    const denominator = scrollHeight - clientHeight;
    const percent = denominator > 0 ? (scrollTop / denominator) * 100 : 0;

    this.scrollIsActive = percent > 10;

    // 🎯 Update progress ring stroke
    const path = document.querySelector('.progress-circle path') as SVGPathElement;
    if (path) {
      const radius = 49; // dari path: M50,1 a49,49 ...
      const circumference = 2 * Math.PI * radius;
      path.style.strokeDasharray = `${circumference}`;
      const offset = circumference - (percent / 100) * circumference;
      path.style.strokeDashoffset = offset.toString();
    }
  }

  // 🆙 Scroll to top dengan animasi halus
  scrollToTop() {
    this.ionContent.scrollToTop(500); // 500ms animasi smooth scroll
  }
}
