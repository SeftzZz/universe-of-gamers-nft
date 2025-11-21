import { Component, NgZone, OnInit, HostListener, ElementRef } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Auth } from '../../services/auth';
import { Wallet } from '../../services/wallet';
import { Modal } from '../../services/modal';
import { User, UserProfile } from '../../services/user';
import { GoogleLoginService } from '../../services/google-login-service';

import { ToastController, LoadingController } from '@ionic/angular';

import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Clipboard } from '@capacitor/clipboard';

const web3 = require('@solana/web3.js');
const { Transaction } = require("@solana/web3.js");

import { Phantom } from '../../services/phantom';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { IonContent } from '@ionic/angular';

/**
 * Helper log universal — tampil di console browser dan Android Logcat
 */
function nativeLog(tag: string, data: any) {
  const time = new Date().toISOString();
  const msg = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const prefix = Capacitor.isNativePlatform() ? '🟩' : '🟢';
  console.log(`${prefix} [${tag}] ${time} → ${msg}`);
}

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

  showWithdrawModal = false;
  isClosingWithdraw = false;
  isWithdrawing = false;
  treasuryBalance = { sol: 0, usdValue: 0 };
  withdrawAmount = 0;
  pendingTxId: string | null = null;
  pendingTxLink: string | null = null;
  role: "admin" | "signer1" | "signer2" = "admin";
  withdrawStage: "admin" | "signer1" | "signer2" | "none" = "none";
  isProcessing = false;
  authToken: string | null = null;
  amountWithdraw = 0;

  isClaiming = false;

  treasuryAddress = 'yAFXQLTtXp8acjntPg7DW5GcgLZMeF7VxMdmgAE3fWt'; // ← isi sesuai ENV backend

  balance: number | null = null;
  userAddress: string | null = null;

  showPrizepoolModal = false;
  isClosingPrizepool = false;
  isDistributing = false;
  distributionSuccess = false;
  prizepoolFinal = 0;
  eligiblePlayers = 0;
  playerSearch = "";
  distributionList: any[] = [];

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
    private phantom: Phantom,
    private googleLoginService: GoogleLoginService,
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
  
  async ngOnInit() {
    // 🔹 listen perubahan wallets dari service
    this.walletService.getWallets().subscribe(ws => {
      this.wallets = ws || [];
      // this.loadAllWalletBalances(); // preload balance tiap wallet
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

    await this.refreshWithdrawStage();
  }

  async refreshWithdrawStage() {
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/withdraw/pending/latest`, {
          headers: { Authorization: `Bearer ${this.authToken}` },
        })
        .toPromise();

      this.withdrawStage = resp?.stage || "admin";
      this.amountWithdraw = resp?.amountSOL || null;
      console.log("📊 Current withdrawStage:", this.withdrawStage);
    } catch (err) {
      console.error("⚠️ Failed to fetch withdraw stage:", err);
      this.withdrawStage = "admin";
    }
  }

  get activeWalletData() {
    return this.uniqueWallets.find(w => w.address === this.activeWallet);
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

  async disconnectWallet() {
    this.activeWallet = null;
    localStorage.removeItem('walletAddress');
    this.auth.logout(); // hapus token + authId
    this.userAddress = '';
    this.balance = null;
    this.showToast('Wallet disconnected', 'danger');
  }

  async logout() {
    this.closeMobileNav();
    const loading = await this.showLoading('Logging out...');

    try {
      // Jalankan dalam Angular zone agar UI ikut update
      this.ngZone.run(async () => {

        // 🧹 Bersihkan wallet
        this.walletService.setActiveWallet(''); // <-- pastikan BehaviorSubject dikosongkan
        this.walletService.setWallets([]);        // opsional
        localStorage.removeItem('walletAddress');
        localStorage.removeItem('wallets');

        // 🧹 Bersihkan auth info
        localStorage.removeItem('userId');
        localStorage.removeItem('token');
        localStorage.removeItem('dappSecretKey');
        localStorage.removeItem('dappNonce');

        this.activeWallet = null; // update lokal
        this.profile = {} as any;
        await this.googleLoginService.logout();
        await this.disconnectWallet();

        // 🚀 Redirect ke halaman umum (tanpa guard)
        setTimeout(() => {
          window.location.href = '/login';
        }, 300);
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

  /** 🔹 Tampilkan modal & ambil saldo treasury */
  async openWithdrawModal() {
    this.showWithdrawModal = true;
    this.isClosingWithdraw = false;
    await this.loadTreasuryBalance();
    await this.refreshWithdrawStage();
  }

  /** 🔹 Ambil saldo dari backend */
  async loadTreasuryBalance() {
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/balance/${this.treasuryAddress}`)
        .toPromise();
      this.treasuryBalance = resp;
      console.log('✅ Treasury balance loaded:', resp);
    } catch (err: any) {
      console.error('❌ Failed to fetch treasury balance:', err);
    }
  }

  /** 🔹 Reset & tutup modal */
  resetWithdrawModal() {
    this.isClosingWithdraw = true;
    setTimeout(() => {
      this.showWithdrawModal = false;
      this.withdrawAmount = 0;
    }, 250);
  }

  async submitWithdraw() {
    this.isWithdrawing = true;

    try {
      // 🧩 1️⃣ Dapatkan wallet aktif
      const activeWallet = this.activeWallet;
      if (!activeWallet) {
        alert("⚠️ Please connect your wallet first.");
        this.isWithdrawing = false;
        return;
      }

      // 🔍 2️⃣ Cek status pending TX dari backend
      const statusResp: any = await this.http
        .get(`${environment.apiUrl}/withdraw/pending/latest`, {
          headers: { Authorization: `Bearer ${this.authToken}` },
        })
        .toPromise();

      const stage = statusResp?.stage || "admin";
      const txId = statusResp?.txId;
      let txBase58 = statusResp?.transaction;

      console.log("💡 Withdraw stage:", stage);

      // Deteksi platform
      const platform = Capacitor.getPlatform();
      const isMobile = platform === "android" || platform === "ios";
      const provider = (window as any).solana;

      // ============================================================
      // 👑 ADMIN STAGE — Buat unsigned transaction
      // ============================================================
      if (stage === "admin") {
        if (!this.withdrawAmount || this.withdrawAmount <= 0) {
          const toast = await this.toastCtrl.create({
            message: "⚠️ Please enter a valid amount",
            duration: 3000,
            color: "warning",
            position: "top",
          });
          toast.present();
          this.isWithdrawing = false;
          return;
        }

        console.log("⚙️ Creating unsigned transaction...");
        const resp: any = await this.http
          .post(
            `${environment.apiUrl}/withdraw/pull`,
            { amountSOL: this.withdrawAmount, activeWallet },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          )
          .toPromise();

        txBase58 = resp.transaction;
        const txBuffer = bs58.decode(txBase58);
        const txId = resp.txId;

        // ========================================
        // 🖥️ DESKTOP FLOW
        // ========================================
        if (!isMobile && provider?.isPhantom) {
          try {
            await provider.connect();
            const transaction = Transaction.from(txBuffer);
            console.log("🖋️ Admin signing transaction with Phantom...");
            const signedTx = await provider.signTransaction(transaction);
            const serialized = signedTx.serialize();
            const base58SignedTx = bs58.encode(serialized);

            await this.http.post(
              `${environment.apiUrl}/withdraw/sign-admin`,
              { txId, signedTx: base58SignedTx },
              { headers: { Authorization: `Bearer ${this.authToken}` } }
            ).toPromise();

            const toast = await this.toastCtrl.create({
              message: "✅ Admin signed transaction! Waiting for Signer1...",
              duration: 4000,
              color: "success",
              position: "top",
            });
            toast.present();
          } catch (err: any) {
            console.error("❌ Phantom admin sign error:", err);
            const toast = await this.toastCtrl.create({
              message: err?.message || "❌ Admin signing failed.",
              duration: 4000,
              color: "danger",
              position: "top",
            });
            toast.present();
          } finally {
            this.isWithdrawing = false;
          }
          return;
        }

        // ========================================
        // 📱 MOBILE FLOW (ADMIN via Deeplink)
        // ========================================
        await this.launchPhantomMobileDeeplink("admin", txBase58, txId);
        return;
      }

      // ============================================================
      // ✍️ SIGNER 1 / SIGNER 2 STAGE
      // ============================================================
      if (stage === "signer1" || stage === "signer2") {
        if (!txBase58) {
          alert("❌ No transaction found to sign.");
          this.isWithdrawing = false;
          return;
        }

        const txBuffer = bs58.decode(txBase58);

        // ========================================
        // 🖥️ DESKTOP FLOW
        // ========================================
        if (!isMobile && provider?.isPhantom) {
          try {
            await provider.connect();
            const transaction = Transaction.from(txBuffer);
            const signedTx = await provider.signTransaction(transaction);
            const serialized = signedTx.serialize();
            const base58SignedTx = bs58.encode(serialized);

            if (stage === "signer1") {
              await this.http.post(
                `${environment.apiUrl}/withdraw/sign`,
                { txId, signedTx: base58SignedTx },
                { headers: { Authorization: `Bearer ${this.authToken}` } }
              ).toPromise();

              const toast = await this.toastCtrl.create({
                message: "✅ Transaction signed by Signer1! Waiting for Signer2...",
                duration: 4000,
                color: "success",
                position: "top",
              });
              toast.present();
            } else {
              const confirmResp: any = await this.http.post(
                `${environment.apiUrl}/withdraw/confirm`,
                { txId, signedTx: base58SignedTx },
                { headers: { Authorization: `Bearer ${this.authToken}` } }
              ).toPromise();

              const toast = await this.toastCtrl.create({
                message: `✅ Withdraw broadcasted! TX: ${confirmResp.signature}`,
                duration: 4000,
                color: "success",
                position: "top",
              });
              toast.present();
              window.open(confirmResp.explorer, "_blank");
            }
          } catch (err: any) {
            console.error("❌ Phantom sign error:", err);
            const toast = await this.toastCtrl.create({
              message: err?.message || "❌ Signing failed.",
              duration: 4000,
              color: "danger",
              position: "top",
            });
            toast.present();
          } finally {
            this.isWithdrawing = false;
          }
          return;
        }

        // ========================================
        // 📱 MOBILE FLOW (SIGNER via Deeplink)
        // ========================================
        await this.launchPhantomMobileDeeplink(stage, txBase58, txId);
        return;
      }

      // ============================================================
      // 🧱 Jika tidak cocok stage
      // ============================================================
      const toast = await this.toastCtrl.create({
        message: "⚠️ Unknown withdraw stage or transaction not found.",
        duration: 3000,
        color: "warning",
        position: "top",
      });
      toast.present();

    } catch (err: any) {
      console.error("❌ Error in withdraw process:", err);
      const toast = await this.toastCtrl.create({
        message:
          err?.error?.error ||
          err?.error?.message ||
          err?.message ||
          "❌ Withdraw process failed.",
        duration: 4000,
        color: "danger",
        position: "top",
      });
      toast.present();
    } finally {
      this.isWithdrawing = false;
    }
  }

  /* ============================================================
  📱 Fungsi Deeplink Universal untuk Admin, Signer1, Signer2
  ============================================================ */
  private async launchPhantomMobileDeeplink(stage: string, txBase58: string, txId: string) {
    const phantom_pubkey = localStorage.getItem("phantom_pubkey");
    const secretKeyStored = localStorage.getItem("dappSecretKey");
    const session = localStorage.getItem("phantomSession");

    if (!phantom_pubkey || !secretKeyStored || !session) {
      alert("⚠️ Please connect Phantom first before withdraw.");
      this.isWithdrawing = false;
      return;
    }

    const phantomPubKey = bs58.decode(phantom_pubkey);
    const secretKey = bs58.decode(secretKeyStored);
    const sharedSecret = nacl.box.before(phantomPubKey, secretKey);
    const nonce = nacl.randomBytes(24);
    const nonceB58 = bs58.encode(nonce);

    const payloadObj = { session, transaction: txBase58, display: "signTransaction" };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
    const encryptedPayload = nacl.box.after(payloadBytes, nonce, sharedSecret);
    const payloadB58 = bs58.encode(encryptedPayload);

    const dappPubKeyB58 = bs58.encode(this.phantom.getKeypair().publicKey);
    const redirect = encodeURIComponent("com.universeofgamers.nft://phantom-callback");

    const baseUrl =
      `https://phantom.app/ul/v1/signTransaction?` +
      `dapp_encryption_public_key=${dappPubKeyB58}` +
      `&redirect_link=${redirect}` +
      `&nonce=${nonceB58}` +
      `&payload=${payloadB58}`;

    const relay = "https://universeofgamers.io/phantom-redirect.html";
    const appUrl = "https://universeofgamers.io";
    const relayUrl = `${relay}?target=${encodeURIComponent(baseUrl)}&app=${encodeURIComponent(appUrl)}`;

    console.log(`🔗 PHANTOM_WITHDRAW_${stage.toUpperCase()}_SIGN_URL`, relayUrl);

    // Simpan context
    localStorage.setItem("phantomFlow", "withdraw");
    localStorage.setItem("phantomStage", stage);
    localStorage.setItem("pendingWithdrawTxId", txId);

    this.isWithdrawing = false;
    setTimeout(() => (window.location.href = relayUrl), 500);
  }

  async claimReferral() {
    if (!this.profile?.referral) {
      this.showToast('⚠️ No referral data found.', 'warning');
      return;
    }

    const claimable = this.profile.referral.totalClaimable;
    if (claimable < 0.06) {
      this.showToast('⚠️ Minimum claim amount is $10.', 'warning');
      return;
    }

    this.isClaiming = true;

    try {
      const resp: any = await this.http
        .post(
          `${environment.apiUrl}/referral/claim`,
          {},
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        )
        .toPromise();

      this.showToast(`✅ Claimed $${resp.claimedUSD.toFixed(2)} successfully!`, 'success');
      if (resp.signature) {
        window.open(resp.explorer, '_blank');
      }

      // Update UI
      this.profile.referral.totalClaimed += resp.claimedUSD;
      this.profile.referral.totalClaimable = 0;
    } catch (err: any) {
      console.error('❌ Claim Error:', err);
      const message = err?.error?.error || 'Failed to claim reward.';
      this.showToast(`❌ ${message}`, 'danger');
    } finally {
      this.isClaiming = false;
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top',
    });
    toast.present();
  }

  get isUserLoggedIn(): boolean {
    const profile = this.profile || JSON.parse(localStorage.getItem('userProfile') || '{}');

    return (
      !!this.activeWallet || // sudah connect wallet
      (profile?.authProvider === 'local' && !!profile?.email) || // login lokal
      (profile?.authProvider === 'google' && !!profile?.email)   // login Google
    );
  }

  get filteredPlayers() {
    return this.distributionList.filter((p) =>
      p.username.toLowerCase().includes(this.playerSearch.toLowerCase())
    );
  }

  /** Open modal */
  async openPrizepoolModal() {
    this.showPrizepoolModal = true;
    this.isClosingPrizepool = false;

    await this.loadPrizepoolStats();
    await this.loadDistributionSimulation();
  }

  /** Close modal */
  closePrizepoolModal() {
    this.isClosingPrizepool = true;
    setTimeout(() => {
      this.showPrizepoolModal = false;
      this.distributionSuccess = false;
      this.isDistributing = false;
      this.playerSearch = "";
    }, 250);
  }

  /** Load main stats */
  async loadPrizepoolStats() {
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/prizepool/status`)
        .toPromise();

      this.treasuryBalance.sol = resp.balance_SOL;
      this.treasuryBalance.usdValue = resp.value_usd;
      this.prizepoolFinal = resp.balance_SOL;
    } catch (err) {
      console.error("loadPrizepoolStats Error:", err);
    }
  }

  /** Load simulation */
  async loadDistributionSimulation() {
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/prizepool/distribute/simulate`)
        .toPromise();

      this.distributionList = resp.distribution;
      this.eligiblePlayers = resp.total_players;
      this.prizepoolFinal = resp.prizepool_total;
    } catch (err) {
      console.error("loadDistributionSimulation Error:", err);
    }
  }

  /** Submit Distribution (Simulation Only) */
  async submitPrizepool() {
    this.isDistributing = true;

    try {
      const resp: any = await this.http
        .post(`${environment.apiUrl}/prizepool/distribute`, {})
        .toPromise();

      console.log("📌 Distribution simulation result:", resp);

      this.isDistributing = false;
      this.distributionSuccess = true;

    } catch (err: any) {
      this.isDistributing = false;
      console.error("Prizepool distribution failed:", err);

      const toast = await this.toastCtrl.create({
        message: err?.error?.error || "Distribution failed.",
        duration: 3000,
        color: "danger",
        position: "top",
      });
      toast.present();
    }
  }
}