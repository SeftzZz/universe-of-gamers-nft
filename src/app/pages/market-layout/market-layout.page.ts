import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';
import { Market } from '../../services/market';   // ✅ pakai service global
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
  selector: 'app-market-layout',
  templateUrl: './market-layout.page.html',
  styleUrls: ['./market-layout.page.scss'],
  standalone: false,
})
export class MarketLayoutPage implements OnInit {
  // === User Info ===
  userName: string = '';
  userAvatar: string = 'assets/images/avatar/avatar-small-01.png';
  userAddress: string | null = null;
  role: string | null = null;

  // === Data dari service ===
  fetchnft: INftItem[] = [];
  latestNfts: INftItem[] = [];
  topCreators: Creator[] = [];
  allUsers: any[] = [];
  history: any[] = [];

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
    private market: Market    // ✅ inject Market service
  ) {}

  async ngOnInit() {
    // load data sekali
    await this.market.loadNfts();
    await this.market.loadLatestNfts();
    await this.market.loadTopCreators();
    await this.market.loadUsers();
    await this.market.loadHistory();
    this.restoreUser();

    // subscribe data ke variabel lokal
    this.market.getNfts().subscribe(d => (this.fetchnft = d));
    this.market.getLatestNfts().subscribe(d => (this.latestNfts = d));
    this.market.getTopCreators().subscribe(d => (this.topCreators = d));
    this.market.getUsers().subscribe(d => (this.allUsers = d));
    this.market.getHistory().subscribe(d => (this.history = d));

    // load data sekali
    await this.refreshData();

    // subscribe data ke variabel lokal
    this.subscribeMarket();
  }

  async ionViewWillEnter() {
    this.restoreUser();
    await this.refreshData(); // refresh tiap kali masuk halaman
  }

  private restoreUser() {
    const storedUser = localStorage.getItem('userProfile');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.userName = user.name;
      this.userAvatar = user.avatar || 'assets/images/avatar/avatar-small-01.png';
      this.role = user.role || null;
    }
    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      this.userAddress = saved;
    }
  }

  private subscribeMarket() {
    this.market.getNfts().subscribe(d => (this.fetchnft = d));
    this.market.getLatestNfts().subscribe(d => (this.latestNfts = d));
    this.market.getTopCreators().subscribe(d => (this.topCreators = d));
    this.market.getUsers().subscribe(d => (this.allUsers = d));
    this.market.getHistory().subscribe(d => (this.history = d));
  }

  private async refreshData() {
    await this.market.loadNfts();
    await this.market.loadLatestNfts();
    await this.market.loadTopCreators();
    await this.market.loadUsers();
    await this.market.loadHistory();
  }

  // === Helpers ===
  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  formatWithZeroCount(num: number): string {
    const str = num.toString();
    if (!str.includes('.')) return `$${str}`;
    const [intPart, decPart] = str.split('.');
    let zeroCount = 0;
    for (const ch of decPart) {
      if (ch === '0') zeroCount++;
      else break;
    }
    const rest = decPart.slice(zeroCount);
    const subscripts: Record<string, string> = {
      '0': '₀','1': '₁','2': '₂','3': '₃','4': '₄',
      '5': '₅','6': '₆','7': '₇','8': '₈','9': '₉'
    };
    const zeroCountStr = zeroCount
      .toString()
      .split('')
      .map((d) => subscripts[d] || d)
      .join('');
    return `${intPart}.0${zeroCountStr}${rest} SOL`;
  }

  goToNftDetail(mintAddress?: string, sell: boolean = false) {
    if (!mintAddress) return;  // guard
    this.router.navigate(['/nft-detail', mintAddress], {
      queryParams: { sell: sell ? '1' : '0' },
    });
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
}
