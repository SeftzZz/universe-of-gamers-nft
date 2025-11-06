// src/app/pages/my-nfts/my-nfts.page.ts
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { Auth } from '../../services/auth';
import { Market } from '../../services/market';
import { Wallet } from '../../services/wallet';
import { WebSocket } from '../../services/websocket';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { IonContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

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

  @ViewChild(IonContent, { read: ElementRef }) ionContentRef!: ElementRef;
  scrollIsActive = false;
  isLoading = true;

  mintAddress: string | null = null;

  constructor(
    private market: Market,
    private wallet: Wallet,
    private auth: Auth,
    private router: Router,
    private loadingCtrl: LoadingController,
    private http: HttpClient,
    private ws: WebSocket,
  ) {}

  async ngOnInit() {
    this.wallet.getActiveWallet().subscribe((addr) => {
      this.userAddress = addr;
      this.filterNftsByActiveWallet();
    });

    await this.refreshAll();

    this.ws.messages$.subscribe(async (msg) => {
      if (!msg) return;

      // === 🛒 BUY EVENT ===
      if (msg.type === 'buymint-update') {
        const soldMint = msg.mint;
        console.log('🔥 NFT sold:', msg);

        // ✅ Jika user sedang buka halaman NFT yang sama
        if (this.mintAddress && soldMint === this.mintAddress) {
          alert(`💰 NFT sold!\nTX: ${msg.signature}`);
          this.router.navigate(['/market-layout/my-nfts']);
        }

        await this.refreshAll();
      }

      // === 🔁 RELIST EVENT ===
      if (msg.type === 'relist-update') {
        console.log('🔥 NFT relisted:', msg);
        await this.refreshAll();
      }

      // === ❌ DELIST EVENT ===
      if (msg.type === 'delist-update') {
        const delistedMint = msg.nft?.mintAddress;
        const delistedName = msg.nft?.name || 'NFT';
        console.log('🔥 NFT delisted:', delistedMint);

        if (this.mintAddress && delistedMint === this.mintAddress) {
          alert(`🧨 ${delistedName} telah dihapus dari listing.`);
          this.router.navigate(['/market-layout/all-collection']);
        }

        await this.refreshAll();
      }
    });
  }

  async ionViewWillEnter() {
    await this.refreshAll();
  }

  ionViewDidEnter() {
    this.scrollIsActive = false;

    // Re-inisialisasi progress circle setelah halaman selesai render
    setTimeout(() => {
      const path = this.ionContentRef.nativeElement.querySelector('.progress-circle path') as SVGPathElement | null;
      if (path) {
        const radius = 49;
        const circumference = 2 * Math.PI * radius;
        path.style.strokeDasharray = `${circumference}`;
        path.style.strokeDashoffset = circumference.toString();
      }
    }, 300);
  }

  private async refreshAll() {
    this.isLoading = true; // 🔄 mulai loading

    try {
      // 🔹 Ambil wallet aktif
      this.userAddress = await firstValueFrom(this.wallet.getActiveWallet());

      // 🔹 Load semua data dari service
      await Promise.all([
        this.market.loadMyNfts(),
        this.market.loadLatestNfts(),
        this.market.loadTopCreators(),
        this.market.loadHistory(),
        this.market.loadUsers(),
      ]);

      // 🔹 Ambil hasil cache dari service
      this.market.getMyNfts().subscribe((myNfts) => {
        // Filter NFT minted saja
        this.fetchnft = (myNfts || []).filter((nft: any) => nft.status === 'minted');
        this.filterNftsByActiveWallet();
        this.isLoading = false; // ✅ selesai loading
      });

      this.market.getLatestNfts().subscribe((data) => {
        // hanya tampilkan NFT yang sudah minted
        this.latestNfts = (data || []).filter((nft: any) => nft.status === 'minted');
      });

      this.market.getTopCreators().subscribe((data) => (this.topCreators = data));
      this.market.getHistory().subscribe((data) => (this.history = data));
      this.market.getUsers().subscribe((data) => (this.allUsers = data));

      this.loadFavorites();
    } catch (err) {
      console.error('❌ refreshAll error:', err);
      this.isLoading = false;
    }
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
      "0": "0","1": "0","2": "0","3": "0","4": "₄",
      "5": "₅","6": "₆","7": "₇","8": "₈","9": "₉"
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
        console.error('❌ Failed to delist:', JSON.stringify(resp.error));
        alert('Failed to delist NFT');
      }
    } catch (err) {
      console.error('❌ Error delisting NFT:', JSON.stringify(err));
      alert('Error delisting NFT');
    }
  }

  onScroll(event: CustomEvent) {
    if (!event) return;

    const scrollEl = event.detail?.scrollElement as HTMLElement | null;
    if (!scrollEl) return;

    const scrollTop = scrollEl.scrollTop || 0;
    const scrollHeight = scrollEl.scrollHeight - scrollEl.clientHeight;
    const percent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;

    this.scrollIsActive = percent > 10;

    // ✅ akses aman via ElementRef
    const path = this.ionContentRef.nativeElement.querySelector('.progress-circle path') as SVGPathElement | null;

    if (path) {
      const radius = 49;
      const circumference = 2 * Math.PI * radius;
      path.style.strokeDasharray = `${circumference}`;
      const offset = circumference - (percent / 100) * circumference;
      path.style.strokeDashoffset = offset.toString();
    }
  }

  // 🆙 Scroll to top
  scrollToTop() {
    const ion = this.ionContentRef.nativeElement as any;
    if (ion && ion.scrollToTop) {
      ion.scrollToTop(500);
    }
  }

  private filterNftsByActiveWallet() {
    console.log("🔍 [filterNftsByActiveWallet] Called");
    console.log("   🧩 userAddress:", this.userAddress);
    console.log("   🧮 Total fetched NFT:", this.fetchnft?.length || 0);

    if (!this.userAddress) {
      console.warn("⚠️ No active wallet found. Clearing NFT lists.");
      this.nftBC = [];
      this.nftRuneBC = [];
      return;
    }

    const walletAddr = this.userAddress.toLowerCase();

    // 🔹 Filter Character NFT
    this.nftBC = this.fetchnft.filter(
      (n) => n.character && n.owner?.toLowerCase() === walletAddr
    );

    // 🔹 Filter Rune NFT
    this.nftRuneBC = this.fetchnft.filter(
      (n) => n.rune && n.owner?.toLowerCase() === walletAddr
    );

    console.log("✅ [filterNftsByActiveWallet] Done filtering:");
    console.log("   🎭 Characters:", this.nftBC.length);
    console.log("   🔮 Runes:", this.nftRuneBC.length);

    // (Opsional) log contoh 1 item untuk memastikan struktur benar
    if (this.nftBC.length > 0) {
      console.log("   🔹 Example Character NFT:", this.nftBC[0]);
    }
    if (this.nftRuneBC.length > 0) {
      console.log("   🔹 Example Rune NFT:", this.nftRuneBC[0]);
    }
  }

}
