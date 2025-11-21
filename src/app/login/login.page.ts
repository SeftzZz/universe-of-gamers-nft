import { Component, OnInit, NgZone } from '@angular/core';
import { Auth } from '../services/auth';
import { Wallet } from '../services/wallet';
import { Modal } from '../services/modal';
import { User, UserProfile } from '../services/user';
import { Phantom } from '../services/phantom';
import { ToastController, LoadingController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
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

  authToken: string | null = null;

  showReferralModal = false;
  referralCode: string = '';
  isClosingReferral = false;
  isLocalReferral = false
  isGoogleReferral = false;
  isWalletReferral = false;
  isConnectWalletMode = false;
  private referralResolver: ((value: 'skip' | 'apply' | null) => void) | null = null;
  isSaving = false;

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
    private route: ActivatedRoute,
  ) {}

  async ngOnInit() {
    console.log("🔄 [LoginPage] ngOnInit triggered");

    // ============================
    // 1️⃣ Restore wallet address
    // ============================
    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      this.userAddress = saved;
      this.updateBalance();
    }

    // ============================
    // 2️⃣ Listen modal service
    // ============================
    this.sub = this.modalService.accountsModal$.subscribe(open => {
      this.showAccountsModal = open;
    });

    // ============================
    // 3️⃣ Tunggu sedikit agar state Angular ready
    // ============================
    await new Promise((res) => setTimeout(res, 200));

    // ============================
    // 4️⃣ CEK apakah user datang dari google-login / local-login / wallet-login
    // ============================
    const from = this.route.snapshot.queryParamMap.get('from');

    console.log("🔍 [LoginPage] QueryParam from =", from);

    if (from === 'google-login' || from === 'local-login' || from === 'wallet-login') {
      console.log("🔍 Running profile completeness check...");
      await this.checkProfileCompleteness();
    }
  }

  async ionViewWillEnter() {
    console.log('🚀 [LoginPage] Entering login view...');

    try {
      // ⚙️ Pastikan session Phantom siap
      let pubKeyB58: string | null = null;
      let nonceB58: string | null = null;

      try {
        pubKeyB58 = this.phantom.getPublicKeyB58();
        nonceB58 = this.phantom.getNonceB58();
        console.log('🔑 Existing Phantom session detected:');
      } catch {
        console.log('⚙️ No active Phantom session, generating new one...');
        this.phantom.generateSession();
        pubKeyB58 = this.phantom.getPublicKeyB58();
        nonceB58 = this.phantom.getNonceB58();
        console.log('🆕 New Phantom session generated:');
      }

      console.log('   📜 Public Key (DApp):', pubKeyB58);
      console.log('   🔒 Nonce:', nonceB58);

      // 💾 Simpan secara manual ke localStorage biar muncul tanpa refresh
      if (pubKeyB58 && nonceB58) {
        localStorage.setItem('phantom_pubkey', pubKeyB58);
        localStorage.setItem('phantom_nonce', nonceB58);
        console.log('💾 Phantom session synced to localStorage immediately.');
      }

      // ✅ Cek apakah ada redirect connect dari referral modal
      const pending = localStorage.getItem('pendingConnectRedirect');
      if (pending) {
        console.log('🔄 [Auto-Connect Trigger] Detected pending redirect from:', pending);
        localStorage.removeItem('pendingConnectRedirect');

        setTimeout(async () => {
          console.log('⚡ Auto-connecting wallet after referral save...');
          await this.connectWallet();
        }, 600);
      } else {
        console.log('✅ No pending wallet connect detected.');
      }

    } catch (err) {
      console.error('💥 [LoginPage] ionViewWillEnter error:', err);
    }
  }

  // === Phantom Wallet connect + login ===
  async connectWallet() {
    console.log('⚡ [Auto Connect Wallet] Starting Phantom flow...');

    try {
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
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
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
      }, this.authToken || undefined).subscribe({
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
            notifyNewItems: res.notifyNewItems || false,
            notifyEmail: res.notifyEmail || false,
            avatar: avatarUrl,
            role: res.role,
            player: res.player,
            referral: res.referral,
            custodialWallets: res.custodialWallets,
            wallets: res.wallets,
            authProvider: res.authProvider || 'phantom', // ✅ tambahkan ini
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

          // ✅ Cek profil user sebelum redirect
          const isComplete = await this.checkProfileCompleteness();
          if (isComplete) {
            const pending = localStorage.getItem('pendingConnectRedirect');
            if (pending) {
              localStorage.removeItem('pendingConnectRedirect');
              this.authRedirect.redirectAfterLogin(pending);
            } else {
              this.authRedirect.redirectAfterLogin('/market-layout/my-nfts');
            }
          }
        },
        error: (err) => {
          this.dismissLoading();
          console.error('❌ Wallet login failed:', err);

          const errorMsg = err?.error?.error || 'Wallet login failed';

          // 🧹 Wallet sudah terhubung ke akun lain → reset sesi
          if (errorMsg === 'This wallet address is already linked, required email and password.') {
            console.warn('⚠️ Wallet linked to another account — clearing local session...');

            this.showToast('⚠️ This wallet address is already linked, required email and password.', 'danger');

            // Redirect ke login pakai fungsi yang ada
            setTimeout(() => {
              this.logout();
            }, 3000);

            return;
          }

          // 🔹 Error umum
          this.showToast(errorMsg, 'danger');
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
      duration: 5000,
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

    const payload = { email: this.email, password: this.password };

    this.auth.login(payload).subscribe({
      next: async (res) => {
        console.log('🔑 Login Response:', res);

        this.dismissLoading();
        this.auth.setToken(res.token, res.authId);

        const avatarUrl = res.avatar
          ? (res.avatar.startsWith('http') 
              ? res.avatar 
              : `${environment.baseUrl}${res.avatar}`)
          : 'assets/images/app-logo.jpeg';

        // 🧩 Simpan user profile
        this.userService.setUser({
          name: res.name,
          email: res.email,
          notifyNewItems: res.notifyNewItems || false,
          notifyEmail: res.notifyEmail || false,
          avatar: avatarUrl,
          role: res.role,
          authProvider: res.authProvider,
          player: res.player,
          referral: res.referral,
          wallets: res.wallets || [],
          custodialWallets: res.custodialWallets || [],
        });

        // 🟦 ALWAYS RESET WALLET SESSION STATE
        localStorage.removeItem('walletConnected');
        localStorage.setItem('userId', res.authId);

        // 🟦 Save existing wallet(s) if any
        const hasWallets = Array.isArray(res.wallets) && res.wallets.length > 0;
        const hasCustodial = Array.isArray(res.custodialWallets) && res.custodialWallets.length > 0;

        if (hasWallets || hasCustodial) {
          const allWallets = [
            ...(res.wallets || []),
            ...(res.custodialWallets || []),
          ];

          const walletAddr = hasCustodial
            ? res.custodialWallets[0].address
            : res.wallets[0].address;

          localStorage.setItem('walletAddress', walletAddr);
          localStorage.setItem('wallets', JSON.stringify(allWallets));

          this.walletService.setWallets(allWallets);
          this.ngZone.run(() => {
            this.walletService.setActiveWallet(walletAddr);
          });

          console.log('💾 Saved existing wallet =', walletAddr);
        } else {
          console.log('⚠️ User has no wallet on server — still must connect Phantom');
          localStorage.removeItem('walletAddress');
          localStorage.removeItem('wallets');
          this.walletService.setWallets([]);
          this.walletService.setActiveWallet('');
        }

        this.showToast('Login success. Please connect your wallet.', 'success');
        this.clearForm();

        // ========================================================
        // 🟧 ALWAYS force connect wallet step
        // ========================================================
        await this.router.navigate(['/login'], {
          queryParams: { from: 'local-login' },
        });

        console.log("🎯 Triggering wallet reconnect modal...");
        setTimeout(() => {
          this.openReferralModal('wallet-connect');
        }, 300);

        // Profile completeness check will be done AFTER connect wallet
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
      console.log('🚀 [GoogleLogin] Starting Google login flow...');
      const startTime = performance.now();

      // 1️⃣ Trigger Google login
      const user = await this.google.loginWithGoogle();
      if (!user) {
        this.showToast('Google Login cancelled ❌', 'danger');
        return;
      }

      console.log('✅ [GoogleLogin] Google User:', JSON.stringify(user, null, 2));

      // 2️⃣ Validate idToken
      const idToken = user.idToken;
      if (!idToken) {
        this.showToast('Failed to retrieve Google token ❌', 'danger');
        return;
      }

      // 3️⃣ Send token to backend
      const resp: any = await this.http
        .post(`${environment.apiUrl}/auth/google`, {
          idToken,
          email: user.email,
          name: user.name,
          picture: user.photo,
        })
        .toPromise();

      if (!resp || !resp.token) {
        this.showToast('Login failed — no token received ❌', 'danger');
        return;
      }

      // 4️⃣ Save JWT
      this.auth.setToken(resp.token, resp.authId);

      // 5️⃣ Determine avatar
      const avatarUrl = resp.avatar
        ? (resp.avatar.startsWith('http')
            ? resp.avatar
            : `${environment.baseUrl}${resp.avatar}`)
        : user.photo || 'assets/images/app-logo.jpeg';

      // 6️⃣ Set user data
      this.userService.setUser({
        name: resp.name || user.name,
        email: resp.email || user.email,
        notifyNewItems: resp.notifyNewItems || false,
        notifyEmail: resp.notifyEmail || false,
        avatar: avatarUrl,
        role: resp.role,
        player: resp.player,
        referral: resp.referral,
        custodialWallets: resp.custodialWallets || [],
        wallets: resp.wallets || [],
        authProvider: resp.authProvider || 'google',
      });

      // 7️⃣ Extract wallet(s)
      let walletAddr: string | null = null;

      if (resp.custodialWallets?.length > 0) {
        walletAddr = resp.custodialWallets[0].address;
      } else if (resp.wallets?.length > 0) {
        walletAddr = resp.wallets[0].address;
      }

      // 8️⃣ Save profile to localStorage
      localStorage.setItem('userId', resp.authId);
      if (walletAddr) localStorage.setItem('walletAddress', walletAddr);

      const allWallets = [
        ...(resp.wallets || []),
        ...(resp.custodialWallets || []),
      ];
      localStorage.setItem('wallets', JSON.stringify(allWallets));
      this.walletService.setWallets(allWallets);

      // Activate wallet in UI
      this.ngZone.run(() => {
        if (walletAddr) this.walletService.setActiveWallet(walletAddr);
      });

      console.log(
        `🎉 [GoogleLogin] Flow completed in ${(performance.now() - startTime).toFixed(0)} ms`
      );

      this.showToast(`Google Login Success, your active wallet ${walletAddr}`, 'success');

      // 9️⃣ Refresh userService state
      this.userService.loadFromStorage();
      await new Promise((resolve) => setTimeout(resolve, 300));

      // ======================================================
      // 🔥 IMPORTANT: Force connect-wallet modal to appear
      // ======================================================
      localStorage.removeItem('walletConnected');

      // 1️⃣ Navigate ke halaman /login agar modal bisa muncul
      await this.router.navigate(['/login'], {
        queryParams: { from: 'google-login' },
      });

      // 2️⃣ Pastikan service reload
      this.userService.loadFromStorage();
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 3️⃣ Check profil → akan memunculkan modal connect wallet
      await this.checkProfileCompleteness();

    } catch (err: any) {
      console.error('💥 [GoogleLogin] Unhandled error:', err);
      const msg = err?.message || err?.error || 'Unknown Google login error';
      this.showToast(`Google login failed: ${msg}`, 'danger');
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

      this.authRedirect.redirectAfterLogin('/market-layout/my-nfts');

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

      this.authRedirect.redirectAfterLogin('/market-layout/my-nfts');

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
        await this.google.logout();
        this.disconnectWallet();
        // 🚀 Redirect ke halaman umum (tanpa guard)
        this.router.navigate(['/login']);
      });
    } catch (err) {
      console.error('❌ Logout error:', err);
    }
  }

  // 🔹 Buka modal referral
  openReferralModal(mode: 'local' | 'google' | 'wallet' | 'wallet-connect' = 'wallet-connect'): Promise<'skip' | 'apply' | null> {
    return new Promise((resolve) => {
      this.showReferralModal = true;
      this.isClosingReferral = false;

      this.isConnectWalletMode = (mode === 'wallet-connect');
      this.isLocalReferral = (mode === 'local');
      this.isGoogleReferral = (mode === 'google');
      this.isWalletReferral = (mode === 'wallet');

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

    this.isSaving = true;

    const userProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const provider = userProfile.authProvider || "unknown";

    const code = this.referralCode?.trim() || null;
    const email = this.email?.trim() || null;
    const password = this.password?.trim() || null;

    // =============================
    // ✅ VALIDASI BERDASARKAN PROVIDER
    // =============================
    if (provider === "wallet") {
      // Wallet login → wajib email & password
      if (!email || !password) {
        this.showToast("Email and password are required for wallet login setup ❌", "danger");
        this.isSaving = false;
        return;
      }
    }

    else if (provider === "google") {
      // Google login → wajib password
      if (!password) {
        this.showToast("Password is required for Google login setup ❌", "danger");
        this.isSaving = false;
        return;
      }
    }

    else if (provider === "local") {
      // Local login → tidak butuh email/password
      // Email/password dari akun sudah tersimpan saat register
      // Tidak dicek di sini.
    }

    else {
      this.showToast("Unknown login provider ❌", "danger");
      this.isSaving = false;
      return;
    }

    // =============================
    // 🔥 Persiapan payload
    // =============================
    const walletAddress =
      this.userAddress || localStorage.getItem("walletAddress");

    const body = {
      email: email,             // bisa null untuk provider local/google
      password: password,       // bisa null untuk provider local
      code: code || null,
      walletAddress,
    };

    try {
      const res: any = await this.http
        .post(`${environment.apiUrl}/auth/referral/apply-and-update`, body, {
          headers: { Authorization: `Bearer ${this.authToken}` },
        })
        .toPromise();

      if (res?.success) {
        this.showToast("Profile updated successfully ✅", "success");

        this.userService.setUser({
          email: res.email ?? email ?? userProfile.email,
          referral: res.referral ?? userProfile.referral ?? { code, isActive: true },
        });

        localStorage.removeItem("pendingReferralCode");

        if (this.referralResolver) {
          this.referralResolver("apply");
          this.referralResolver = null;
        }

        this.closeReferralModal();
      } else {
        console.warn("⚠️ Referral apply failed:", res?.error);
        this.showToast(res?.error || "Profile update failed ❌", "danger");
        this.isSaving = false;
      }

    } catch (err: any) {
      console.error("❌ Referral apply error:", err);
      const backendMsg =
        err?.error?.error ||
        err?.error?.message ||
        "Unknown error updating referral/profile ❌";

      this.showToast(backendMsg, "danger");
      this.isSaving = false;
    }
  }

  async saveAndConnectWallet() {
    this.isSaving = true;

    try {
      // 1️⃣ Connect wallet (Phantom)
      const addr: any = await this.connectWallet();

      // 🔒 Pastikan walletAddress selalu string
      const walletAddress: string =
        (typeof addr === "string" ? addr : "") ||
        localStorage.getItem("walletAddress") ||
        "";

      // 2️⃣ Validasi hasil connect wallet
      if (!walletAddress || walletAddress.trim() === "") {
        this.showToast("Wallet connection failed ❌", "danger");
        this.isSaving = false;
        return;
      }

      // 3️⃣ Simpan flag dan alamat wallet
      localStorage.setItem("walletConnected", "true");
      localStorage.setItem("walletAddress", walletAddress);

      // 4️⃣ Tutup modal
      await this.closeReferralModal();

      this.showToast("Wallet connected successfully 🎉", "success");

      // 5️⃣ Muat ulang data user (tanpa reload halaman)
      this.userService.getUser();
      this.userService.loadFromStorage();

    } catch (err) {
      console.error("❌ Error connecting wallet:", err);
      this.showToast("Failed to connect wallet. Please try again.", "danger");
    } finally {
      this.isSaving = false;
    }
  }

  // === Helper: Periksa kelengkapan profil user ===
  async checkProfileCompleteness() {
    this.userService.getUser();
    this.userService.loadFromStorage();
    await new Promise((r) => setTimeout(r, 300));

    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const provider = userProfile.authProvider || 'unknown';

    console.log('👤 [Profile Check Ready]:', userProfile);

    // =====================================================
    // STEP 1 — WAJIB connect wallet sekali (refresh Phantom)
    // =====================================================
    const alreadyConnected = localStorage.getItem('walletConnected') === 'true';

    if (!alreadyConnected) {
      console.warn('⚠️ User must reconnect wallet (session refresh required)');
      setTimeout(() => {
        console.log("🎯 Opening wallet-connect modal...");
        this.openReferralModal('wallet-connect');
      }, 200);
      return false;
    }

    // =====================================================
    // STEP 2 — Setelah connect wallet, cek email/password
    // =====================================================
    const hasEmail = !!(userProfile.email && userProfile.email.trim() !== '');
    const hasPassword = !!userProfile.hasPassword;

    // Provider: Phantom login → wajib isi email dan password
    if (provider === 'wallet' && !hasEmail) {
      console.warn('⚠️ Missing email for wallet provider');
      setTimeout(() => this.openReferralModal('wallet'), 200);
      return false;
    }

    // Provider: Google login → wajib set password setelah connect wallet
    if (provider === 'google' && !hasPassword) {
      console.warn('⚠️ Google user missing password');
      setTimeout(() => this.openReferralModal('google'), 200);
      return false;
    }

    console.log('✅ Profile OK:', {
      provider,
      email: userProfile.email,
      hasPassword,
    });

    return true;
  }
}