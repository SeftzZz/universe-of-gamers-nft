import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Idl } from '../../services/idl';
import { Wallet } from '../../services/wallet';
import { Auth } from '../../services/auth';
import { Modal } from '../../services/modal';
import { User, UserProfile } from '../../services/user';
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

  mintAddress!: string;              // dari route param
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
  ) {}

  async ngOnInit() {
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
      await this.loadTokens();
    }

    // ✅ cek apakah masuk dengan query param sell
    this.route.queryParams.subscribe(params => {
      this.isSellMode = params['sell'] === '1';
      console.log("🛒 Sell mode:", this.isSellMode);
    });

    const saved = localStorage.getItem('token');
    if (saved) this.authToken = saved;
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
      await this.loadTokens();
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

      // Normalisasi supaya template tidak error
      this.metadata = {
        ...raw,
        symbol: raw.symbol || "UOG", // default symbol
        price: raw.price ?? 0.01,
        seller_fee_basis_points: raw.royalty || 0,
        attributes: [
          { trait_type: "Level", value: raw.level },
          { trait_type: "HP", value: raw.hp },
          { trait_type: "ATK", value: raw.atk },
          { trait_type: "DEF", value: raw.def },
          { trait_type: "SPD", value: raw.spd },
          { trait_type: "Crit Rate", value: raw.critRate + "%" },
          { trait_type: "Crit Dmg", value: raw.critDmg + "%" },
        ],
        properties: {
          creators: [{ address: raw.owner }],
        },
        history: raw.history || [],
      };

      console.log("✅ NFT Metadata normalized:", this.metadata);
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

      await this.loadMetadata(this.mintAddress);

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

      this.tokens = resp.tokens || [];
      localStorage.setItem('walletTokens', JSON.stringify(this.tokens));
      console.log('walletTokens', JSON.stringify(this.tokens));
    } catch (err) {
      console.error('Error fetch tokens from API', err);
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

  toggleSendModal() {
    this.showSendModal = true;
  }

  get filteredTokens() {
    if (!this.tokenSearch) return this.tokens;
    return this.tokens.filter(t =>
      (t.symbol?.toLowerCase().includes(this.tokenSearch.toLowerCase()) ||
       t.name?.toLowerCase().includes(this.tokenSearch.toLowerCase()))
    );
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

      // 🔥 Panggil backend (custodian yang handle buy_nft)
      const buyRes: any = await this.http
        .post(`${environment.apiUrl}/auth/nft/${mintAddress}/buy?demo=false`,
          {
            user: this.activeWallet,
            paymentMint: paymentMint,   // 👈 kirim mint token yang dipilih (SOL/UOG)
            price: this.metadata?.price,
            name: this.metadata?.name,
            symbol: this.metadata?.symbol,
            uri: this.metadata?.uri,
          },
          { headers: { Authorization: `Bearer ${this.authToken}` } })
        .toPromise();

      if (!buyRes.signature) throw new Error("❌ No signature returned from backend");

      this.txSig = buyRes.signature;

      // Update balance & tokens setelah beli
      await this.updateBalance();
      await this.loadTokens();

      const toast = await this.toastCtrl.create({
        message: `NFT purchase successful! ✅`,
        duration: 2500,
        position: 'bottom',
        color: 'success',
        icon: 'checkmark-circle-outline',
        cssClass: 'custom-toast'
      });
      await toast.present();

    } catch (err) {
      await this.updateBalance();
      await this.loadTokens();

      console.error("❌ buyNft error:", JSON.stringify(err));
      const toast = await this.toastCtrl.create({
        message: `Failed to buy NFT`,
        duration: 2000,
        position: 'bottom',
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

      if (!str.includes(".")) return `$${str}`;

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
        "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
        "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉"
      };

      const zeroCountStr = zeroCount.toString()
        .split("")
        .map((d) => subscripts[d] || d)
        .join("");

      const result = `${intPart}.0${zeroCountStr}${rest} SOL`;

      // console.log(`formatWithZeroCount(${num}) => ${result}`);
      return result;
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

  submitListing() {
    if (!this.sellPrice || this.sellPrice <= 0) {
      alert("Please enter a valid price");
      return;
    }
    if (this.sellRoyalty < 0 || this.sellRoyalty > 100) {
      alert("Royalty must be between 0 and 100%");
      return;
    }

    this.isListing = true;

    // 🚀 Kirim ke API backend (offchain save to DB)
    this.http.post(`${environment.apiUrl}/auth/nft/${this.mintAddress}/sell`, {
      price: this.sellPrice,
      royalty: this.sellRoyalty,
    }).subscribe({
      next: async (res: any) => {
        console.log("✅ NFT listed:", res);
        this.txSig = res?.signature || "offchain-listing"; // dummy jika offchain
        this.isListing = false;
        await this.loadMetadata(this.mintAddress);
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
}
