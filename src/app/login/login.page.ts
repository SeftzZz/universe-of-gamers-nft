import { Component, OnInit, NgZone } from '@angular/core';
import { Auth } from '../services/auth';
import { Wallet } from '../services/wallet';
import { Modal } from '../services/modal';
import { User, UserProfile } from '../services/user';
import { Phantom } from '../services/phantom';
import { ToastController, LoadingController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { GoogleLoginService } from '../services/google-login-service';
import { AuthRedirect } from '../services/auth-redirect';

let dappKeyPair: nacl.BoxKeyPair | null = null;

export const dappKeys = nacl.box.keyPair();
export const nonce = nacl.randomBytes(24);

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  email = '';
  password = '';
  userAddress: string = '';
  showPassword: boolean = false;

  balance: number | null = null;
  balanceUsd: number | null = null;
  trend: number = 0;
  percentChange: number = 0;

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

  private loading: HTMLIonLoadingElement | null = null;

  private phantomFlow: 'connect' | 'signMessage' | null = null;
  private challengeNonce: string | null = null;

  showReferralModal = false;
  referralCode: string = '';
  isClosingReferral = false;
  private referralResolver: ((value: 'skip' | 'apply' | null) => void) | null = null;

  authToken: string | null = null;

  constructor(
    private http: HttpClient,
    private auth: Auth,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private router: Router,
    private phantom: Phantom,
    private walletService: Wallet,
    private modalService: Modal,
    private userService: User,
    private google: GoogleLoginService,
    private authRedirect: AuthRedirect,
    private ngZone: NgZone,
  ) {}

  ngOnInit() {
    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      this.userAddress = saved;
      this.updateBalance();
    }

    this.sub = this.modalService.accountsModal$.subscribe(open => {
      this.showAccountsModal = open;
    });
  }

  async ionViewWillEnter() {
    console.log('🚫 Skip ionViewWillEnter Phantom decrypt — handled globally by AppComponent');
  }

  // === Phantom Wallet connect + login ===
  async connectWallet() {
    try {
      // 🧩 Cek apakah referral sudah pernah digunakan
      const alreadyUsedReferral = localStorage.getItem('usedReferral');
      if (!alreadyUsedReferral) {
        const referralAction = await this.openReferralModal();
        console.log('🎟️ Referral action:', referralAction);

        if (referralAction === 'apply') {
          localStorage.setItem('usedReferral', 'true');
          console.log('✅ Referral marked as used locally.');
        } else if (referralAction === 'skip') {
          console.log('⏭️ Referral skipped by user.');
        } else {
          console.log('⛔ Referral modal dismissed, cancel wallet connect.');
          return;
        }
      } else {
        console.log('🎟️ Referral already used, skipping modal.');
      }

      // 🧩 Pastikan session Phantom aktif
      try {
        this.phantom.getPublicKeyB58();
      } catch {
        console.log('⚙️ No active Phantom session, generating new one...');
        this.phantom.generateSession();
      }

      const dappPubKey = this.phantom.getPublicKeyB58();
      const nonceB58 = this.phantom.getNonceB58();

      console.log('🔍 [Connect] dappPubKey =', dappPubKey);
      console.log('🔍 [Connect] nonceB58 =', nonceB58);

      // Global constants
      const PHANTOM_REDIRECT = 'com.universeofgamers.nft://phantom-callback';
      const appUrl = 'https://universeofgamers.io';
      const relay = 'https://universeofgamers.io/phantom-redirect.html';

      const schemaUrl =
        `https://phantom.app/ul/v1/connect?` +
        `dapp_encryption_public_key=${dappPubKey}` +
        `&cluster=mainnet-beta` +
        `&app_url=${encodeURIComponent(appUrl)}` +
        `&redirect_link=${encodeURIComponent(PHANTOM_REDIRECT)}` +
        `&nonce=${nonceB58}`;

      const relayUrl = `${relay}?target=${encodeURIComponent(schemaUrl)}`;

      // ==============================
      // 📱 Mobile flow
      // ==============================
      if (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') {
        localStorage.setItem('phantomFlow', 'connect');
        setTimeout(() => {
          window.location.href = relayUrl;
        }, 500);
        return;
      }

      // ==============================
      // 💻 Desktop (Phantom extension)
      // ==============================
      console.log('🖥️ Desktop flow detected.');
      const provider = (window as any).solana;
      if (!provider || !provider.isPhantom) {
        console.warn('❌ Phantom extension not found.');
        this.showToast('Phantom wallet not available', 'danger');
        return;
      }

      console.log('🔑 Requesting Phantom extension connect...');
      const resp = await provider.connect();
      this.userAddress = resp.publicKey.toString();
      console.log('✅ Phantom connected:', this.userAddress);

      // ==========================================
      // 🔐 Continue login with wallet
      // ==========================================
      console.log('⏳ Requesting login challenge from backend...');
      const challenge: any = await this.http
        .get(`${environment.apiUrl}/auth/wallet/challenge?address=${this.userAddress}`)
        .toPromise();

      console.log('📜 Challenge received:', challenge);

      const messageBytes = new TextEncoder().encode(challenge.message);
      const signed = await provider.signMessage(messageBytes, 'utf8');
      const signature = signed.signature ? bs58.encode(signed.signature) : null;

      if (!signature) {
        this.showToast('❌ Signature missing', 'danger');
        return;
      }

      this.auth.loginWithWallet({
        provider: 'phantom',
        address: this.userAddress,
        name: `Phantom User ${challenge.nonce}`,
        signature,
        nonce: challenge.nonce,
      }).subscribe({
        next: async (res) => {
          this.dismissLoading();
          console.log('✅ Wallet login success:', res);

          this.auth.setToken(res.token, res.authId);
          localStorage.setItem('userId', res.authId);
          localStorage.setItem('walletAddress', this.userAddress);

          const avatarUrl = res.avatar
            ? `${environment.baseUrl}${res.avatar}`
            : 'assets/images/app-logo.jpeg';

          this.userService.setUser({
            name: res.name,
            email: res.email,
            avatar: avatarUrl,
            role: res.role,
            player: res.player,
            referral: res.referral
          });

          // ✅ Simpan wallet list
          let walletAddr = this.userAddress;
          if (res.custodialWallets?.length > 0) {
            walletAddr = res.custodialWallets[0].address;
          }

          localStorage.setItem('walletAddress', walletAddr);
          const allWallets = [
            ...(res.wallets || []),
            ...(res.custodialWallets || [])
          ];
          localStorage.setItem('wallets', JSON.stringify(allWallets));
          this.walletService.setWallets(allWallets);
          this.walletService.setActiveWallet(walletAddr);

          this.showToast('Wallet connected ✅', 'success');

          // ==========================================
          // 🎟️ Auto-apply referral if stored locally
          // ==========================================
          const pendingReferral = localStorage.getItem('pendingReferralCode');
          if (pendingReferral) {
            console.log(`🎯 Found pending referral: ${pendingReferral}, applying...`);
            try {
              const applyRes: any = await this.http.post(
                `${environment.apiUrl}/auth/referral/apply`,
                { code: pendingReferral, walletAddress: this.userAddress },
                { headers: { Authorization: `Bearer ${this.authToken}` } }
              ).toPromise();

              if (applyRes?.success) {
                console.log('✅ Referral applied successfully.');
                this.showToast('Referral applied successfully ✅', 'success');
                localStorage.removeItem('pendingReferralCode');
                localStorage.removeItem('usedReferral');
              } else {
                console.warn('⚠️ Referral apply failed:', applyRes?.error);
              }
            } catch (err) {
              console.error('❌ Error applying referral:', err);
            }
          }

          this.authRedirect.redirectAfterLogin('/market-layout/my-nfts');
        },
        error: (err) => {
          this.dismissLoading();
          console.error('❌ Wallet login failed:', err);
          this.showToast(err.error?.error || 'Wallet login failed', 'danger');
        }
      });
    } catch (err) {
      this.dismissLoading();
      console.error('💥 Unhandled wallet connect error:', err);
      this.showToast('Wallet connect error', 'danger');
    }
  }

  // === Disconnect Phantom Wallet ===
  disconnectWallet() {
    localStorage.removeItem('walletAddress');
    this.auth.logout(); // hapus token + authId
    this.userAddress = '';
    this.balance = null;
    this.showToast('Wallet disconnected', 'danger');
  }

  async updateBalance() {
    if (!this.userAddress) return;
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/balance/${this.userAddress}`)
        .toPromise();

      this.balance = resp.solBalance;
      this.balanceUsd = resp.usdValue;
      this.trend = resp.trend ?? 0;
      this.percentChange = resp.percentChange ?? 0;

    } catch (err) {
      console.error('Error fetch balance from API', err);
      this.showToast('Error fetch balance', 'danger');
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

  async presentLoading(message = 'Please wait...') {
    this.loading = await this.loadingCtrl.create({
      message,
      spinner: 'crescent',
      translucent: true,
    });
    await this.loading.present();
  }

  async dismissLoading() {
    if (this.loading) {
      await this.loading.dismiss();
      this.loading = null;
    }
  }

  clearForm() {
    this.email = '';
    this.password = '';
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  // === Login dengan email + password ===
  onLogin(event: Event) {
    event.preventDefault();

    if (!this.email || !this.password) {
      this.showToast('Email and password are required', 'danger');
      return;
    }

    // this.presentLoading('Logging in...');
    const payload = { email: this.email, password: this.password };

    this.auth.login(payload).subscribe({
      next: (res) => {
        console.log(res)
        this.dismissLoading();
        this.auth.setToken(res.token, res.authId);

        const avatarUrl = res.avatar
          ? `${environment.baseUrl}${res.avatar}`
          : 'assets/images/app-logo.jpeg';

        this.userService.setUser({
          name: res.name,
          email: res.email,
          notifyNewItems: res.notifyNewItems || false,
          notifyEmail: res.notifyEmail || false,
          avatar: avatarUrl,
          role: res.role,
          player: res.player,
          referral: res.referral
        });

        // ✅ ambil walletAddress (custodial dulu, kalau tidak ada pakai external)
        let walletAddr = null;
        if (res.custodialWallets?.length > 0) {
          walletAddr = res.custodialWallets[0].address;
        } else if (res.wallets?.length > 0) {
          walletAddr = res.wallets[0].address;
        }

        // ✅ simpan ke localStorage
        localStorage.setItem('userId', res.authId);
        if (walletAddr) {
          localStorage.setItem('walletAddress', walletAddr);
        }

        // setelah dapat response dari backend
        if (res.wallets || res.custodialWallets) {
          const allWallets = [
            ...(res.wallets || []),
            ...(res.custodialWallets || [])
          ];
          localStorage.setItem('wallets', JSON.stringify(allWallets));
          // 🟢 Trigger BehaviorSubject agar UI langsung update
          this.walletService.setWallets(allWallets);
        }

        this.ngZone.run(() => {
          this.walletService.setActiveWallet(walletAddr);
        });
              
        this.showToast('Login success', 'success');
        this.clearForm();
        this.authRedirect.redirectAfterLogin('/market-layout/all-collection');
      },
      error: (err) => {
        this.dismissLoading();
        this.showToast(err.error?.error || 'Login failed', 'danger');
      },
    });
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  async googleLogin() {
    try {

      // 🧩 Cek apakah referral sudah pernah digunakan
      const alreadyUsedReferral = localStorage.getItem('usedReferral');
      if (!alreadyUsedReferral) {
        const referralAction = await this.openReferralModal();
        console.log('🎟️ Referral action:', referralAction);

        if (referralAction === 'apply') {
          localStorage.setItem('usedReferral', 'true');
          console.log('✅ Referral marked as used locally.');
        } else if (referralAction === 'skip') {
          console.log('⏭️ Referral skipped by user.');
        } else {
          console.log('⛔ Referral modal dismissed, cancel wallet connect.');
          return;
        }
      } else {
        console.log('🎟️ Referral already used, skipping modal.');
      }

      console.log('🚀 [GoogleLogin] Starting Google login flow...');
      const startTime = performance.now();

      // 1️⃣ Trigger login dari Google service
      const user = await this.google.loginWithGoogle();

      if (!user) {
        console.warn('⚠️ [GoogleLogin] Login Google dibatalkan oleh user');
        return;
      }

      console.log('✅ [GoogleLogin] User object received:', JSON.stringify(user, null, 2));

      // 2️⃣ Validasi idToken
      const idToken = user.idToken;
      if (!idToken) {
        console.error('❌ [GoogleLogin] Tidak dapat mengambil idToken dari Google');
        this.showToast('Failed to retrieve Google token', 'danger');
        return;
      }

      console.log(`🪙 [GoogleLogin] Extracted idToken (length: ${idToken.length} chars)`);

      // 3️⃣ Kirim token ke backend
      console.log('📡 [GoogleLogin] Sending Google ID token to backend...');
      console.log(
        '📦 [Google Login Payload] ' +
        JSON.stringify(
          {
            idToken: idToken ? idToken.substring(0, 20) + '...' : null,
            email: user.email,
            name: user.name,
            picture: user.photo,
          },
          null,
          0 // <-- tidak pakai indentasi, supaya 1 baris
        )
      );

      const resp: any = await this.http
        .post(`${environment.apiUrl}/auth/google`, {
          idToken,
          email: user.email,
          name: user.name,
          picture: user.photo,
        })
        .toPromise()
        .catch((err) => {
          console.error('❌ [GoogleLogin] Backend request failed:', err);
          throw err;
        });

      console.log('✅ [GoogleLogin] Backend raw response:', resp);

      // 4️⃣ Cek hasil dari backend
      if (!resp || !resp.token) {
        console.warn('❌ [GoogleLogin] No token returned from backend!');
        console.log('🧾 Full backend response:', JSON.stringify(resp, null, 2));
        this.showToast('Login failed — no token received', 'danger');
        return;
      }

      // 5️⃣ Simpan token JWT
      this.auth.setToken(resp.token, resp.authId);

      // 6️⃣ Tentukan avatar user
      const avatarUrl = resp.avatar
        ? `${environment.baseUrl}${resp.avatar}`
        : user.photo || 'assets/images/app-logo.jpeg';

      // 7️⃣ Set data user di service global
      this.userService.setUser({
        name: resp.name || user.name,
        email: resp.email || user.email,
        notifyNewItems: resp.notifyNewItems || false,
        notifyEmail: resp.notifyEmail || false,
        avatar: avatarUrl,
        role: resp.role,
        player: resp.player,
        referral: resp.referral
      });

      // 8️⃣ Ambil wallet (custodial dulu, lalu external)
      let walletAddr: string | null = null;
      if (resp.custodialWallets?.length > 0) {
        walletAddr = resp.custodialWallets[0].address;
      } else if (resp.wallets?.length > 0) {
        walletAddr = resp.wallets[0].address;
      }

      // 9️⃣ Simpan ke localStorage
      localStorage.setItem('userId', resp.authId);
      if (walletAddr) localStorage.setItem('walletAddress', walletAddr);

      if (resp.wallets || resp.custodialWallets) {
        const allWallets = [
          ...(resp.wallets || []),
          ...(resp.custodialWallets || []),
        ];
        localStorage.setItem('wallets', JSON.stringify(allWallets));

        // 🟢 Trigger update UI wallet
        this.walletService.setWallets(allWallets);
      }

      // 🔁 Aktifkan wallet utama di UI
      this.ngZone.run(() => {
        if (walletAddr) this.walletService.setActiveWallet(walletAddr);
      });

      // 10️⃣ Log waktu eksekusi
      const elapsed = (performance.now() - startTime).toFixed(0);
      console.log(`🎉 [GoogleLogin] Flow completed successfully in ${elapsed} ms`);

      // ✅ Feedback ke user
      this.showToast('Google Login Success ✅', 'success');
      this.clearForm?.();

      // ==========================================
      // 🎟️ Auto-apply referral if stored locally
      // ==========================================
      const pendingReferral = localStorage.getItem('pendingReferralCode');
      if (pendingReferral) {
        console.log(`🎯 Found pending referral: ${pendingReferral}, applying...`);
        try {
          const applyRes: any = await this.http.post(
            `${environment.apiUrl}/auth/referral/apply`,
            { code: pendingReferral, walletAddress: this.userAddress },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          ).toPromise();

          if (applyRes?.success) {
            console.log('✅ Referral applied successfully.');
            this.showToast('Referral applied successfully ✅', 'success');
            localStorage.removeItem('pendingReferralCode');
            localStorage.removeItem('usedReferral');
          } else {
            console.warn('⚠️ Referral apply failed:', applyRes?.error);
          }
        } catch (err) {
          console.error('❌ Error applying referral:', err);
        }
      }

      this.authRedirect.redirectAfterLogin('/market-layout/all-collection');
    } catch (err: any) {
      console.error('💥 [GoogleLogin] Unhandled error:', JSON.stringify(err));
      const errorMsg = err?.message || err?.error || 'Unknown Google login error';
      this.showToast(`Google login failed: ${errorMsg}`, 'danger');
    }
  }

  onRegister() {
    this.router.navigate(['/registration']);
  }

  testDeeplink() {
    console.log("🔗 Trigger deeplink manually...");
    window.location.href = 'io.ionic.starter://phantom-callback?foo=bar';
  }

  get uniqueWallets() {
    const seen = new Set<string>();
    return this.wallets.filter(w => {
      if (seen.has(w.address)) {
        return false;
      }
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

      this.authRedirect.redirectAfterLogin('/market-layout/all-collection');

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

      this.authRedirect.redirectAfterLogin('/market-layout/all-collection');

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

  // === Logout user ===
  logout() {
    this.auth.logout(); // hapus token, authId, userId (sudah ada di Auth service)
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('wallets');

    this.showToast('You have been logged out', 'success');

    //redirect ke explorer
    window.location.href = 'http://localhost:8100/explorer';
  }

  // 🔹 Buka modal referral
  async openReferralModal(): Promise<'skip' | 'apply' | null> {
    return new Promise((resolve) => {
      this.showReferralModal = true;
      this.isClosingReferral = false;

      // Simpan resolver biar bisa dipanggil di Skip/Apply
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

  // 🔹 Apply referral
  async applyReferral(event: Event) {
    event.preventDefault();

    const code = this.referralCode?.trim();
    if (!code) {
      this.skipReferral();
      return;
    }

    try {
      // Simpan kode ke localStorage agar bisa dipakai setelah wallet connect
      localStorage.setItem("pendingReferralCode", code);

      // 🔍 Coba ambil walletAddress kalau user sudah connect
      const walletAddress = this.userAddress || localStorage.getItem("walletAddress");

      // Kalau wallet belum connect, cukup simpan dulu
      if (!walletAddress) {
        console.log("💾 Referral saved locally, waiting for wallet connect...");
        this.showToast("Referral code saved! Connect your wallet to apply ✅", "success");

        // Tutup modal dan lanjut ke connect wallet
        if (this.referralResolver) {
          this.referralResolver("apply");
          this.referralResolver = null;
        }
        this.closeReferralModal();
        return;
      }

      const pendingReferral = localStorage.getItem('pendingReferralCode');
      // Kalau wallet sudah connect → kirim langsung ke backend
      const res: any = await this.http.post(
        `${environment.apiUrl}/auth/referral/apply`,
        { code: pendingReferral, walletAddress: this.userAddress },
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      ).toPromise();

      if (res.success) {
        this.showToast("Referral applied successfully ✅", "success");
        // hapus localStorage karena sudah dipakai
        localStorage.removeItem("pendingReferralCode");
        if (this.referralResolver) {
          this.referralResolver("apply");
          this.referralResolver = null;
        }
      } else {
        this.showToast(res.error || "Invalid referral code ❌", "danger");
      }
    } catch (err: any) {
      console.error("❌ Referral apply error:", err);
      this.showToast("Error applying referral code", "danger");
    } finally {
      this.closeReferralModal();
    }
  }
}