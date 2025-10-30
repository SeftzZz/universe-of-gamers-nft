import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Idl } from '../../services/idl';
import { Wallet } from '../../services/wallet';
import { Auth } from '../../services/auth';
import { Modal } from '../../services/modal';
import { User, UserProfile } from '../../services/user';
import { WebSocket } from '../../services/websocket';
const web3 = require('@solana/web3.js');

import { Router, ActivatedRoute } from '@angular/router';

import { ActionSheetController } from '@ionic/angular';
import { ToastController, LoadingController } from '@ionic/angular';
import {
  trigger,
  transition,
  style,
  animate
} from '@angular/animations';

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { IonContent } from '@ionic/angular';

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

// Tambahkan interface Creator
interface Creator {
  owner: string;
  count: number;
  avatar: string;   // bisa pakai default
  name?: string;    // optional, bisa diisi dari DB kalau ada relasi
}

@Component({
  selector: 'app-nft-detail',
  templateUrl: './nft-detail.page.html',
  styleUrls: ['./nft-detail.page.scss'],
  standalone: false,
})
export class NftDetailPage implements OnInit {
  program: any;
  userAddress: string | null = null;

  mintAddress: string | null = null;
  metadata: any = null;        // hasil metadata dari backend
  loading: boolean = false;    // indikator loading

  activeWallet: string = '';

  wallets: any[] = [];

  name: string = '';
  email: string = '';
  oldPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  notifyNewItems: boolean = false;
  notifyEmail: boolean = false;
  avatarFile: File | null = null;
  avatar: string = '';

  balance: number | null = null;
  balanceUsd: number | null = null;
  totalBalanceUsd: number | null = null;
  totalBalanceSol: number | null = null;
  private lastBalanceUsd: number | null = null;
  trend: number = 0;          // -1 = turun, 0 = stabil, 1 = naik
  percentChange: number = 0;

  tokens: any[] = [];
  showSendModal = false;
  isClosingSend = false;
  recipient: string = '';
  amount: number | null = null;
  selectedToken: any = null;
  tokenSearch: string = '';
  txSig: string | null = null;   // simpan signature tx
  isSending: boolean = false;    // flag loading
  isClosingStep = false;

  authToken: string | null = null;

  isSellMode: boolean = false;

  showSellModal = false;
  isClosingSell = false;
  isListing = false;

  sellPrice: number = 0;
  sellRoyalty: number = 0;

  collections: Collection[] = [];

  nftDB: any[] = []; // daftar NFT dari DB
  runesDB: any[] = [];   // list rune dari DB
  latestNfts: any[] = [];
  runeMap: Record<string, any[]> = {};
  nftBC: any[] = [];     //  // list NFT dari Block Chain
  nftRuneBC: any[] = [];
  favorites: Set<string> = new Set();

  // === User Info ===
  userName: string = '';
  userAvatar: string = 'assets/images/avatar/avatar-small-01.png';
  userRole: string | null = null;

  // === NFT Related ===
  fetchnft: INftItem[] = []; 
  isSell: boolean = false;

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

  @ViewChild(IonContent, { static: false }) ionContent!: IonContent;
  scrollIsActive = false;

  minSellPrice: number = 0.0001;
  uogToSolRate: number = 0; // rate 1 UOG → SOL
  uogToUsdRate: number = 0; // rate 1 UOG → USDC
  solToUogRate: number = 0; // rate 1 SOL → UOG
  usdcToSolRate: number = 0;
  usdcToUogRate: number = 0;
  solToUsdcRate: number = 0;  // 1 SOL = ? USDC
  listedPrice: number = 0;
  listedSymbol: string = "SOL";
  packPriceSOL: number = 0;
  // 🧩 Tambahkan variabel ini di dalam class NftDetailPage
  nftListingPrice: {
    amount: number;
    symbol: string;
    usdValue: number;
  } = {
    amount: 0,
    symbol: "SOL",
    usdValue: 0
  };

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private toastCtrl: ToastController,    
    private router: Router, 
    private actionSheetCtrl: ActionSheetController,
    private loadingCtrl: LoadingController,
    private auth: Auth,
    private walletService: Wallet,
    private modalService: Modal,
    private userService: User,
    private ws: WebSocket,
  ) {}

  async ngOnInit() {
    // 🔹 Pantau wallet aktif
    this.walletService.getActiveWallet().subscribe(async (addr) => {
      if (addr) {
        this.activeWallet = addr;
        console.log('🔄 Active wallet updated in Home:', addr);
        await this.refreshAllData();
      }
    });

    // 🔹 Pantau profil user
    this.userService.getUser().subscribe(profile => {
      this.name = profile.name;
      this.email = profile.email;
      this.notifyNewItems = profile.notifyNewItems;
      this.notifyEmail = profile.notifyEmail;
      this.avatar = profile.avatar;
    });

    // 🔹 Cek halaman NFT Detail (mintAddress)
    const mintAddress = this.route.snapshot.paramMap.get('mintAddress');
    if (mintAddress) {
      this.mintAddress = mintAddress;
      console.log('🧩 NFT Detail page detected:', mintAddress);
      // await this.loadMetadata(mintAddress);
    } else {
      this.mintAddress = null; // bukan di halaman detail
    }

    // 🔹 Listener WebSocket
    this.ws.messages$.subscribe(async (msg) => {
      if (!msg) return;

      // === 🔁 RELIST EVENT ===
      if (msg.type === 'relist-update') {
        console.log('🔥 NFT relisted:', msg);
        await this.refreshAllData();
      }

      // === ❌ DELIST EVENT ===
      if (msg.type === 'delist-update') {
        const delistedMint = msg.nft?.mintAddress;
        const delistedName = msg.nft?.name || 'NFT';
        console.log('🔥 NFT delisted:', delistedMint);

        // ✅ Hanya halaman detail NFT yang cocok yang akan bereaksi
        if (this.mintAddress && delistedMint === this.mintAddress) {
          // 🔔 Tampilkan alert dan redirect
          alert(`🧨 ${delistedName} Delisting.`);
          this.router.navigate(['/market-layout/all-collection']);
        }

        // Pengguna lain tetap hanya refresh data background
        await this.refreshAllData();
      }
    });

    // 🔹 Cek query param sell
    this.route.queryParams.subscribe(params => {
      this.isSellMode = params['sell'] === '1';
      console.log("🛒 Sell mode:", this.isSellMode);
    });

    const saved = localStorage.getItem('token');
    if (saved) this.authToken = saved;
  }

  /** 🔄 Helper refresh data global */
  private async refreshAllData() {
    await this.loadUsers();
    await this.loadTokens();
    await this.updateBalance();
    await this.loadTopCreators();
    await this.loadNftHistory();
    await this.fetchRates();
  }

  async ionViewWillEnter() {
    // this.program = await this.idlService.loadProgram();

    this.walletService.getActiveWallet().subscribe(async (addr) => {
      if (addr) {
        this.activeWallet = addr;
        console.log('🔄 Active wallet updated in Home:', addr);

        // refresh data setiap kali wallet diganti
        await this.loadUsers();
        await this.loadTokens();
        await this.updateBalance();
        await this.loadTopCreators();
        await this.loadNftHistory();
        await this.fetchRates();              // <-- rate dulu
        const mintAddress = this.route.snapshot.paramMap.get('mintAddress');
        if (mintAddress) {
          await this.loadListingPrice(mintAddress);  // <-- baru hitung harga NFT
        }
      }
    });

    // subscribe ke UserService agar avatar langsung update
    this.userService.getUser().subscribe(profile => {
      this.name = profile.name;
      this.email = profile.email;
      this.notifyNewItems = profile.notifyNewItems;
      this.notifyEmail = profile.notifyEmail;
      this.avatar = profile.avatar;
    });

    const mintAddress = this.route.snapshot.paramMap.get('mintAddress'); // ✅ pakai mintAddress
    if (mintAddress) {
      this.mintAddress = mintAddress;
      await this.loadMetadata(mintAddress);
    }

    // ✅ cek apakah masuk dengan query param sell
    this.route.queryParams.subscribe(params => {
      this.isSellMode = params['sell'] === '1';
      console.log("🛒 Sell mode:", this.isSellMode);
    });

    const saved = localStorage.getItem('token');
    if (saved) this.authToken = saved;
  }

  async loadMetadata(mintAddress: string) {
    this.loading = true;
    try {
      const raw = await this.http
        .get<any>(`${environment.apiUrl}/nft/${mintAddress}/onchain`)
        .toPromise();

      // ✅ Simpan harga minimum dari chain
      this.minSellPrice = raw.minPrice;

      // ✅ Auto set harga jual default = min price
      this.sellPrice = this.minSellPrice;

      // Normalisasi metadata
      this.metadata = {
        ...raw,
        symbol: raw.symbol || "UOG",
        price: raw.price,
        seller_fee_basis_points: raw.royalty || 0,
        attributes: [
          { trait_type: "Level", value: raw.level },
          { trait_type: "HP", value: raw.hp },
          { trait_type: "ATK", value: raw.atk },
          { trait_type: "DEF", value: raw.def },
          { trait_type: "SPD", value: raw.spd },
          { trait_type: "Crit Rate", value: (raw.critRate ?? 0) + "%" },
          { trait_type: "Crit Dmg", value: (raw.critDmg ?? 0) + "%" },
        ],
        properties: {
          creators: [{ address: raw.owner }],
        },
        history: raw.history || [],
      };

      console.log("✅ NFT Metadata normalized:", this.metadata);
      console.log("💰 On-chain minSellPrice:", this.minSellPrice);
    } catch (err) {
      console.error("❌ Error loading metadata:", err);
      const toast = await this.toastCtrl.create({
        message: "Failed to load NFT metadata",
        duration: 4000,
        color: "danger",
        position: "top",
      });
      toast.present();
    } finally {
      this.loading = false;
    }
  }

  /** Copy link detail NFT ke clipboard */
  async copyLink() {
    const url = `${window.location.origin}/nft-detail/${this.mintAddress}`;
    try {
      await navigator.clipboard.writeText(url);
      const toast = await this.toastCtrl.create({
        message: '✅ Link copied to clipboard!',
        duration: 2000,
        color: 'success',
        position: 'top'
      });
      toast.present();
    } catch (err) {
      console.error('❌ Copy failed', err);
    }
  }

  /** Refresh metadata di backend lalu reload */
  async refreshMetadata() {
    try {
      await this.http
        .post(`${environment.apiUrl}/nft/${this.mintAddress}/onchain`, {})
        .toPromise();

      if (this.mintAddress) {
        await this.loadMetadata(this.mintAddress);
      }

      const toast = await this.toastCtrl.create({
        message: '✅ Metadata refreshed successfully!',
        duration: 2000,
        color: 'success',
        position: 'top'
      });
      toast.present();
    } catch (err) {
      console.error('❌ Failed to refresh metadata:', err);
      const toast = await this.toastCtrl.create({
        message: '❌ Failed to refresh metadata',
        duration: 2000,
        color: 'danger',
        position: 'top'
      });
      toast.present();
    }
  }

  shortenUrl(addr: string) {
    return addr.slice(0, 20) + '...' + addr.slice(-4);
  }

  shortenAddress(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  // === Token ===
  async loadTokens() {
    if (!this.activeWallet) return;
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/tokens/${this.activeWallet}`)
        .toPromise();

      const allowedMints = [
        'So11111111111111111111111111111111111111111', // SOL
        'B6VWNAqRu2tZcYeBJ1i1raw4eaVP4GrkL2YcZLshbonk', // UOG
      ];

      this.tokens = (resp.tokens || [])
        .filter((t: any) => allowedMints.includes(t.mint))
        .map((t: any) => ({
          ...t,
          selectable: t.mint === 'B6VWNAqRu2tZcYeBJ1i1raw4eaVP4GrkL2YcZLshbonk', // hanya SOL yang bisa dipilih
        }));

      // Simpan hasilnya ke localStorage
      localStorage.setItem('walletTokens', JSON.stringify(this.tokens));

      console.log('💰 Filtered wallet tokens (SOL & USDC only):', this.tokens);
    } catch (err) {
      console.error('❌ Error fetch tokens from API', err);
      this.router.navigateByUrl('/tabs/offline');
    }
  }

  async updateBalance() {
    if (!this.activeWallet) return;
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/balance/${this.activeWallet}`)
        .toPromise();

      this.balance = resp.solBalance;
      this.balanceUsd = resp.usdValue;
      this.trend = resp.trend ?? 0;
      this.percentChange = resp.percentChange ?? 0;

    } catch (err) {
      console.error('Error fetch balance from API', err);
      this.router.navigateByUrl('/tabs/offline');
    }
  }

  async toggleSendModal() {
    this.showSendModal = true;
    await this.loadTokens();
    await this.updateBalance();
  }

  selectToken(token: any) {
    this.selectedToken = token;
  }

  resetSendModal() {
    this.selectedToken = null;
    this.txSig = null;
    this.isSending = false;
    this.showSendModal = false;
    // this.toggleSendModal();
  }

  async buyNft(paymentMint: string) {
    const mintAddress = this.route.snapshot.paramMap.get('mintAddress'); 
    if (!mintAddress) return;

    try {
      this.isSending = true;
      this.txSig = null;

      // 🔹 Determine listing token and buyer token
      const listingSymbol = this.metadata?.paymentSymbol || "SOL"; // the token used for listing
      const buyerToken = this.filteredTokens.find(t => t.mint === paymentMint);
      const buyerSymbol = buyerToken?.symbol || "SOL";

      let finalPrice = this.metadata?.price || 0;

      // === 💱 PRICE CONVERSION MATRIX ===
      // (listingSymbol → buyerSymbol)

      // USDC → SOL
      if (listingSymbol === "USDC" && buyerSymbol === "SOL") {
        finalPrice = finalPrice * (this.usdcToSolRate || 0);
        console.log(`💱 Converted price: ${this.metadata?.price} USDC → ${finalPrice} SOL`);
      }

      // SOL → USDC
      if (listingSymbol === "SOL" && buyerSymbol === "USDC") {
        finalPrice = finalPrice * (this.solToUsdcRate || 0);
        console.log(`💱 Converted price: ${this.metadata?.price} SOL → ${finalPrice} USDC`);
      }

      // UOG → USDC
      if (listingSymbol === "UOG" && buyerSymbol === "USDC") {
        finalPrice = finalPrice * (this.uogToUsdRate || 0);
        console.log(`💱 Converted price: ${this.metadata?.price} UOG → ${finalPrice} USDC`);
      }

      // USDC → UOG
      if (listingSymbol === "USDC" && buyerSymbol === "UOG") {
        finalPrice = finalPrice * (this.usdcToUogRate || 0);
        console.log(`💱 Converted price: ${this.metadata?.price} USDC → ${finalPrice} UOG`);
      }

      // SOL → UOG
      if (listingSymbol === "SOL" && buyerSymbol === "UOG") {
        const solToUsd = this.solToUsdcRate || 0;
        const usdToUog = this.usdcToUogRate || 0;
        finalPrice = finalPrice * solToUsd * usdToUog;
        console.log(`💱 Converted price: ${this.metadata?.price} SOL → ${finalPrice} UOG`);
      }

      // UOG → SOL
      if (listingSymbol === "UOG" && buyerSymbol === "SOL") {
        const uogToUsd = this.uogToUsdRate || 0;
        const usdToSol = this.usdcToSolRate || 0;
        finalPrice = finalPrice * uogToUsd * usdToSol;
        console.log(`💱 Converted price: ${this.metadata?.price} UOG → ${finalPrice} SOL`);
      }

      // === 🪙 Send to backend ===
      const buyRes: any = await this.http
        .post(
          `${environment.apiUrl}/auth/nft/${mintAddress}/buy?demo=false`,
          {
            user: this.activeWallet,
            paymentMint: paymentMint,
            price: finalPrice, // ✅ adjusted to buyer token
            name: this.metadata?.name,
            symbol: buyerSymbol,
            uri: this.metadata?.uri,
          },
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        )
        .toPromise();

      if (!buyRes.signature) throw new Error("❌ No signature returned from backend");
      this.txSig = buyRes.signature;

      // 🔁 Refresh data
      await this.updateBalance();
      await this.loadTokens();
      await this.loadMetadata(mintAddress);

      const toast = await this.toastCtrl.create({
        message: `NFT purchase successful! ✅`,
        duration: 2500,
        position: 'top',
        color: 'success',
        icon: 'checkmark-circle-outline',
        cssClass: 'custom-toast'
      });
      await toast.present();

      console.log("✅ Transaction confirmed:", buyRes.signature);
      console.log("🧾 Payment token:", buyerSymbol, "| Price sent:", finalPrice);

    } catch (err: any) {
      await this.updateBalance();
      await this.loadTokens();
      console.error("❌ buyNft error:", err);

      let errorMessage = "Failed to buy NFT";
      try {
        if (err?.error?.error) errorMessage = err.error.error;
        else if (err?.error?.message) errorMessage = err.error.message;
        else if (typeof err.message === "string") errorMessage = err.message;
      } catch (e) {
        console.warn("⚠️ Could not parse backend error:", e);
      }

      const toast = await this.toastCtrl.create({
        message: errorMessage,
        duration: 2500,
        position: 'top',
        color: 'danger',
        icon: 'close-circle-outline',
        cssClass: 'custom-toast'
      });
      await toast.present();
    } finally {
      this.isSending = false;
    }
  }

  async openSolscan() {
    const mintAddress = this.route.snapshot.paramMap.get('mintAddress'); // ✅ pakai mintAddress
    const solscanUrl = `https://solscan.io/token/${mintAddress}?cluster=mainnet-beta`;

    if (Capacitor.isNativePlatform()) {
      // buka in-app browser (native)
      await Browser.open({ url: solscanUrl });
    } else {
      // fallback kalau di web biasa
      window.open(solscanUrl, '_blank');
    }
  }

  formatWithZeroCount(num: number): string {
      const str = num.toString();

      if (!str.includes(".")) return `${str}`;

      const [intPart, decPart] = str.split(".");

      // cari jumlah nol berturut-turut setelah "0."
      let zeroCount = 0;
      for (const ch of decPart) {
        if (ch === "0") zeroCount++;
        else break;
      }

      // ambil sisa digit setelah nol
      const rest = decPart.slice(zeroCount);

      // map angka ke subscript unicode
      const subscripts: Record<string, string> = {
        "0": "0","1": "0","2": "0","3": "0","4": "₄",
        "5": "₅","6": "₆","7": "₇","8": "₈","9": "₉"
      };

      const zeroCountStr = zeroCount.toString()
        .split("")
        .map((d) => subscripts[d] || d)
        .join("");

      const result = `${intPart}.0${zeroCountStr}${rest}`;

      // console.log(`formatWithZeroCount(${num}) => ${result}`);
      return result;
  }

  formatPriceDisplay(price: number, symbol: string): string {
    if (!price || price <= 0) return '-';

    // ✅ Kalau token SOL → pakai format existing kamu
    if (symbol === 'SOL') {
      return this.formatWithZeroCount(price);
    }

    // ✅ Kalau bukan SOL → pakai format singkat (K, M, B)
    const absValue = Math.abs(price);
    let formatted: string;

    if (absValue >= 1_000_000_000) {
      formatted = (price / 1_000_000_000).toFixed(2).replace(/\.00$/, '') + 'B';
    } else if (absValue >= 1_000_000) {
      formatted = (price / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
    } else if (absValue >= 1_000) {
      formatted = (price / 1_000).toFixed(2).replace(/\.00$/, '') + 'K';
    } else {
      formatted = price.toFixed(2).replace(/\.00$/, '');
    }

    return formatted;
  }

  isLoggedIn(): boolean {
      const token = localStorage.getItem('token');
      return !!token;
  }

  async loadUsers() {
    try {
      const data: any = await this.http
        .get(`${environment.apiUrl}/auth/users/basic`) // endpoint baru yg balikin semua user (name, avatar, addresses)
        .toPromise();
      this.allUsers = data;
      // console.log("👥 All users basic:", this.allUsers);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  }

  async loadTopCreators() {
    try {
      const data: any = await this.http
        .get(`${environment.apiUrl}/nft/top-creators`)
        .toPromise();
      this.topCreators = data;
      console.log("🔥 Top Creators (from backend):", this.topCreators);
    } catch (err) {
      console.error("Error loading top creators:", err);
    }
  }

  async loadNftHistory() {
    try {
      const data: any = await this.http
        .get(`${environment.apiUrl}/nft/history`)
        .toPromise();

      this.history = data.history || [];
      console.log("📜 NFT History:", this.history);
    } catch (err) {
      console.error("Error loading NFT history:", err);
      this.history = [];
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

  openSellModal() {
    this.showSellModal = true;
    this.isClosingSell = false;
  }

  resetSellModal() {
    this.isClosingSell = true;
    setTimeout(() => {
      this.showSellModal = false;
      this.sellPrice = 0;      
    }, 300);
  }

  async submitListing() {
    if (!this.sellPrice || this.sellPrice <= 0) {
      alert("Please enter a valid price");
      return;
    }

    if (this.sellRoyalty < 0 || this.sellRoyalty > 100) {
      alert("Royalty must be between 0 and 100%");
      return;
    }

    // 🧩 Pastikan harga sesuai minimal (auto convert jika USDC)
    let effectiveMinPrice = this.minSellPrice;

    if (this.selectedToken?.symbol === "USDC" && this.solToUsdcRate > 0) {
      // minSellPrice on-chain = SOL, ubah ke USDC
      effectiveMinPrice = (this.metadata?.minPrice ?? 0.0001) * this.solToUsdcRate;
    }

    if (this.sellPrice < effectiveMinPrice) {
      const toast = await this.toastCtrl.create({
        message: `⚠️ Minimum allowed price is ${effectiveMinPrice.toFixed(4)} ${this.selectedToken?.symbol || "SOL"}`,
        duration: 3000,
        color: "warning",
        position: "top"
      });
      toast.present();
      return;
    }

    this.isListing = true;

    // ✅ Tentukan simbol & mint dari token yang dipilih
    const paymentSymbol = this.selectedToken?.symbol || "SOL";
    const paymentMint = this.selectedToken?.mint || "";

    // 🚀 Kirim ke API backend (offchain save to DB)
    this.http.post(`${environment.apiUrl}/auth/nft/${this.mintAddress}/sell`, {
      price: this.sellPrice,
      royalty: this.sellRoyalty,
      paymentSymbol, // ⬅️ kirim simbol (ex: "USDC" / "SOL")
      paymentMint    // ⬅️ kirim mint address (ex: USDC mint)
    }).subscribe({
      next: async (res: any) => {
        console.log("✅ NFT listed:", res);

        // Gunakan harga yang user isi sebelum submit
        this.listedPrice = this.sellPrice; // ✅ simpan harga yang baru dijual
        this.listedSymbol = this.selectedToken?.symbol || "SOL";

        this.txSig = null;
        this.isListing = false;

        console.log(`🧾 [UI] Will display: ${this.listedPrice} ${this.listedSymbol}`);

        if (this.mintAddress) {
          await this.loadMetadata(this.mintAddress);
        }

        await this.loadTokens();
        await this.loadTopCreators();
        await this.loadNftHistory();
      },
      error: (err) => {
        console.error("❌ Error listing NFT:", JSON.stringify(err));
        this.isListing = false;
      }
    });
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

  get tokenSymbol(): string {
    return (
      this.metadata?.paymentSymbol ||
      this.metadata?.tokenSymbol ||
      this.metadata?.symbol ||
      (this.metadata?.character || this.metadata?.rune ? 'SOL' : this.selectedToken?.symbol || 'SOL')
    );
  }

  get uogTokens() {
    // tampilkan hanya token UOG
    const search = (this.tokenSearch || '').toLowerCase();
    return (this.filteredTokens || [])
      .filter(t => t.symbol?.toLowerCase() === 'uog')
      .filter(t => !search || t.symbol.toLowerCase().includes(search));
  }

  async fetchRates() {
    try {
      const resp: any = await this.http
        .get("https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd")
        .toPromise();

      const solToUsd = resp["solana"].usd;      // e.g. 187.25 USD per SOL
      const usdcToUsd = resp["usd-coin"].usd;   // e.g. 1.00 USD per USDC

      this.solToUsdcRate = solToUsd / usdcToUsd;   // 1 SOL = ? USDC
      this.usdcToSolRate = 1 / this.solToUsdcRate; // 1 USDC = ? SOL

      console.log("💱 [fetchRates] Rates updated:");
      console.log(`   • 1 SOL  = ${this.solToUsdcRate.toFixed(4)} USDC`);
      console.log(`   • 1 USDC = ${this.usdcToSolRate.toFixed(6)} SOL`);
    } catch (err) {
      console.error("❌ Failed to fetch Coingecko rates", err);
    }
  }

  onTokenChange() {
    if (!this.selectedToken) return;

    console.log(`🔁 [onTokenChange] Token selected: ${this.selectedToken.symbol}`);

    if (this.selectedToken.symbol === "USDC" && this.solToUsdcRate > 0) {
      const oldMin = this.minSellPrice;
      this.minSellPrice = (this.metadata?.minPrice ?? 0.0001) * this.solToUsdcRate;
      this.sellPrice = this.minSellPrice;
      console.log(`   • Converted minSellPrice: ${oldMin} SOL → ${this.minSellPrice.toFixed(6)} USDC`);
    } else if (this.selectedToken.symbol === "SOL") {
      const reverted = this.metadata?.minPrice ?? 0.0001;
      this.minSellPrice = reverted;
      this.sellPrice = reverted;
      console.log(`   • Reverted minSellPrice to SOL: ${this.minSellPrice}`);
    }
  }

  get displaySellPrice(): number {
    // Tidak perlu konversi lagi — user input sudah dalam token yang dipilih
    return this.sellPrice;
  }

  get displayInSol(): number {
    // Hitung estimasi nilai dalam SOL untuk tampilan bawah
    if (this.selectedToken?.symbol === "USDC" && this.usdcToSolRate > 0) {
      return this.sellPrice * this.usdcToSolRate; // 1 USDC → 0.0053 SOL
    }
    return this.sellPrice; // kalau token SOL langsung tampil sama
  }

  async loadListingPrice(mintAddress: string) {
    const res = await this.http
      .get<any>(`${environment.apiUrl}/nft/${mintAddress}/onchain`)
      .toPromise();

    console.log("🧾 NFT raw price:", res.price, res.paymentSymbol);
    console.log("💱 Current rate:", this.solToUsdcRate, "USDC per SOL");

    this.nftListingPrice = {
      amount: res.price,
      symbol: res.paymentSymbol || "SOL",
      usdValue:
        res.paymentSymbol === "SOL"
          ? res.price * this.solToUsdcRate
          : res.price
    };

    console.log("✅ Final listing price:", this.nftListingPrice);
  }

  get priceInToken() {
    if (!this.selectedToken) return this.nftListingPrice;

    if (this.selectedToken.symbol === "USDC") {
      return {
        amount: this.nftListingPrice.symbol === "SOL"
          ? this.nftListingPrice.amount * (this.solToUsdcRate || 180)
          : this.nftListingPrice.amount,
        symbol: "USDC",
        usdValue: this.nftListingPrice.usdValue
      };
    }
    return this.nftListingPrice;
  }

  get filteredTokens() {
    if (!this.tokenSearch) return this.tokens;
    return this.tokens.filter(t =>
      (t.symbol?.toLowerCase().includes(this.tokenSearch.toLowerCase()) ||
       t.name?.toLowerCase().includes(this.tokenSearch.toLowerCase()))
    );
  }

  get solToken() {
    return this.tokens.find(t => t.symbol === 'SOL');
  }

  get uogToken() {
    return this.tokens.find(t => t.symbol === 'UOG');
  }

  get treasuryFeeUOG() {
    const solToken = this.solToken;
    const uogToken = this.uogToken;
    if (!solToken || !uogToken || !this.nftListingPrice?.amount) return null;

    const solUsd = solToken.priceUsd || 0;
    const uogUsd = uogToken.priceUsd || 0;

    const priceAmount = this.nftListingPrice.amount;
    const priceSymbol = this.nftListingPrice.symbol || "UOG";

    let solFee = 0;
    let feeUsd = 0;
    let feeUog = 0;

    if (priceSymbol === "SOL") {
      // 🔹 NFT terdaftar dalam SOL
      solFee = priceAmount * 0.1;
      feeUsd = solFee * solUsd;
      feeUog = uogUsd > 0 ? feeUsd / uogUsd : 0;
    } else if (priceSymbol === "UOG") {
      // 🔹 NFT terdaftar dalam UOG
      feeUog = priceAmount * 0.1;
      feeUsd = feeUog * uogUsd;
      solFee = solUsd > 0 ? feeUsd / solUsd : 0;
    } else {
      // 🔹 Default (misal USDC atau lainnya)
      feeUsd = priceAmount * 0.1;
      solFee = solUsd > 0 ? feeUsd / solUsd : 0;
      feeUog = uogUsd > 0 ? feeUsd / uogUsd : 0;
    }

    return { solFee, feeInUSD: feeUsd, feeInUOG: feeUog };
  }

  // === Get Price Display (pakai rates di atas) ===
  getPriceDisplay(token: any) {
    if (!token || !this.nftListingPrice) return { amount: 0, usd: 0, sol: 0 };

    const listing = this.nftListingPrice;
    const solToken = this.tokens.find(t => t.symbol === "SOL");
    const uogToken = this.tokens.find(t => t.symbol === "UOG");

    const solUsd = solToken?.priceUsd || 0;
    const uogUsd = uogToken?.priceUsd || 0;
    const listingSymbol = listing.symbol;

    // 💰 Harga listing dalam USD (asli)
    const listingUsd = listing.usdValue || 0;

    // Jika token = UOG (utama)
    if (token.symbol === "UOG") {
      let amountUOG = 0;

      if (listingSymbol === "SOL") {
        // Listing dalam SOL → konversi ke UOG
        const priceInUsd = listing.amount * solUsd;
        amountUOG = uogUsd > 0 ? priceInUsd / uogUsd : 0;
      } else if (listingSymbol === "USDC") {
        // Listing dalam USDC → konversi ke UOG (1 USDC ≈ 1 USD)
        amountUOG = uogUsd > 0 ? listing.amount / uogUsd : 0;
      } else if (listingSymbol === "UOG") {
        amountUOG = listing.amount;
      }

      return {
        amount: amountUOG,
        usd: amountUOG * uogUsd,
        sol: solUsd > 0 ? (amountUOG * uogUsd) / solUsd : 0,
      };
    }

    // Jika token = SOL
    if (token.symbol === "SOL") {
      let amountSOL = 0;

      if (listingSymbol === "UOG") {
        // UOG → SOL
        const priceInUsd = listing.amount * uogUsd;
        amountSOL = solUsd > 0 ? priceInUsd / solUsd : 0;
      } else if (listingSymbol === "USDC") {
        amountSOL = solUsd > 0 ? listing.amount / solUsd : 0;
      } else {
        amountSOL = listing.amount;
      }

      return {
        amount: amountSOL,
        usd: amountSOL * solUsd,
        sol: amountSOL,
      };
    }

    // Jika token = USDC
    if (token.symbol === "USDC") {
      let amountUSDC = 0;

      if (listingSymbol === "SOL") {
        amountUSDC = listing.amount * solUsd; // 1 USDC ≈ 1 USD
      } else if (listingSymbol === "UOG") {
        amountUSDC = listing.amount * uogUsd;
      } else {
        amountUSDC = listing.amount;
      }

      return {
        amount: amountUSDC,
        usd: amountUSDC,
        sol: solUsd > 0 ? amountUSDC / solUsd : 0,
      };
    }

    // Default fallback
    return {
      amount: listing.amount,
      usd: listing.usdValue,
      sol: listingSymbol === "SOL" ? listing.amount : 0,
    };
  }

}
