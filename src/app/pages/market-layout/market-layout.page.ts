import { Component, NgZone, OnInit, HostListener, ElementRef } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Auth } from '../../services/auth';
import { Wallet } from '../../services/wallet';
import { Modal } from '../../services/modal';
import { User, UserProfile } from '../../services/user';

import { ToastController, LoadingController } from '@ionic/angular';

import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Clipboard } from '@capacitor/clipboard';

@Component({
  selector: 'app-market-layout',
  templateUrl: './market-layout.page.html',
  styleUrls: ['./market-layout.page.scss'],
  standalone: false,
})
export class MarketLayoutPage implements OnInit {
  wallets: any[] = [];
  activeWallet: string | null = null;

  mobileNavActive = false;

  avatar: string = '';

  showAccountsModal = false;
  private sub: any;
  isClosingAccounts = false;
  selectedAccountAction: 'create' | 'phrase' | 'private' | null = null;

  recoveryPhrase = '';
  privateKey = '';

  profile!: UserProfile;

  private isToggling = false;

  constructor(
    private http: HttpClient,
    private auth: Auth,
    private walletService: Wallet,
    private modalService: Modal,
    private userService: User,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private ngZone: NgZone,
    private router: Router,
    private el: ElementRef,
  ) {}

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const progress = this.el.nativeElement.querySelector('.progress-wrap');
    if (!progress) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;

    if (scrollPercent > 10) {
      progress.classList.add('active-progress');
    } else {
      progress.classList.remove('active-progress');
    }
  }
  
  ngOnInit() {
    // 🔹 listen perubahan wallets dari service
    this.walletService.getWallets().subscribe(ws => {
      this.wallets = ws || [];
      this.loadAllWalletBalances(); // preload balance tiap wallet
    });

    // 🔹 listen perubahan activeWallet dari service
    this.walletService.getActiveWallet().subscribe(addr => {
      this.activeWallet = addr;
    });

    this.userService.getUser().subscribe(u => {
      this.profile = u;
      console.log('✅ User profile updated:', this.profile);
    });

    this.userService.loadFromStorage();

    this.sub = this.modalService.accountsModal$.subscribe(open => {
      this.showAccountsModal = open;
    });

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // Pastikan dalam zone Angular
        this.ngZone.run(() => {
          this.mobileNavActive = false;
        });
      });
  }

  toggleMobileNav() {
    if (this.isToggling) return;
    this.isToggling = true;

    this.ngZone.run(() => {
      this.mobileNavActive = !this.mobileNavActive;
    });

    setTimeout(() => (this.isToggling = false), 300); // delay aman
  }

  closeMobileNav() {
    this.ngZone.run(() => {
      this.mobileNavActive = false;
    });
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
  }

  private async loadAllWalletBalances() {
    const updatedWallets = await Promise.all(
      this.wallets.map(async (w) => {
        try {
          const resp: any = await this.http
            .get(`${environment.apiUrl}/wallet/tokens/${w.address}`)
            .toPromise();

          return { ...w, usdValue: resp.total ?? 0 }; // ✅ pakai total dari response
        } catch (err) {
          console.error('❌ Error fetch tokens for wallet:', w.address, err);
          return { ...w, usdValue: 0 };
        }
      })
    );

    this.wallets = updatedWallets;
    localStorage.setItem('wallets', JSON.stringify(this.wallets));
  }

  async connectWallet() {
    try {
      const resp = await (window as any).solana.connect();
      const newAddress = resp.publicKey.toString();

      if (newAddress) {
        // tambahkan ke wallets[] kalau belum ada
        if (!this.wallets.find(w => w.address === newAddress)) {
          this.wallets.push({ provider: 'phantom', address: newAddress });
          localStorage.setItem('wallets', JSON.stringify(this.wallets));
        }

        this.switchWallet(newAddress);
      }
    } catch (err) {
      console.error('Wallet connect error', err);
    }
  }

  disconnectWallet() {
    this.activeWallet = null;
    localStorage.removeItem('walletAddress');
    // optional: clear semua wallets juga kalau mau logout total
    // this.wallets = [];
    // localStorage.removeItem('wallets');
  }

  shorten(addr: string) {
    return addr.slice(0, 3) + '...' + addr.slice(-3);
  }

  get uniqueWallets() {
    const seen = new Set<string>();
    return (this.wallets || []).filter(w => {
      if (!w?.address || seen.has(w.address)) return false;
      seen.add(w.address);
      return true;
    });
  }

  toggleAccountsModal() {
    this.modalService.openAccountsModal();
  }

  resetAccountsModal() {
    this.isClosingAccounts = true;
    setTimeout(() => {
      this.modalService.closeAccountsModal();
      this.isClosingAccounts = false;
      this.selectedAccountAction = null;
      this.recoveryPhrase = '';
      this.privateKey = '';
    }, 300);
  }

  selectAccountAction(action: 'create' | 'phrase' | 'private') {
    this.selectedAccountAction = action;
  }

  async addCustodialAccount() {
    try {
      const userId = localStorage.getItem('userId');
      const resp: any = await this.http.post(`${environment.apiUrl}/auth/create/custodial`, {
        userId,
        provider: 'solana'
      }).toPromise();

      if (resp.wallet) {
        // load wallets lama dari localStorage
        const existing = JSON.parse(localStorage.getItem('wallets') || '[]');

        // tambahkan wallet baru
        existing.push(resp.wallet);

        // simpan kembali
        this.wallets = existing;
        this.walletService.setWallets(this.wallets);
        this.walletService.setActiveWallet(resp.wallet.address);

        // set active wallet
        this.switchWallet(resp.wallet.address);
      }

      this.resetAccountsModal();
      if (resp.authId) localStorage.setItem('userId', resp.authId);
      if (resp.token) this.auth.setToken(resp.token, resp.authId);

    } catch (err) {
      console.error("❌ Add custodial wallet error", err);

      const toast = await this.toastCtrl.create({
        message: `Add custodial wallet error ❌ ${err}`,
        duration: 2000,
        position: "bottom",
        color: "danger",
        icon: "close-circle-outline",
        cssClass: "custom-toast",
      });
      await toast.present();
    }
  }

  async importRecoveryPhrase(event: Event) {
    event.preventDefault();
    try {
      const userId = localStorage.getItem('userId');
      const resp: any = await this.http.post(`${environment.apiUrl}/auth/import/phrase`, {
        userId,
        phrase: this.recoveryPhrase,
      }).toPromise();

      if (resp.wallet) {
        // load wallets lama dari localStorage
        const existing = JSON.parse(localStorage.getItem('wallets') || '[]');

        // tambahkan wallet baru
        existing.push(resp.wallet);

        // simpan kembali
        this.wallets = existing;
        this.walletService.setWallets(this.wallets);
        this.walletService.setActiveWallet(resp.wallet.address);
        this.switchWallet(resp.wallet.address);
      }

      this.resetAccountsModal();
      if (resp.authId) localStorage.setItem('userId', resp.authId);
      if (resp.token) this.auth.setToken(resp.token, resp.authId);

    } catch (err) {
      console.error("❌ Import phrase error", err);

      const toast = await this.toastCtrl.create({
        message: `Import phrase error ❌ ${err}`,
        duration: 2000,
        position: "bottom",
        color: "danger",
        icon: "close-circle-outline",
        cssClass: "custom-toast",
      });
      await toast.present();
    }
  }

  async importPrivateKey(event: Event) {
    event.preventDefault();
    try {
      const userId = localStorage.getItem('userId');
      const resp: any = await this.http.post(`${environment.apiUrl}/auth/import/private`, {
        userId,
        privateKey: this.privateKey,
      }).toPromise();

      if (resp.wallet) {
        // load wallets lama dari localStorage
        const existing = JSON.parse(localStorage.getItem('wallets') || '[]');

        // tambahkan wallet baru
        existing.push(resp.wallet);

        // simpan kembali
        this.wallets = existing;
        this.walletService.setWallets(this.wallets);
        this.walletService.setActiveWallet(resp.wallet.address);

        this.switchWallet(resp.wallet.address);
      }

      this.resetAccountsModal();
      if (resp.authId) localStorage.setItem('userId', resp.authId);
      if (resp.token) this.auth.setToken(resp.token, resp.authId);

    } catch (err) {
      console.error("❌ Import private key error", err);

      const toast = await this.toastCtrl.create({
        message: `Import private key error ❌ ${err}`,
        duration: 2000,
        position: "bottom",
        color: "danger",
        icon: "close-circle-outline",
        cssClass: "custom-toast",
      });
      await toast.present();
    }
  }

  async switchWallet(address: string) {
    this.walletService.setActiveWallet(address);
    console.log('✅ Active wallet switched to:', address);
    const toast = await this.toastCtrl.create({
      message: `Switch account success ✅`,
      duration: 2500,
      position: "bottom",
      color: "success",
      icon: "checkmark-circle-outline",
      cssClass: "custom-toast",
    });
    await toast.present();

    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/balance/${address}`)
        .toPromise();

      // update balance di wallets[]
      this.wallets = this.wallets.map(w =>
        w.address === address
          ? { ...w, usdValue: resp.usdValue ?? 0 }
          : w
      );

      localStorage.setItem('wallets', JSON.stringify(this.wallets));
    } catch (err) {
      console.error('❌ Error fetch balance for wallet:', address, err);
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
    this.closeMobileNav();
    const loading = await this.showLoading('Logging out...');

    try {
      // Jalankan dalam Angular zone agar UI ikut update
      this.ngZone.run(async () => {
        await this.auth.logout();

        // 🧹 Bersihkan wallet
        this.walletService.setActiveWallet(''); // <-- pastikan BehaviorSubject dikosongkan
        this.walletService.setWallets([]);        // opsional
        localStorage.removeItem('walletAddress');
        localStorage.removeItem('wallets');

        // 🧹 Bersihkan auth info
        localStorage.removeItem('userId');
        localStorage.removeItem('token');

        this.activeWallet = null; // update lokal
        this.profile = {} as any;

        // 🚀 Redirect ke halaman umum (tanpa guard)
        this.router.navigate(['/market-layout/all-collection']);
      });
    } catch (err) {
      console.error('❌ Logout error:', err);
    } finally {
      loading.dismiss();
    }
  }

  async onCopyIconClick(event: Event, text: string) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await Clipboard.write({ string: text });
      console.log(`📋 Copied to clipboard! ${text}`);
      const toast = await this.toastCtrl.create({
        message: `📋 Copied to clipboard!`,
        duration: 2000,
        position: "bottom",
        color: "success",
        icon: "checkmark-circle-outline",
        cssClass: "custom-toast visible-toast",
        mode: "ios"
      });
      await toast.present();
    } catch (err: any) {
      console.error('❌ Failed to copy:', JSON.stringify(err.message));
      const toast = await this.toastCtrl.create({
        message: `❌ Failed to copy text`,
        duration: 2000,
        position: "bottom",
        color: "danger",
        icon: "close-circle-outline",
        cssClass: "custom-toast visible-toast",
        mode: "ios"
      });
      await toast.present();
    }
  }

}
