// src/app/pages/my-nfts/my-nfts.page.ts
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { Auth } from '../../services/auth';
import { Market } from '../../services/market';
import { Wallet } from '../../services/wallet';
import { WebSocket } from '../../services/websocket';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { IonContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { User, UserProfile } from '../../services/user';

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

  showReferralModal = false;
  referralCode: string = '';
  isClosingReferral = false;
  isLocalReferral = false
  isGoogleReferral = false;
  isWalletReferral = false;
  private referralResolver: ((value: 'skip' | 'apply' | null) => void) | null = null;
  profile!: UserProfile;

  authToken: string | null = null;

  email: string = '';
  password: string = '';
  showPassword: boolean = false;
  isSaving = false;

  balance: number | null = null;

  prizePool: any = null;

  constructor(
    private market: Market,
    private wallet: Wallet,
    private auth: Auth,
    private router: Router,
    private loadingCtrl: LoadingController,
    private http: HttpClient,
    private ws: WebSocket,
    private userService: User,
    private toastCtrl: ToastController,
  ) {}

  async ngOnInit() {
    // sinkronisasi user
    this.userService.getUser();
    this.userService.loadFromStorage();

    // kasih jeda kecil untuk pastikan localStorage sudah diupdate
    await new Promise((r) => setTimeout(r, 300));

    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    // console.log('👤 [Profile Check Ready]:', userProfile);

    const provider = userProfile.authProvider || 'unknown';
    const hasWallet =
      (userProfile.wallets && userProfile.wallets.length > 0) ||
      (userProfile.custodialWallets && userProfile.custodialWallets.length > 0);
    const hasEmail = !!(userProfile.email && userProfile.email.trim() !== '');
    const hasReferral = !!(userProfile.referral && userProfile.referral.code);
    const usedReferralCode = !!userProfile.usedReferralCode;

    // console.log('🔎 [Profile Flags]', {
    //   provider, hasWallet, hasEmail, hasReferral, usedReferralCode
    // });

    // tampilkan modal jika incomplete
    if (
      (provider === 'wallet' && !hasEmail) ||
      (provider === 'google' && !hasWallet) ||
      (provider === 'local' && (usedReferralCode || hasReferral) && !hasWallet) ||
      (!hasEmail || !hasReferral)
    ) {
      // console.warn('⚠️ Showing setup/referral modal for provider:', provider);
      const mode =
        provider === 'google' ? 'google' :
        provider === 'wallet' ? 'wallet' :
        provider === 'local' ? 'local' :
        undefined;

      if (mode) {
        // pakai timeout biar Angular sempat render halaman dulu sebelum munculkan modal
        setTimeout(() => this.openReferralModal(mode), 400);
      }
      return;
    }

    // ✅ Profil lengkap, lanjut
    // console.log('✅ Profil user valid:', {
    //   provider,
    //   email: userProfile.email,
    //   referral: userProfile.referral?.code,
    // });

    this.wallet.getActiveWallet().subscribe((addr) => {
      this.userAddress = addr;
      this.filterNftsByActiveWallet();
    });

    await this.refreshAll();

    // ======================================================
    // 🔔 WebSocket Listener
    // ======================================================
    this.ws.messages$.subscribe(async (msg) => {
      if (!msg) return;

      switch (msg.type) {
        case 'buymint-update':
          const soldMint = msg.mint;
          console.log('🔥 NFT sold:', msg);
          if (this.mintAddress && soldMint === this.mintAddress) {
            alert(`💰 NFT sold!\nTX: ${msg.signature}`);
            this.router.navigate(['/market-layout/my-nfts']);
          }
          await this.refreshAll();
          break;

        case 'relist-update':
          console.log('🔥 NFT relisted:', msg);
          await this.refreshAll();
          break;

        case 'delist-update':
          const delistedMint = msg.nft?.mintAddress;
          const delistedName = msg.nft?.name || 'NFT';
          console.log('🔥 NFT delisted:', delistedMint);
          if (this.mintAddress && delistedMint === this.mintAddress) {
            alert(`🧨 ${delistedName} is delist from market.`);
            this.router.navigate(['/market-layout/my-nfts']);
          }
          await this.refreshAll();
          break;
      }
    });
  }

  async ionViewWillEnter() {
    await this.refreshAll();

    // sinkronisasi user
    this.userService.getUser();
    this.userService.loadFromStorage();

    // kasih jeda kecil untuk pastikan localStorage sudah diupdate
    await new Promise((r) => setTimeout(r, 300));

    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    // console.log('👤 [Profile Check Ready]:', userProfile);

    const provider = userProfile.authProvider || 'unknown';
    const hasWallet =
      (userProfile.wallets && userProfile.wallets.length > 0) ||
      (userProfile.custodialWallets && userProfile.custodialWallets.length > 0);
    const hasEmail = !!(userProfile.email && userProfile.email.trim() !== '');
    const hasReferral = !!(userProfile.referral && userProfile.referral.code);
    const usedReferralCode = !!userProfile.usedReferralCode;

    // console.log('🔎 [Profile Flags]', {
    //   provider, hasWallet, hasEmail, hasReferral, usedReferralCode
    // });

    // tampilkan modal jika incomplete
    if (
      (provider === 'wallet' && !hasEmail) ||
      (provider === 'google' && !hasWallet) ||
      (provider === 'local' && (usedReferralCode || hasReferral) && !hasWallet) ||
      (!hasEmail || !hasReferral)
    ) {
      // console.warn('⚠️ Showing setup/referral modal for provider:', provider);
      const mode =
        provider === 'google' ? 'google' :
        provider === 'wallet' ? 'wallet' :
        provider === 'local' ? 'local' :
        undefined;

      if (mode) {
        // pakai timeout biar Angular sempat render halaman dulu sebelum munculkan modal
        setTimeout(() => this.openReferralModal(mode), 400);
      }
      return;
    }

    // ✅ Profil lengkap, lanjut
    // console.log('✅ Profil user valid:', {
    //   provider,
    //   email: userProfile.email,
    //   referral: userProfile.referral?.code,
    // });

    this.wallet.getActiveWallet().subscribe((addr) => {
      this.userAddress = addr;
      this.filterNftsByActiveWallet();
    });

    await this.refreshAll();

    // ======================================================
    // 🔔 WebSocket Listener
    // ======================================================
    this.ws.messages$.subscribe(async (msg) => {
      if (!msg) return;

      switch (msg.type) {
        case 'buymint-update':
          const soldMint = msg.mint;
          console.log('🔥 NFT sold:', msg);
          if (this.mintAddress && soldMint === this.mintAddress) {
            alert(`💰 NFT sold!\nTX: ${msg.signature}`);
            this.router.navigate(['/market-layout/my-nfts']);
          }
          await this.refreshAll();
          break;

        case 'relist-update':
          console.log('🔥 NFT relisted:', msg);
          await this.refreshAll();
          break;

        case 'delist-update':
          const delistedMint = msg.nft?.mintAddress;
          const delistedName = msg.nft?.name || 'NFT';
          console.log('🔥 NFT delisted:', delistedMint);
          if (this.mintAddress && delistedMint === this.mintAddress) {
            alert(`🧨 ${delistedName} telah dihapus dari listing.`);
            this.router.navigate(['/market-layout/all-collection']);
          }
          await this.refreshAll();
          break;

        /* ======================================
           🟣 PRIZEPOOL REALTIME UPDATE
           ====================================== */
        case 'prizepool_update':
          // console.log("⚡ PRIZEPOOL realtime update:", msg);

          // Merge, jangan overwrite total
          this.prizePool = {
            ...this.prizePool,
            ...msg.data
          };

          break;
      }
    });
  }

  async ionViewDidEnter() {
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

    // sinkronisasi user
    this.userService.getUser();
    this.userService.loadFromStorage();

    // kasih jeda kecil untuk pastikan localStorage sudah diupdate
    await new Promise((r) => setTimeout(r, 300));

    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    // console.log('👤 [Profile Check Ready]:', userProfile);

    const provider = userProfile.authProvider || 'unknown';
    const hasWallet =
      (userProfile.wallets && userProfile.wallets.length > 0) ||
      (userProfile.custodialWallets && userProfile.custodialWallets.length > 0);
    const hasEmail = !!(userProfile.email && userProfile.email.trim() !== '');
    const hasReferral = !!(userProfile.referral && userProfile.referral.code);
    const usedReferralCode = !!userProfile.usedReferralCode;

    // console.log('🔎 [Profile Flags]', {
    //   provider, hasWallet, hasEmail, hasReferral, usedReferralCode
    // });

    // tampilkan modal jika incomplete
    if (
      (provider === 'wallet' && !hasEmail) ||
      (provider === 'google' && !hasWallet) ||
      (provider === 'local' && (usedReferralCode || hasReferral) && !hasWallet) ||
      (!hasEmail || !hasReferral)
    ) {
      // console.warn('⚠️ Showing setup/referral modal for provider:', provider);
      const mode =
        provider === 'google' ? 'google' :
        provider === 'wallet' ? 'wallet' :
        provider === 'local' ? 'local' :
        undefined;

      if (mode) {
        // pakai timeout biar Angular sempat render halaman dulu sebelum munculkan modal
        setTimeout(() => this.openReferralModal(mode), 400);
      }
      return;
    }

    // ✅ Profil lengkap, lanjut
    // console.log('✅ Profil user valid:', {
    //   provider,
    //   email: userProfile.email,
    //   referral: userProfile.referral?.code,
    // });

    this.wallet.getActiveWallet().subscribe((addr) => {
      this.userAddress = addr;
      this.filterNftsByActiveWallet();
    });

    await this.refreshAll();

    // ======================================================
    // 🔔 WebSocket Listener
    // ======================================================
    this.ws.messages$.subscribe(async (msg) => {
      if (!msg) return;

      switch (msg.type) {
        case 'buymint-update':
          const soldMint = msg.mint;
          console.log('🔥 NFT sold:', msg);
          if (this.mintAddress && soldMint === this.mintAddress) {
            alert(`💰 NFT sold!\nTX: ${msg.signature}`);
            this.router.navigate(['/market-layout/my-nfts']);
          }
          await this.refreshAll();
          break;

        case 'relist-update':
          console.log('🔥 NFT relisted:', msg);
          await this.refreshAll();
          break;

        case 'delist-update':
          const delistedMint = msg.nft?.mintAddress;
          const delistedName = msg.nft?.name || 'NFT';
          console.log('🔥 NFT delisted:', delistedMint);
          if (this.mintAddress && delistedMint === this.mintAddress) {
            alert(`🧨 ${delistedName} telah dihapus dari listing.`);
            this.router.navigate(['/market-layout/all-collection']);
          }
          await this.refreshAll();
          break;
      }
    });
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
        this.market.loadPrizePool()
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
      this.market.getPrizePool().subscribe(pool => {this.prizePool = pool});

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

  disconnectWallet() {
    localStorage.removeItem('walletAddress');
    this.auth.logout(); // hapus token + authId
    this.userAddress = '';
    this.balance = null;
    this.showToast('Wallet disconnected', 'danger');
  }

  async logout() {
    const loading = await this.showLoading('Logging out...');
    try {
      await this.auth.logout();
      this.disconnectWallet();
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
    // console.log("🔍 [filterNftsByActiveWallet] Called");
    // console.log("   🧩 userAddress:", this.userAddress);
    // console.log("   🧮 Total fetched NFT:", this.fetchnft?.length || 0);

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

    // console.log("✅ [filterNftsByActiveWallet] Done filtering:");
    // console.log("   🎭 Characters:", this.nftBC.length);
    // console.log("   🔮 Runes:", this.nftRuneBC.length);

    // (Opsional) log contoh 1 item untuk memastikan struktur benar
    if (this.nftBC.length > 0) {
      // console.log("   🔹 Example Character NFT:", this.nftBC[0]);
    }
    if (this.nftRuneBC.length > 0) {
      // console.log("   🔹 Example Rune NFT:", this.nftRuneBC[0]);
    }
  }

  // 🔹 Buka modal referral
  openReferralModal(mode: 'local' | 'google' | 'wallet' = 'local'): Promise<'skip' | 'apply' | null> {
    return new Promise((resolve) => {
      this.showReferralModal = true;
      this.isClosingReferral = false;
      this.isLocalReferral = (mode === 'local');
      this.isGoogleReferral = (mode === 'google');
      this.isWalletReferral = (mode === 'wallet'); // 👈 tambahkan ini
      this.referralResolver = resolve;
    });
  }

  // 🔹 Tutup modal referral
  closeReferralModal() {
    this.isClosingReferral = true;
    setTimeout(() => (this.showReferralModal = false), 200);
  }

  // 🔹 Skip tanpa referral
  skipReferral() {
    if (this.referralResolver) {
      this.referralResolver('skip');
      this.referralResolver = null;
    }
    this.closeReferralModal();
  }

  // 🔹 Apply referral + update user profile
  async applyReferral(event: Event) {
    event.preventDefault();

    const code = this.referralCode?.trim();
    const email = this.email?.trim();
    const password = this.password?.trim();

    if (!email || !password) {
      this.showToast("Email and password required ❌", "danger");
      return;
    }

    try {
      if (code) localStorage.setItem("pendingReferralCode", code);

      const walletAddress = this.userAddress || localStorage.getItem("walletAddress");

      const body = { email, password, code: code || null, walletAddress };

      const res: any = await this.http
        .post(`${environment.apiUrl}/auth/referral/apply-and-update`, body, {
          headers: { Authorization: `Bearer ${this.authToken}` },
        })
        .toPromise();

      if (res?.success) {
        this.showToast("Profile updated successfully ✅", "success");

        this.userService.setUser({
          email: res.email ?? email,
          referral: res.referral ?? { code, isActive: true },
        });

        localStorage.removeItem("pendingReferralCode");

        if (this.referralResolver) {
          this.referralResolver("apply");
          this.referralResolver = null;
        }

        this.closeReferralModal(); // ✅ hanya kalau sukses
      } else {
        console.warn("⚠️ Referral apply failed:", res?.error);
        this.showToast(res?.error || "Profile update failed ❌", "danger");

        // ❌ Jangan tutup modal, biarkan user memperbaiki input
        this.isClosingReferral = false;
        this.showReferralModal = true;
      }

    } catch (err: any) {
      console.error("❌ Referral apply error:", err);
      const backendMsg =
        err?.error?.error ||
        err?.error?.message ||
        "Unknown error updating referral/profile ❌";

      this.showToast(backendMsg, "danger");

      this.isClosingReferral = false;
      this.showReferralModal = true; // ❌ jangan ditutup
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async saveAndConnectWallet() {
    this.isSaving = true;

    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const token = localStorage.getItem('authToken');
    const provider = userProfile.authProvider || 'unknown';

    try {
      // =============================
      // 🔍 VALIDASI BERDASARKAN PROVIDER
      // =============================
      if (provider === 'wallet') {
        if (!this.email || !this.password) {
          this.showToast('Please fill in your email and password before connecting wallet.', 'danger');
          this.isSaving = false;
          return;
        }
      } else if (provider === 'google') {
        if (!this.password) {
          this.showToast('Please fill in your password before connecting wallet.', 'danger');
          this.isSaving = false;
          return;
        }
      } else if (provider === 'local') {
        // Local user sudah punya email & password → langsung lanjut connect
        this.showToast('Connecting your wallet...', 'success');
      } else {
        this.showToast('Unknown login provider.', 'danger');
        this.isSaving = false;
        return;
      }

      this.showToast('Saving your account details...', 'success');

      // =============================
      // 🧩 Buat payload sesuai provider
      // =============================
      const userId = localStorage.getItem('userId');
      const payload: any = {
        userId,
        code: this.referralCode || null,
      };

      if (provider === 'wallet') {
        payload.email = this.email;
        payload.password = this.password;
      } else if (provider === 'google') {
        payload.email = userProfile.email;
        payload.password = this.password;
      } else if (provider === 'local') {
        payload.email = userProfile.email;
        payload.password = userProfile.password || ''; // tidak dikirim ulang sebenarnya
      }

      // =============================
      // 🔄 Kirim ke backend
      // =============================
      const resp: any = await this.http.post(
        `${environment.apiUrl}/auth/referral/apply-and-update`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      ).toPromise();

      console.log('✅ User info updated:', resp);

      // =============================
      // 💾 Update localStorage
      // =============================
      const updatedProfile = {
        ...userProfile,
        email: resp.email || userProfile.email,
        referral: resp.referral || {
          code: this.referralCode,
          isActive: true,
          totalClaimable: 0,
          totalClaimed: 0,
        },
        wallets: resp.wallets || userProfile.wallets || [],
        authProvider: provider,
      };

      localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      this.userService.setUser(updatedProfile);

      this.showToast('Account updated successfully. Connecting wallet...', 'success');

      // 🔐 Tutup modal & redirect
      this.closeReferralModal();
      localStorage.setItem('pendingConnectRedirect', this.router.url);
      this.router.navigate(['/login'], { queryParams: { forceLogin: true } });
    } catch (err) {
      console.error('❌ Error saving user before connect wallet:', err);
      this.showToast('Failed to save user info. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async showToast(message: string, color: 'success' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
      color,
    });
    await toast.present();
  }
}
