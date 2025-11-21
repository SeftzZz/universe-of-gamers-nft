import { Capacitor } from '@capacitor/core';
import { Component, AfterViewInit, NgZone, OnInit } from '@angular/core';
import { Auth } from './services/auth';
import { App } from '@capacitor/app';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { ToastController, LoadingController } from '@ionic/angular';
import { Phantom } from './services/phantom';
import { StatusBar, Style } from '@capacitor/status-bar';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { User } from './services/user';
import { GoogleLoginService } from './services/google-login-service';
import { GatchaService } from './services/gatcha';
import { NftService } from './services/nft.service';
import { WebSocket } from './services/websocket';
import { Wallet } from './services/wallet';

declare var bootstrap: any;
declare function btnmenu(): void;

/**
 * Helper log universal — tampil di console browser dan Android Logcat
 */
function nativeLog(tag: string, data: any) {
  const time = new Date().toISOString();
  const msg = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const prefix = Capacitor.isNativePlatform() ? '🟩' : '🟢';
  console.log(`${prefix} [${tag}] ${time} → ${msg}`);
}

// global keypair
export let dappKeys: nacl.BoxKeyPair | null = null;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements AfterViewInit, OnInit {
  userAddress: string = '';
  private loading: HTMLIonLoadingElement | null = null;

  private phantomFlow: 'connect' | 'signMessage' | null = null;
  private challengeNonce: string | null = null;
  private lastProcessedUrl: string | null = null;

  authToken: string | null = null;

  gatchaPacks: any[] = [];
  mintResult: any = null;
  txSig: string | null = null;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private auth: Auth,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private phantom: Phantom,
    private http: HttpClient,
    private userService: User,
    private googleLogin: GoogleLoginService,
    private ws: WebSocket,
    private gatchaService: GatchaService,
    private nftService: NftService,
    private walletService: Wallet,
  ) {
    // === Phantom resume listener ===
    App.addListener('resume', async () => {
      const lastUrl = localStorage.getItem('pendingPhantomUrl');
      if (lastUrl) {
        localStorage.removeItem('pendingPhantomUrl');
        this.handlePhantomUrl(lastUrl);
      }
    });

    this.listenPhantomCallback();

    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => setTimeout(() => this.bindMobileNav(), 50));

    this.initStatusBar();
  }

  ngOnInit() {
    this.googleLogin.init();
    this.ws.connect();
    this.checkPhantomWebBridge();
    setTimeout(() => this.listenPhantomCallback(), 300);
  }

  private checkPhantomWebBridge() {
    // hanya web, bukan native
    if (Capacitor.getPlatform() !== 'web') return;

    // jika phantom-web-bridge menyimpan data
    const pending = localStorage.getItem("pendingPhantomUrl");
    if (pending) {
      // alert(pending);
      this.handlePhantomUrl(pending);
    }
  }

  // === 1️⃣ Listen callback from Phantom ===
  listenPhantomCallback() {
    App.addListener('appUrlOpen', async (data: any) => {
      console.log('📡 [Phantom Callback Triggered]');
      console.log(JSON.stringify(data, null, 2));

      if (data?.url?.includes('phantom-callback')) {
        localStorage.setItem('pendingPhantomUrl', data.url);
        this.handlePhantomUrl(data.url);
      }
    });
  }

  // === 2️⃣ Handle returned deeplink ===
  async handlePhantomUrl(data: any) {
    const alertText = `[1] handlePhantomUrl CALLED\n${data}`;
    try { await navigator.clipboard.writeText(alertText); } catch {}
    // alert(alertText + "\n\n(copied)");

    let urlStr = typeof data === 'string' ? data : data?.url;

    // 🟣 FIX: Rebuild Phantom callback URL (bridge → phantom-callback://)
    if (urlStr.includes("phantom-web-bridge.html")) {
        const qs = urlStr.split("?")[1] || "";
        urlStr = "phantom-callback://callback?" + qs;

        // alert("[BRIDGE FIX]\nRebuilt callback:\n" + urlStr);
    }

    // alert(`[2] urlStr = ${urlStr}`);

    if (!urlStr || !urlStr.includes('phantom-callback')) {
      // alert(`[2a] SKIP — bukan phantom-callback`);
      nativeLog('PHANTOM_SKIP', data);
      return;
    }

    // ✅ Cegah pemrosesan URL yang sama berulang kali
    // ✅ Hindari skip callback valid
    if (this.lastProcessedUrl && this.lastProcessedUrl === urlStr && !urlStr.includes("signature")) {
      nativeLog('PHANTOM_DUPLICATE', '⏭️ Skipping early duplicate callback (no signature)');
      return;
    }
    this.lastProcessedUrl = urlStr;

    nativeLog('PHANTOM_URL_IN', urlStr);

    const url = new URL(urlStr);
    const params = url.searchParams;
    
    const debugParams = {
      hasData: params.has('data'),
      hasNonce: params.has('nonce'),
      hasPhantomPub: params.has('phantom_encryption_public_key'),
      rawKeys: Array.from(params.keys()),
    };
    nativeLog('PHANTOM_URL_DEBUG', debugParams);

    const encryptedData = params.get('data');
    const nonce = params.get('nonce');
    const phantom_pubkey_param = params.get('phantom_encryption_public_key');
    let phantom_pubkey = phantom_pubkey_param;

    // 🧩 Fallback jika Phantom tidak kirim ulang pubkey
    if (!phantom_pubkey) {
      const storedPubkey = localStorage.getItem('phantom_pubkey');
      if (storedPubkey) {
        phantom_pubkey = storedPubkey;
        nativeLog('PHANTOM_RECOVER_PUBKEY', {
          reason: 'missing from callback, reused from localStorage',
          phantom_pubkey,
        });
      } else {
        nativeLog('PHANTOM_ERROR', '❌ Missing Phantom public key and no stored fallback');
        return;
      }
    }

    const errorCode = params.get('errorCode');
    const errorMessage = params.get('errorMessage');

    nativeLog('PHANTOM_CALLBACK', {
      timestamp: new Date().toISOString(),
      encrypted: !!encryptedData,
      nonce,
      phantom_pubkey,
      errorCode,
      errorMessage,
    });

    if (errorCode || errorMessage) {
      nativeLog('PHANTOM_ERROR', { errorCode, errorMessage });
      alert(`Phantom error: ${errorMessage || errorCode}`);
      return;
    }

    if (!encryptedData || !nonce || !phantom_pubkey) {
      nativeLog('PHANTOM_ERROR', '❌ Missing params in Phantom callback');
      return;
    }

    try {
      // === Ambil secret key ===
      let secretKey: Uint8Array | null = null;
      try {
        secretKey = this.phantom.getSecretKey();
        nativeLog('PHANTOM_SECRET', '🔐 Using in-memory secretKey');
      } catch {
        const stored = localStorage.getItem('dappSecretKey');
        if (stored) {
          secretKey = bs58.decode(stored);
          this.phantom.restoreKeypairFromSecret(secretKey);
          nativeLog('PHANTOM_SECRET', '⚡ Restored secretKey from localStorage');
        }
      }

      if (!secretKey) {
        nativeLog('PHANTOM_ERROR', '❌ No secretKey for decrypt');
        return;
      }

      nativeLog('PHANTOM_STAGE', '🧮 Computing shared secret...');
      const sharedSecret = nacl.box.before(bs58.decode(phantom_pubkey), secretKey);
      nativeLog('PHANTOM_STAGE', '🔓 Decrypting payload...');

      const decrypted = nacl.box.open.after(
        bs58.decode(encryptedData),
        bs58.decode(nonce),
        sharedSecret
      );

      if (!decrypted) {
        nativeLog('PHANTOM_ERROR', '❌ Failed to decrypt Phantom payload — sharedSecret mismatch');
        return;
      }

      const payloadStr = new TextDecoder().decode(decrypted);
      nativeLog('PHANTOM_RAW', payloadStr);

      let payload: any;
      try {
        payload = JSON.parse(payloadStr);
      } catch {
        nativeLog('PHANTOM_ERROR', { invalidJSON: payloadStr });
        return;
      }

      nativeLog('PHANTOM_PAYLOAD', payload);

      // === CONNECT RESULT ===
      if (payload.session && payload.public_key && !payload.signature) {
        this.userAddress = payload.public_key;
        nativeLog('PHANTOM_CONNECT', `✅ Connected: ${this.userAddress}`);

        localStorage.setItem('phantom_pubkey', phantom_pubkey);
        localStorage.setItem('phantomSession', payload.session);
        localStorage.setItem('phantomConnectedAt', Date.now().toString());

        alert(`✅ Phantom Connected!\n\nAddress:\n${this.userAddress}`);

        const nonceFromLocal = localStorage.getItem('lastNonce') || '';
        this.loginWithBackend(this.userAddress);

      // === SIGN RESULT ===
      } else if (payload.signature) {
        nativeLog('PHANTOM_SIGN', `✍️ Signature: ${payload.signature}`);
        const backendNonce = localStorage.getItem('backendChallengeNonce') || '';
        this.finishLogin(this.userAddress, payload.signature, backendNonce);

      // === UNKNOWN PAYLOAD ===
      } else if (payload.transaction && localStorage.getItem("phantomFlow") === "gatcha") {
        const signedTxBase58 = payload.transaction;
        const packId = localStorage.getItem("pendingPackId");
        const mintAddress = localStorage.getItem("pendingMintAddress");

        nativeLog("PHANTOM_GATCHA_TX_SIGNED", { signedTxBase58, packId, mintAddress });

        try {
          const confirmResp: any = await this.http.post(
            `${environment.apiUrl}/gatcha/${packId}/confirm`,
            { mintAddress, signedTx: signedTxBase58 },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          ).toPromise();

          nativeLog("GATCHA_CONFIRM_SUCCESS", confirmResp);

          // ✅ Kirim event hasil gatcha ke seluruh app
          const nft = confirmResp.nft;
          if (nft) {
            nativeLog("🎉 NFT_MINTED", { name: nft.name, image: nft.image });
            localStorage.setItem("lastMintedNFT", JSON.stringify(nft));
            this.gatchaService.gatchaResult$.next(nft);
          }

          // ✅ Notifikasi sukses
          const toast = await this.toastCtrl.create({
            message: `🎉 Mint success! NFT: ${nft?.name || mintAddress}`,
            duration: 4000,
            color: "success",
            position: "top",
          });
          toast.present();
        } catch (err: any) {
          nativeLog("GATCHA_CONFIRM_FAIL", err.message);
          const toast = await this.toastCtrl.create({
            message: "❌ Failed to confirm Gatcha transaction.",
            duration: 4000,
            color: "danger",
            position: "top",
          });
          toast.present();
        }
      // === SELL CONFIRM ===
      } else if (payload.transaction && localStorage.getItem("phantomFlow") === "sell") {
        const signedTxBase58 = payload.transaction;
        const mintAddress = localStorage.getItem("pendingMintAddress");

        nativeLog("PHANTOM_SELL_TX_SIGNED", { signedTxBase58, mintAddress });

        try {
          const confirmResp: any = await this.http.post(
            `${environment.apiUrl}/auth/nft/${mintAddress}/confirm`,
            { signedTx: signedTxBase58 },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          ).toPromise();

          nativeLog("SELL_CONFIRM_SUCCESS", confirmResp);

          // ✅ Emit event ke seluruh aplikasi
          const nftUpdate = {
            mintAddress,
            price: localStorage.getItem("pendingSellPrice"),
            symbol: localStorage.getItem("pendingSellSymbol"),
            txSig: confirmResp.txSignature || null,
          };
          this.nftService.nftSold$.next(nftUpdate);

          // ✅ Toast notifikasi
          const toast = await this.toastCtrl.create({
            message: `✅ NFT listed successfully at ${nftUpdate.price} ${nftUpdate.symbol}`,
            duration: 4000,
            color: "success",
            position: "top",
          });
          toast.present();

          // 🧹 Cleanup context
          localStorage.removeItem("phantomFlow");
          localStorage.removeItem("pendingMintAddress");
          localStorage.removeItem("pendingSellPrice");
          localStorage.removeItem("pendingSellSymbol");

        } catch (err: any) {
          nativeLog("SELL_CONFIRM_FAIL", err.message);
          const toast = await this.toastCtrl.create({
            message: "❌ Failed to confirm sell transaction.",
            duration: 4000,
            color: "danger",
            position: "top",
          });
          toast.present();
        }
      } else if (payload.transaction && localStorage.getItem("phantomFlow") === "buy") {
        const signedTxBase58 = payload.transaction;
        const mintAddress = localStorage.getItem("pendingMintAddress");

        nativeLog("PHANTOM_BUY_TX_SIGNED", { signedTxBase58, mintAddress });

        try {
          const confirmResp: any = await this.http.post(
            `${environment.apiUrl}/auth/nft/${mintAddress}/confirm-buy`,
            { signedTx: signedTxBase58 },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          ).toPromise();

          nativeLog("BUY_CONFIRM_SUCCESS", confirmResp);

          const nft = confirmResp.nft || { mintAddress };
          const price = localStorage.getItem("pendingBuyPrice");
          const symbol = localStorage.getItem("pendingBuySymbol");

          // Emit event
          this.nftService.nftBought$.next({ nft, price, symbol });

          const toast = await this.toastCtrl.create({
            message: `NFT purchased successfully (${nft.name})`,
            duration: 4000,
            color: "success",
            position: "top",
          });
          toast.present();

          localStorage.removeItem("phantomFlow");
          localStorage.removeItem("pendingMintAddress");
          localStorage.removeItem("pendingBuyPrice");
          localStorage.removeItem("pendingBuySymbol");

        } catch (err: any) {
          nativeLog("BUY_CONFIRM_FAIL", err.message);
          const toast = await this.toastCtrl.create({
            message: "❌ Failed to confirm buy transaction.",
            duration: 4000,
            color: "danger",
            position: "top",
          });
          toast.present();
        }
      } else if (payload.transaction && localStorage.getItem("phantomFlow") === "withdraw") {
        const signedTxBase58 = payload.transaction;
        const txId = localStorage.getItem("pendingWithdrawTxId");

        nativeLog("PHANTOM_WITHDRAW_TX_SIGNED", signedTxBase58);

        try {
          const confirmResp: any = await this.http.post(
            `${environment.apiUrl}/withdraw/confirm`,
            { txId, signedTx: signedTxBase58 },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          ).toPromise();

          nativeLog("WITHDRAW_CONFIRM_SUCCESS", confirmResp);

          const amount = localStorage.getItem("pendingWithdrawAmount") || "unknown";

          const toast = await this.toastCtrl.create({
            message: `✅ Withdraw successful! ${amount} SOL sent.`,
            duration: 4000,
            color: "success",
            position: "top",
          });
          toast.present();

          // buka link explorer
          if (confirmResp.explorer) {
            window.open(confirmResp.explorer, "_blank");
          }

          // bersihkan localStorage context
          localStorage.removeItem("phantomFlow");
          localStorage.removeItem("pendingWithdrawAmount");
        } catch (err: any) {
          nativeLog("WITHDRAW_CONFIRM_FAIL", err.message);
          const toast = await this.toastCtrl.create({
            message: "❌ Failed to confirm withdraw transaction.",
            duration: 4000,
            color: "danger",
            position: "top",
          });
          toast.present();
        }
      } else {
        nativeLog('PHANTOM_WARN', { unknownPayload: payload });
      }

      // Bersihkan cache flow
      localStorage.removeItem("phantomFlow");
      localStorage.removeItem("pendingMintAddress");
      // localStorage.removeItem("pendingPackId");

    } catch (err: any) {
      nativeLog('PHANTOM_EXCEPTION', {
        message: err?.message || 'Unknown',
        stack: err?.stack,
      });
    }
  }

  // === 3️⃣ Request challenge and sign ===
  async loginWithBackend(address: string) {
    nativeLog('PHANTOM_BACKEND', `Requesting challenge for ${address}`);

    const challenge: any = await this.http
      .get(`${environment.apiUrl}/auth/wallet/challenge?address=${address}`)
      .toPromise();

    nativeLog('PHANTOM_CHALLENGE', challenge);

    localStorage.setItem('backendChallengeNonce', challenge.nonce);

    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

    if (Capacitor.getPlatform() === 'web' && isMobile) {

      const webBridge = 'https://marketplace.universeofgamers.io/phantom-web-bridge.html';

      // --- RELOAD DATA YANG SUDAH ADA SETELAH CONNECT ---
      const session = localStorage.getItem('phantomSession');
      const phantomPubKey = localStorage.getItem('phantom_pubkey');
      const secretKeyStored = this.phantom.getSecretKey(); // in-memory keypair

      if (!session || !phantomPubKey || !secretKeyStored) {
        alert('❌ Missing Phantom session data. Please connect wallet first.');
        return;
      }

      // --- DECODE: phantom public key + secret key ---
      const secretKey = secretKeyStored;
      const phantomPubKeyBytes = bs58.decode(phantomPubKey);

      // --- NONCE (HARUS BARU SETIAP SIGN) ---
      const nonceArr = nacl.randomBytes(24);
      const nonceB58 = bs58.encode(nonceArr);

      // --- DAPP PUBLIC KEY UNTUK ENKRIPSI ---
      const dappPubKey = this.phantom.getPublicKeyB58();

      // --- COMPUTE SHARED SECRET ---
      const sharedSecret = nacl.box.before(phantomPubKeyBytes, secretKey);

      // --- ENCODE PESAN ---
      const messageBytes = new TextEncoder().encode(challenge.message);
      const messageB58 = bs58.encode(messageBytes);

      // --- PAYLOAD untuk Phantom ---
      const payloadObj = {
        session: session,
        message: messageB58,
        display: 'utf8'
      };

      const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
      const encryptedPayload = nacl.box.after(payloadBytes, nonceArr, sharedSecret);
      const payloadB58 = bs58.encode(encryptedPayload);

      // === SIGN URL (MOBILE WEB) ===
      const signUrl =
        `https://phantom.app/ul/v1/signMessage?` +
        `dapp_encryption_public_key=${dappPubKey}` +
        `&redirect_link=${encodeURIComponent(webBridge)}` +
        `&nonce=${nonceB58}` +
        `&payload=${payloadB58}`;

      // === OPEN VIA SAME DOMAIN BRIDGE (NO NEW TAB) ===
      const openUrl = `${webBridge}?target=${encodeURIComponent(signUrl)}`;

      console.log("🌐 Launching Phantom SIGN (mobile web):", openUrl);

      localStorage.setItem('phantomFlow', 'sign-web');
      window.location.href = openUrl;
      return;
    }

    if (Capacitor.getPlatform() === 'web') {
      // 🖥️ desktop extension flow
      const provider = (window as any).solana;
      if (!provider?.isPhantom) {
        nativeLog('PHANTOM_ERROR', 'Phantom extension not found');
        return;
      }

      const messageBytes = new TextEncoder().encode(challenge.message);
      const signed = await provider.signMessage(messageBytes, 'utf8');
      const signature = signed.signature ? bs58.encode(signed.signature) : '';
      this.finishLogin(address, signature, challenge.nonce);
    } else {
      // 📱 mobile deeplink sign flow
      try {
        const dappPubKey = this.phantom.getPublicKeyB58();
        const PHANTOM_REDIRECT = 'com.universeofgamers.nft://phantom-callback';
        const phantom_pubkey = localStorage.getItem('phantom_pubkey');
        const secretKey = this.phantom.getSecretKey();
        if (!phantom_pubkey || !secretKey) throw new Error('Missing Phantom keys');

        const nonceArr = nacl.randomBytes(24);
        const nonceB58 = bs58.encode(nonceArr);
        localStorage.setItem('lastNonce', nonceB58);

        const session = localStorage.getItem('phantomSession');
        if (!session) {
          alert('Please connect Phantom first');
          return;
        }

        try {
          const sharedSecret = nacl.box.before(bs58.decode(phantom_pubkey), secretKey);
          nativeLog('PHANTOM_STAGE', '🧮 Computing shared secret...');
          nativeLog('PHANTOM_SHARED_SECRET', {
            phantom_pubkey,
            dapp_pubkey: bs58.encode(this.phantom.getKeypair().publicKey),
            sharedSecret_b58: bs58.encode(sharedSecret.slice(0, 16)) + '...',
          });

          // 1. Ubah pesan string menjadi Uint8Array
          const messageBytes = new TextEncoder().encode(challenge.message);

          // 2. Base58-encode array bytes pesan
          const messageB58 = bs58.encode(messageBytes);

          const payloadObj = {
            session: session,
            // Gunakan B58-encoded message di sini
            message: messageB58, 
            // Hapus pembersihan string: `message` di sini TIDAK boleh di-replace/trim
            display: 'utf8', // Ini menginstruksikan Phantom untuk mendekode B58 sebagai UTF-8
          };
          nativeLog('PHANTOM_PAYLOAD_OBJECT', payloadObj);

          const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
          nativeLog('PHANTOM_STAGE', `🧱 Encoding payload to bytes (${payloadBytes.length} bytes)`);

          const encryptedPayload = nacl.box.after(payloadBytes, nonceArr, sharedSecret);
          nativeLog('PHANTOM_STAGE', `🔐 Encrypted payload (${encryptedPayload.length} bytes)`);

          const payloadB58 = bs58.encode(encryptedPayload);
          nativeLog('PHANTOM_ENCRYPTED_B58', {
            nonce_b58: bs58.encode(nonceArr),
            payload_b58_preview: payloadB58.slice(0, 60) + '...',
          });

          // ===  ✅ Build sign URL
          const baseSignUrl =
            `https://phantom.app/ul/v1/signMessage?` +
            `dapp_encryption_public_key=${dappPubKey}` +
            // Tambahkan encodeURIComponent untuk redirect_link
            `&redirect_link=${encodeURIComponent(PHANTOM_REDIRECT)}` +
            `&nonce=${bs58.encode(nonceArr)}` +
            `&payload=${payloadB58}`;

          // ===  ✅ Tambahkan relay URL untuk bypass WebView restriction
          const appUrl = 'https://universeofgamers.io';
          const relay = 'https://universeofgamers.io/phantom-redirect.html';
          const relayUrl = `${relay}?target=${encodeURIComponent(baseSignUrl)}&app=${encodeURIComponent(appUrl)}`;

          nativeLog('PHANTOM_SIGN_URL', relayUrl);

          // ===  ✅ Redirect ke relay untuk Android/iOS
          if (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') {
            localStorage.setItem("phantomFlow", "sign");
            setTimeout(() => {
              window.location.href = relayUrl;
            }, 500);
          } else {
            // untuk desktop browser
            window.open(baseSignUrl, '_blank');
          }
        } catch (err: any) {
          nativeLog('PHANTOM_SIGN_ERROR', err.message);
        }

      } catch (err: any) {
        nativeLog('PHANTOM_SIGN_ERROR', err.message);
      }
    }
  }

  // === 4️⃣ Finish login ===
  finishLogin(address: string, signature: string | null, nonce: string) {
    nativeLog('PHANTOM_FINISH_LOGIN', {
      address,
      signature_preview: signature?.slice(0, 20) + '...',
      nonce,
    });

    this.auth.loginWithWallet(
      {
        provider: 'phantom',
        address,
        name: `Phantom User ${nonce}`,
        signature: signature || '',
        nonce,
      },
      this.authToken || undefined // dikirim kalau user sudah login
    ).subscribe({
      next: async (res) => {
        nativeLog('✅ [PHANTOM_LOGIN_SUCCESS]', res);

        // =====================================================
        // 🔐 Simpan token & ID user
        // =====================================================
        if (res.token && res.authId) {
          this.auth.setToken(res.token, res.authId);
          localStorage.setItem('userId', res.authId);
        }

        // =====================================================
        // 🧩 Siapkan avatar
        // =====================================================
        const avatarUrl = res.avatar
          ? `${environment.baseUrl}${res.avatar}`
          : 'assets/images/app-logo.jpeg';

        // =====================================================
        // 👤 Update user global ke service
        // =====================================================
        this.userService.setUser({
          name: res.name,
          email: res.email,
          notifyNewItems: res.notifyNewItems || false,
          notifyEmail: res.notifyEmail || false,
          avatar: avatarUrl,
          role: res.role,
          player: res.player,
          referral: res.referral,
          custodialWallets: res.custodialWallets || [],
          wallets: res.wallets || [],
          authProvider: res.authProvider || 'wallet', // sesuai backend
        });

        // =====================================================
        // 💾 Simpan wallet list
        // =====================================================
        const allWallets = [
          ...(res.wallets || []),
          ...(res.custodialWallets || []),
        ];

        localStorage.setItem('wallets', JSON.stringify(allWallets));

        // tentukan wallet aktif
        let walletAddr =
          res.wallets?.[0]?.address ||
          res.custodialWallets?.[0]?.address ||
          address;

        localStorage.setItem('walletAddress', walletAddr);
        this.walletService.setWallets(allWallets);
        this.walletService.setActiveWallet(walletAddr);

        // =====================================================
        // 🧭 Redirect dinamis (pending redirect / default)
        // =====================================================
        const pendingRedirect = localStorage.getItem('pendingConnectRedirect');
        if (pendingRedirect) {
          localStorage.removeItem('pendingConnectRedirect');
          nativeLog('🔁 Redirecting to pending page:', pendingRedirect);
          window.location.href = pendingRedirect;
        } else {
          nativeLog('➡️ Redirecting to /market-layout/my-nfts', '');
          window.location.href = '/market-layout/my-nfts';
        }
      },

      error: (err) => {
        // this.dismissLoading?.(); // jika ada spinner, pastikan dimatikan
        console.error('❌ [PHANTOM_LOGIN_FAIL]', err.error?.error);

        // 🔹 Deteksi error spesifik dari backend
        let message = 'Wallet login failed';
        if (err.error?.error?.includes('address is already linked')) {
          message = 'This wallet address is already linked, required email and password.';
        } else if (err.error?.error?.includes('Invalid signature')) {
          message = 'Invalid signature, please re-connect wallet';
        } else if (err.error?.error?.includes('Invalid or expired nonce')) {
          message = 'Session expired, please try again';
        }

        this.showToast(message, 'danger');
        nativeLog('⚠️ Wallet login failed:', message);
      },
    });
  }

  // === Misc ===
  async initStatusBar() {
    try {
      await StatusBar.hide();
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#121212' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch (err) {
      nativeLog('STATUSBAR', err);
    }
  }

  private bindMobileNav() {
    const header = document.querySelector('#header_main');
    if (!header) return;
    const navWrap = header.querySelector('.mobile-nav-wrap');
    const btn = header.querySelector('.mobile-button');
    const closeBtn = header.querySelector('.mobile-nav-close');
    const overlay = header.querySelector('.overlay-mobile-nav');

    btn?.removeEventListener('click', this.toggleNav);
    closeBtn?.removeEventListener('click', this.closeNav);
    overlay?.removeEventListener('click', this.closeNav);

    btn?.addEventListener('click', this.toggleNav.bind(this));
    closeBtn?.addEventListener('click', this.closeNav.bind(this));
    overlay?.addEventListener('click', this.closeNav.bind(this));
  }

  private toggleNav() {
    document.querySelector('#header_main .mobile-nav-wrap')?.classList.toggle('active');
  }

  private closeNav() {
    document.querySelector('#header_main .mobile-nav-wrap')?.classList.remove('active');
  }

  ngAfterViewInit() {
    setTimeout(() => this.runTemplate());
    this.bindMobileNav();
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => setTimeout(() => this.runTemplate()));
  }

  private runTemplate() {
    (window as any).initTemplate && (window as any).initTemplate();
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