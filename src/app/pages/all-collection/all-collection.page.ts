// src/app/pages/all-collection/all-collection.page.ts
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { Auth } from '../../services/auth';
import { Market } from '../../services/market';
import { WebSocket } from '../../services/websocket';
import { Wallet } from '../../services/wallet';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { IonContent } from '@ionic/angular';
import { ToastController, LoadingController } from '@ionic/angular';
import { User, UserProfile } from '../../services/user';

const web3 = require('@solana/web3.js');
const { Transaction } = require("@solana/web3.js");

import { Phantom } from '../../services/phantom';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { NgZone } from "@angular/core";

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
  // ✅ ubah jadi union type agar bisa string atau object hasil populate
  character?: string | { name?: string; rarity?: string; element?: string };
  rune?: string | { name?: string; rarity?: string };
  rarity?: string;
  isSell?: boolean;
  price?: number;
  paymentSymbol?: string;
  tokenSymbol?: string;
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
  selector: 'app-all-collection',
  templateUrl: './all-collection.page.html',
  styleUrls: ['./all-collection.page.scss'],
  standalone: false,
})
export class AllCollectionPage implements OnInit {
  // === User Info ===
  userName: string = '';
  userAvatar: string = 'assets/images/avatar/avatar-small-01.png';
  userAddress: string | null = null;
  userRole: string | null = null;
  activeWallet: string = '';

  // === NFT Related ===
  nftBC: INftItem[] = [];
  nftRuneBC: INftItem[] = [];
  latestNfts: INftItem[] = [];
  history: any[] = [];
  favorites: Set<string> = new Set();

  // === Top Creators & Users ===
  topCreators: Creator[] = [];
  allUsers: any[] = [];

  // === UI State ===
  isOpen = false;
  selected = '';
  activeTab: 'character' | 'rune' = 'character';
  itemsToShowCharacter = 8;
  itemsToShowRune = 8;
  loadStep = 8;

  @ViewChild(IonContent, { read: ElementRef }) ionContentRef!: ElementRef;
  scrollIsActive = false;

  prizePool: any = null;

  userProfile: any = null;
  myTeams: any[] = [];
  tournamentId: string | null = null;
  activeTournament: any = null;
  walletAddress: string | null = null;
  selectedTeamId: string | null = null;
  showJoinModal = false;
  isClosingJoin = false;
  isJoining = false;
  joinSuccess = false;
  joinTx: any = null;
  teamSearch: string = "";

  solToUsd: number = 0;
  usdcToUsd: number = 0;
  uogToUsd: number = 0;
  uogToSolRate: number = 0; // rate 1 UOG → SOL
  uogToUsdRate: number = 0; // rate 1 UOG → USDC
  solToUogRate: number = 0; // rate 1 SOL → UOG
  usdcToSolRate: number = 0;
  usdcToUogRate: number = 0;
  solToUsdcRate: number = 0;  // 1 SOL = ? USDC
  listedPrice: number = 0;
  listedSymbol: string = "SOL";
  packPriceSOL: number = 0;
  tokens: any[] = [];
  authToken: string | null = null;

  amount: number | null = null;
  selectedToken: any = null;
  tokenSearch: string = '';
  txSig: string | null = null;   // simpan signature tx
  isSending: boolean = false;    // flag loading
  isClosingStep = false;
  tournamentTokens: any[] = [];
  convertedTournamentPrice: any = null; // hasil price conversion
  // optional - samakan struktur fee seperti buyNFT
  tournamentFeeUOG = {
    feeInUOG: 0,
    solFee: 0,
    feeInUSD: 0
  };
  hasJoinedTournament: boolean = false;
  joinedTeam: any = null;

  bracketMatches: any[] = [];
  currentPhase: string = "";
  activeTournaments: any[] = [];
  tournamentBlocks: any[] = []; // combined data for UI

  selectedCharacter: string[] = [];
  selectedRunes: string[] = [];
  isRuneDropdownOpen = false;
  filteredRunes: any[] = [];
  selectedRuneLabel: string | null = null;
  isLoading = false;
  equippedRuneObjects: any[] = []; // rune yg sedang dipakai karakter

  characterRuneCache: { [characterId: string]: string[] } = {};
  globalSelectedRunes: Set<string> = new Set();
  activeCharacterId: string | null = null;

  constructor(
    private cd: ChangeDetectorRef,
    private auth: Auth,
    private router: Router,
    private loadingCtrl: LoadingController,
    private market: Market,
    private ws: WebSocket,
    private http: HttpClient,
    private toastCtrl: ToastController,
    private userService: User,
    private phantom: Phantom,
    private walletService: Wallet,
  ) {
    window.addEventListener("tournament-joined", (e: any) => {
      this.joinSuccess = true;
      this.joinTx = e.detail;
    });
  }

  async ngOnInit() {
    this.walletService.getActiveWallet().subscribe(async (addr) => {
        if (addr) {
            this.activeWallet = addr;
            console.log('🔄 Active wallet updated in Home:', addr);
        }
    });

    await this.loadFavorites();

    // ========================================================
    // 🔥 LISTEN WEBSOCKET EVENTS
    // ========================================================
    this.ws.messages$.subscribe(async (msg) => {
        if (msg?.type === 'relist-update') {
            console.log('🔥 NFT relisted:', msg);
            await this.market.loadNfts();
            await this.market.loadLatestNfts();
        }

        if (msg?.type === 'delist-update') {
            console.log('🔥 NFT delisted:', msg);
            await this.market.loadNfts();
            await this.market.loadLatestNfts();
        }

        if (msg.type === "prizepool_update") {
            this.prizePool = {
                ...this.prizePool,
                ...msg.data
            };
        }
    });

    this.userService.getUser().subscribe(u => {
        this.userProfile = u;
    });

    // ========================================================
    // 🌍 LISTENER GLOBAL UNTUK JOIN TOURNAMENT
    // ========================================================
    window.addEventListener("tournament-joined", (ev: any) => {
        console.log("🌍 EVENT RECEIVED: tournament-joined", ev.detail);

        const { tournamentId, walletAddress, teamId } = ev.detail;

        // update state lokal
        this.hasJoinedTournament = true;
        this.joinedTeam = teamId;

        // auto refresh tournament active
        this.loadActiveTournament();

        // jika modal masih terbuka → tampilkan success
        if (this.showJoinModal) {
            this.isJoining = false;
            this.joinSuccess = true;

            this.joinTx = {
                team: teamId,
                txSignature: ev.detail.tx
            };
        }

        // force re-render UI
        if (this.cd) {
            this.cd.detectChanges();
        }
    });

    // load tournament pertama kali
    this.loadActiveTournament();
  }

  async ionViewWillEnter() {
    await this.refreshData();  // refresh setiap kali halaman aktif kembali
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

  private async refreshData() {
    // load lewat service
    await this.market.loadNfts();
    await this.market.loadLatestNfts();
    await this.market.loadTopCreators();
    await this.market.loadUsers();
    await this.market.loadHistory();
    await this.market.loadPrizePool();

    // subscribe hasil ke variabel lokal
    this.market.getNfts().subscribe(nfts => {
      this.nftBC = nfts.filter(n => !!n.character);
      this.nftRuneBC = nfts.filter(n => !!n.rune);
    });
    this.market.getLatestNfts().subscribe(latest => (this.latestNfts = latest));
    this.market.getTopCreators().subscribe(creators => (this.topCreators = creators));
    this.market.getUsers().subscribe(users => (this.allUsers = users));
    this.market.getHistory().subscribe(h => (this.history = h));
    this.market.getPrizePool().subscribe(pool => {this.prizePool = pool});
  }

  // -------------------------------
  // FAVORITE FEATURE
  // -------------------------------
  toggleFavorite(item: INftItem) {
    const type = item.character ? 'favNft' : (item.rune ? 'favRune' : 'other');
    const key = `${type}:${item._id}`;
    if (this.favorites.has(key)) {
      this.favorites.delete(key);
    } else {
      this.favorites.add(key);
    }
    this.saveFavorites();
  }

  isFavorite(item: INftItem): boolean {
    const type = item.character ? 'favNft' : (item.rune ? 'favRune' : 'other');
    const key = `${type}:${item._id}`;
    return this.favorites.has(key);
  }

  saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(Array.from(this.favorites)));
  }

  async loadFavorites() {
    const stored = localStorage.getItem('favorites');
    this.favorites = stored ? new Set(JSON.parse(stored)) : new Set();
  }

  // -------------------------------
  // UI HELPERS
  // -------------------------------
  shorten(addr?: string) {
    if (!addr) return 'Unknown';
    return addr.slice(0, 6) + '...' + addr.slice(-6);
  }

  formatWithZeroCount(num?: number): string {
    if (num == null) return '-';   // handle undefined/null
    const str = num.toString();

    if (!str.includes(".")) return `${str}`;

    const [intPart, decPart] = str.split(".");
    let zeroCount = 0;
    for (const ch of decPart) {
      if (ch === "0") zeroCount++;
      else break;
    }
    const rest = decPart.slice(zeroCount);
    const subscripts: Record<string, string> = {
      "0": "0","1": "0","2": "0","3": "0","4": "₄",
      "5": "₅","6": "₆","7": "₇","8": "₈","9": "₉"
    };
    const zeroCountStr = zeroCount.toString()
      .split("")
      .map((d) => subscripts[d] || d)
      .join("");

    return `${intPart}.0${zeroCountStr}${rest}`;
  }

  goToNftDetail(mintAddress?: string) {
    if (!mintAddress) return;
    this.router.navigate(['/market-layout/nft-detail', mintAddress]);
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
      target.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
      this.selected = 'Recently added';
    } else if (type === 'low') {
      target.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      this.selected = 'Price: Low to High';
    } else if (type === 'high') {
      target.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
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

  async showToast(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2000,
      color: "warning",
      position: "top",
    });
    toast.present();
  }

  // -------------------------------
  // AUTH
  // -------------------------------
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

  formatPriceDisplay(price?: number, symbol?: string): string {
    if (price == null || isNaN(price)) return '-';
    if (!symbol) symbol = 'SOL';

    // === Kalau SOL → format microdecimal ===
    if (symbol === 'SOL') {
      return this.formatWithZeroCount(price);
    }

    // === Token lain (UOG, BONK, dll) → pakai format singkat ===
    const abs = Math.abs(price);
    if (abs >= 1_000_000_000) return (price / 1_000_000_000).toFixed(2).replace(/\.00$/, '') + 'B';
    if (abs >= 1_000_000) return (price / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
    if (abs >= 1_000) return (price / 1_000).toFixed(2).replace(/\.00$/, '') + 'K';
    if (abs >= 1) return price.toFixed(2).replace(/\.00$/, '');
    return price.toPrecision(2);
  }

  async checkJoinedTournament() {
    if (!this.activeTournament || !this.activeWallet) {
      this.hasJoinedTournament = false;
      return;
    }

    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/tournament/${this.activeTournament._id}/participant/${this.activeWallet}`)
        .toPromise();

      this.hasJoinedTournament = resp.joined || false;
      this.joinedTeam = resp.participant?.team || null;

      console.log("🏁 Joined tournament:", this.hasJoinedTournament, this.joinedTeam);

    } catch (err) {
      console.error("❌ Failed checking tournament join", err);
      this.hasJoinedTournament = false;
    }
  }

  async loadActiveTournament() {
    try {
      const res: any = await this.http
        .get(`${environment.apiUrl}/tournament/active`)
        .toPromise();

      this.activeTournaments = res?.data || [];

      // No active tournaments
      if (!this.activeTournaments.length) {
        this.tournamentBlocks = [];
        return;
      }

      this.tournamentBlocks = [];

      // LOOP setiap tournament
      for (const t of this.activeTournaments) {
        const detail: any = await this.http
          .get(`${environment.apiUrl}/tournament/${t._id}`)
          .toPromise();

        const matches = detail.matches || [];

        // cek join status per tournament
        const joinResp: any = await this.http
          .get(`${environment.apiUrl}/tournament/${t._id}/participant/${this.activeWallet}`)
          .toPromise();

        const hasJoined = joinResp.joined || false;

        this.tournamentBlocks.push({
          tournament: t,
          matches,
          currentPhase: t.currentPhase,
          hasJoined,
          joinedTeam: joinResp.participant?.team || null
        });
      }

      console.log("🎯 Tournament Blocks:", this.tournamentBlocks);

    } catch (err) {
      console.error("❌ Failed to load tournaments", err);
    }
  }

  hasBracket() {
    return this.bracketMatches && this.bracketMatches.length > 0;
  }

  openMatchDetail(tournamentId: any, match: any) {
    console.log("Open battle for match:", match);

    // nanti:
    // - jika match belum selesai → create battle
    // - jika match selesai → lihat hasil battle
  }

  isWinner(match: any, wallet: string) {
    return match.completed && match.winner === wallet;
  }

  async loadUserTeams() {
    try {
      const res: any = await this.http
        .get(`${environment.apiUrl}/nft/team`)
        .toPromise();

      const list = res || [];

      // 🟢 Ambil hanya slot ke 5–8 (index 4–7)
      this.myTeams = list.slice(4, 8);

      console.log("📌 All Teams:", list);
      console.log("🎯 Using Tournament Team Slots (5–8):", this.myTeams);

    } catch (e) {
      console.error("Failed loading team list", e);
    }
  }

  filteredTeams() {
    if (!this.teamSearch) return this.myTeams;
    return this.myTeams.filter((t: any) =>
      t.name.toLowerCase().includes(this.teamSearch.toLowerCase())
    );
  }

  async autoEquipRunes() {
    // hanya equip rune untuk character pertama
    const characterId = this.selectedCharacter[0];
    
    for (const runeId of this.selectedRunes) {
      await this.http.post(`${environment.apiUrl}/nft/${characterId}/equip-rune`,
        { runeId },
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      ).toPromise();
    }
  }

  async updateTeamBeforeJoin() {
    if (!this.selectedCharacter) {
      const toast = await this.toastCtrl.create({
        message: "Please select a character.",
        duration: 3000,
        color: "warning",
        position: "top",
      });
      toast.present();
      return false;
    }

    // Minimal 1 character, rune opsional
    const members = [
      ...this.selectedCharacter,    // sudah berisi ObjectId
      ...this.selectedRunes         // sudah berisi ObjectId
    ];

    if (!this.selectedTeamId) {
      const toast = await this.toastCtrl.create({
        message: "Please select a team slot (5–8).",
        duration: 3000,
        color: "warning",
        position: "top",
      });
      toast.present();
      return false;
    }

    try {
      const payload = { members };

      const res: any = await this.http
        .put(
          `${environment.apiUrl}/nft/team/${this.selectedTeamId}`,
          payload,
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        )
        .toPromise();

      this.autoEquipRunes();

      console.log("✅ Team updated for tournament:", res.team);

      return true;

    } catch (err: any) {
      console.error("❌ Failed updating team:", err);

      const toast = await this.toastCtrl.create({
        message: "Failed to update team. Please try again.",
        duration: 3000,
        color: "danger",
        position: "top",
      });
      toast.present();

      return false;
    }
  }

  async loadTournamentTokens() {
    if (!this.activeWallet) return;
    if (!this.activeTournament) return; // pastikan tournament sudah loaded

    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/tokens/${this.activeWallet}`)
        .toPromise();

      // 🎯 Tentukan mint yang diizinkan berdasarkan tournament paymentSymbol
      const paymentSymbol = this.activeTournament?.paymentSymbol || "SOL";

      const mintMap: any = {
        USD: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        UOG: 'B6VWNAqRu2tZcYeBJ1i1raw4eaVP4GrkL2YcZLshbonk',
        SOL: 'So11111111111111111111111111111111111111111',
      };

      const allowedMint = mintMap[paymentSymbol];

      if (!allowedMint) {
        console.warn("⚠️ No allowed mint for payment:", paymentSymbol);
        this.tournamentTokens = [];
        return;
      }

      // 🎯 Filter token wallet user berdasarkan paymentSymbol
      this.tournamentTokens = (resp.tokens || [])
        .filter((t: any) => t.mint === allowedMint)
        .map((t: any) => ({
          ...t,
          selectable: true,
        }));

      console.log("🎯 PaymentSymbol:", paymentSymbol);
      console.log("🎯 Allowed mint:", allowedMint);
      console.log("🎯 Tournament wallet tokens:", this.tournamentTokens);

    } catch (err) {
      console.error("❌ Error fetching tournament tokens", err);
    }
  }

  async fetchTournamentRates() {
    try {
      const resp: any = await this.http
        .get<any>(`${environment.apiUrl}/nft/rates`)
        .toPromise();

      this.solToUsd = resp.solToUsd || 0;
      this.usdcToUsd = resp.usdcToUsd || 1;

      // Fallback → Jika backend tidak kirim uogToUsd, pakai default 0.05
      this.uogToUsdRate = resp.uogToUsd ?? 0.05;

      console.log("💱 Tournament Rates:", {
        solToUsd: this.solToUsd,
        uogToUsd: this.uogToUsdRate,
        solToUsdcRate: this.solToUsd / this.usdcToUsd
      });

    } catch (err) {
      console.error("❌ Failed fetching rates", err);
    }
  }

  selectTournamentToken(token: any) {
    if (!token.selectable) return;
    this.selectedToken = token;

    // hitung ulang harga
    this.convertTournamentPrice();

    console.log("🎟 Selected Tournament Token:", token.symbol);
  }

  convertTournamentPrice() {
    if (!this.activeTournament || !this.selectedToken) return;

    const pack = this.activeTournament.pack;
    if (!pack) return;

    let amount = 0;     // amount to pay in selected token
    let usdValue = 0;   // display USD

    switch (this.selectedToken.symbol) {

      case "SOL":
        amount = Number(pack.priceSOL || 0);
        usdValue = amount * (this.solToUsd || 0);   // harga SOL ke USD
        break;

      case "UOG":
        amount = Number(pack.priceUOG || 0);
        usdValue = amount * (this.uogToUsd || 0);   // harga UOG ke USD
        break;

      case "USDC":
        amount = Number(pack.priceUSD || 0);
        usdValue = amount;    // 1 USDC = $1
        break;

      default:
        amount = 0;
        usdValue = 0;
    }

    this.convertedTournamentPrice = { amount, usdValue };

    console.log("🎯 Converted Tournament Price:", this.convertedTournamentPrice);
  }

  getTournamentPriceDisplay(token: any) {
    const pack = this.activeTournament?.pack;
    if (!pack || !token) return { amount: 0, usd: 0 };

    const priceUOG = pack.priceUOG || 0;
    const priceSOL = pack.priceSOL || 0;
    const priceUSD = pack.priceUSD || 0;

    const solToUsd = this.solToUsd || 0;

    let amount = 0;
    let usd = priceUSD;  // <= FIX: selalu default ke harga resmi USD

    switch (token.symbol) {

      case "UOG":
        amount = priceUOG;  // exact UOG price from backend
        // USD tetap FIX 25
        break;

      case "SOL":
        amount = priceSOL;  
        // convert SOL → USD
        usd = solToUsd ? priceSOL * solToUsd : priceUSD;
        break;

      case "USDC":
        amount = priceUSD;  // 1 USDC = 1 USD
        usd = priceUSD;
        break;
    }

    return { amount, usd };
  }

  async loadUserNFTs() {
    try {
      console.log("🔄 Loading NFTs for tournament rarity:", this.activeTournament?.rarity);

      const resp: any = await this.http.get(
        `${environment.apiUrl}/nft/my-nfts`,
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      ).toPromise();

      const nftList = Array.isArray(resp) ? resp : [];

      console.log("📦 Raw NFTs:", nftList.length);

      // ===============================
      //  🔥 Tournament rarity filter
      // ===============================
      const requiredRarity = (this.activeTournament?.rarity || "").toLowerCase();

      if (!requiredRarity) {
        console.warn("⚠️ Tournament has NO rarity rule. Showing all NFTs.");
      }

      // ===============================
      //  🎭 CHARACTER NFT FILTER
      // ===============================
      this.nftBC = nftList
        .filter(n => n.character && typeof n.character === "object")
        .filter(n => {
          if (!requiredRarity) return true;
          const rarity = n.character?.rarity?.toLowerCase() || "";
          return rarity === requiredRarity;
        });

      // ===============================
      //  🔮 RUNE NFT FILTER
      // ===============================
      this.nftRuneBC = nftList
        .filter(n => n.rune && typeof n.rune === "object")
        .filter(n => {
          if (!requiredRarity) return true;
          const rarity = n.rune?.rarity?.toLowerCase() || "";
          return rarity === requiredRarity;
        });

      this.filterAvailableRunes();

      console.log(`🎭 Character NFTs (rarity=${requiredRarity}):`, this.nftBC.length);
      console.log(`🔮 Rune NFTs (rarity=${requiredRarity}):`, this.nftRuneBC.length);

    } catch (err) {
      console.error("❌ Failed loading NFTs:", err);
    }
  }

  async openJoinModal(tournament: any) {
    this.activeTournament = tournament;
    this.tournamentId = tournament?._id || null;

    this.walletAddress = this.activeWallet;

    if (!this.walletAddress) {
      const toast = await this.toastCtrl.create({
        message: `No wallet connected`,
        duration: 3000,
        color: "error",
        position: "top",
      });
      toast.present();
      return;
    }

    // 1️⃣ Load rates
    await this.fetchTournamentRates();

    // 2️⃣ Load team slots 5–8
    await this.loadUserTeams();

    // 🌟 AUTO-PICK TEAM SLOT
    if (this.myTeams && this.myTeams.length > 0) {
      const emptyTeam = this.myTeams.find(t => !t.members || t.members.length === 0);
      this.selectedTeamId = emptyTeam ? emptyTeam._id : this.myTeams[0]._id;

      console.log("🎯 Auto-selected team:", this.selectedTeamId);
    }

    // 3️⃣ Load wallet tokens
    await this.loadTournamentTokens();

    // 4️⃣ Load NFT sesuai rarity
    await this.loadUserNFTs();

    // Reset selection
    this.selectedCharacter = [];
    this.selectedRunes = [];
    this.activeTab = "character";

    // Phantom callback
    const successFlag = localStorage.getItem("tournamentJoinSuccess");
    if (successFlag === "1") {
      this.joinSuccess = true;
      this.isJoining = false;

      this.joinTx = {
        team: localStorage.getItem("tournamentJoinTeam"),
        txSignature: localStorage.getItem("tournamentJoinTx")
      };

      localStorage.removeItem("tournamentJoinSuccess");
      localStorage.removeItem("tournamentJoinTeam");
      localStorage.removeItem("tournamentJoinTx");

      console.log("🎉 Loaded tournament join result from Phantom:", this.joinTx);
    }

    this.showJoinModal = true;
    this.joinSuccess = false;
    this.isJoining = false;

    console.log("🎉 Modal ready:", this.activeTournament?.name);
  }

  selectCharacter(nft: any) {
    console.log("📌 selectCharacter()", nft);

    const id = nft._id;

    // ============================
    // Jika character sudah dipilih → jadikan ACTIVE CHARACTER
    // ============================
    if (this.selectedCharacter.includes(id)) {
      console.log("🟢 Character already in team → switching active character");
      this.activeCharacterId = id;

      // Load rune selection for this character
      this.selectedRunes = [...(this.characterRuneCache[id] || nft.equipped || [])];

      this.rebuildGlobalSelectedRunes();
      this.filterAvailableRunes();
      return;
    }

    // ============================
    // Limit max 3 character
    // ============================
    if (this.selectedCharacter.length >= 3) {
      this.toastCtrl.create({
        message: "You can only select 3 characters.",
        duration: 2000,
        color: "warning",
        position: "top"
      }).then(t => t.present());
      return;
    }

    // ============================
    // ADD NEW CHARACTER
    // ============================
    this.selectedCharacter.push(id);
    this.activeCharacterId = id;

    // Load equipped runes or empty
    this.selectedRunes = [...(nft.equipped || [])];

    // Cache initial runes
    this.characterRuneCache[id] = [...this.selectedRunes];

    this.rebuildGlobalSelectedRunes();
    this.filterAvailableRunes();
  }

  toggleRuneEquip(rune: any) {
    const charId = this.activeCharacterId;
    if (!charId) return;

    const id = rune._id;

    // aktif rune list hanya untuk karakter ini
    const current = this.characterRuneCache[charId] || [];

    // Unselect
    if (current.includes(id)) {
      this.characterRuneCache[charId] = current.filter(r => r !== id);
    } else {
      if (current.length >= 9) {
        this.toastCtrl.create({
          message: "Maximum 9 runes.",
          duration: 2000,
          color: "warning",
          position: "top"
        }).then(t => t.present());
        return;
      }
      this.characterRuneCache[charId] = [...current, id];
    }

    // Update UI runes
    this.selectedRunes = [...this.characterRuneCache[charId]];

    // update global
    this.rebuildGlobalSelectedRunes();
    this.filterAvailableRunes();
  }

  filterAvailableRunes() {
    const charId = this.activeCharacterId;

    if (!charId) {
      this.filteredRunes = this.nftRuneBC.map((r: any) => ({
        ...r,
        disabled: false
      }));
      return;
    }

    const selectedForThisChar = this.characterRuneCache[charId] ?? [];

    this.filteredRunes = this.nftRuneBC.map((r: any) => {
      const disabled =
        this.globalSelectedRunes.has(r._id) &&
        !selectedForThisChar.includes(r._id);

      return { ...r, disabled };
    });

    console.log("📌 filteredRunes:", this.filteredRunes);
  }

  async handleRuneSelect(characterId: string, rune: any) {
    console.log("📌 handleRuneSelect():", { characterId, rune });

    this.isRuneDropdownOpen = false;

    if (this.selectedRunes.length < 9) {
      console.log("➡ Slot available → equipRune()");
      return this.equipRune(characterId, rune);
    }

    const oldRuneId = this.selectedRunes[0];
    console.log("⚠️ Slot full → replaceRune()", { oldRuneId, newRuneId: rune._id });

    return this.replaceRune(characterId, oldRuneId, rune);
  }

  async equipRune(characterId: string, rune: any) {
    console.log("📌 equipRune() →", { characterId, rune });

    try {
      await this.http.post(
        `${environment.apiUrl}/nft/${characterId}/equip-rune`,
        { runeId: rune._id },
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      ).toPromise();

      console.log("✅ Backend equip successful");

      this.selectedRunes.push(rune._id);
      this.equippedRuneObjects.push(rune);
      rune['isEquipped'] = true;

      console.log("📌 After equip — selectedRunes:", this.selectedRunes);
      console.log("📌 equippedRuneObjects:", this.equippedRuneObjects);

      this.filterAvailableRunes();

    } catch (err) {
      console.error("❌ Equip failed", err);
    }
  }

  async unequipRune(characterId: string, runeId: string) {
    console.log("📌 unequipRune() →", { characterId, runeId });

    try {
      await this.http.post(
        `${environment.apiUrl}/nft/${characterId}/unequip-rune`,
        { runeId },
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      ).toPromise();

      console.log("✅ Backend unequip successful");

      this.selectedRunes = this.selectedRunes.filter(id => id !== runeId);
      console.log("📌 After unequip — selectedRunes:", this.selectedRunes);

      this.equippedRuneObjects = this.equippedRuneObjects.filter(
        (r: any) => r._id !== runeId
      );
      console.log("📌 equippedRuneObjects:", this.equippedRuneObjects);

      const rune = this.nftRuneBC.find((x: any) => x._id === runeId);
      if (rune) {
        rune['isEquipped'] = false;
        console.log("🔧 Marked rune as unequipped");
      }

      this.filterAvailableRunes();

    } catch (err) {
      console.error("❌ Unequip failed", err);
    }
  }

  async replaceRune(characterId: string, oldRuneId: string, newRune: any) {
    console.log("📌 replaceRune() →", { characterId, oldRuneId, newRune });

    try {
      await this.http.post(
        `${environment.apiUrl}/nft/${characterId}/edit-rune`,
        { oldRuneId, newRuneId: newRune._id },
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      ).toPromise();

      console.log("✅ Backend replace successful");

      this.selectedRunes = this.selectedRunes.map(id =>
        id === oldRuneId ? newRune._id : id
      );
      console.log("📌 After replace — selectedRunes:", this.selectedRunes);

      this.equippedRuneObjects = this.equippedRuneObjects.map((r: any) =>
        r._id === oldRuneId ? newRune : r
      );
      console.log("📌 equippedRuneObjects:", this.equippedRuneObjects);

      const oldRune = this.nftRuneBC.find((x: any) => x._id === oldRuneId);
      if (oldRune) {
        oldRune['isEquipped'] = false;
        console.log("🔧 Set oldRune.isEquipped = false");
      }

      newRune['isEquipped'] = true;

      this.filterAvailableRunes();

    } catch (err) {
      console.error("❌ Replace failed", err);
    }
  }

  isRuneDisabled(rune: any): boolean {
    return rune.disabled;
  }

  rebuildGlobalSelectedRunes() {
    this.globalSelectedRunes.clear();

    Object.values(this.characterRuneCache).forEach((list: string[]) => {
      list.forEach(id => this.globalSelectedRunes.add(id));
    });

    console.log("🌍 globalSelectedRunes ->", this.globalSelectedRunes);
  }

  // ===============================
  // 🔥 JOIN TOURNAMENT PAYMENT FLOW
  // ===============================
  async payTournament(paymentMint: string) {
    if (!this.activeTournament) return;

    try {
      this.isJoining = true;
      this.joinSuccess = false;
      this.isSending = true;
      this.txSig = null;

      const buyerToken =
        this.tournamentTokens.find(t => t.mint === paymentMint) ||
        this.selectedToken;

      const buyerSymbol = buyerToken?.symbol;

      let finalPrice = this.convertedTournamentPrice?.amount || 0;

      // =========================================
      // 1️⃣ Request unsigned transaction
      // =========================================

      const resp: any = await this.http.post(
        `${environment.apiUrl}/auth/tournament/${this.activeTournament._id}/pay`,
        {
          paymentMint,
          price: finalPrice,
          symbol: buyerSymbol,
        },
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      ).toPromise();

      if (!resp?.transaction)
        throw new Error("❌ Backend did not return transaction data");

      const txBuffer = Buffer.from(resp.transaction, "base64");
      const txBase58 = bs58.encode(txBuffer);

      // Platform check
      const platform = Capacitor.getPlatform();
      const isMobile = platform === "android" || platform === "ios";
      const provider = (window as any).solana;

      // =========================================
      // 🖥️ DESKTOP FLOW — Phantom Extension
      // =========================================
      if (!isMobile && provider?.isPhantom) {
        try {
          await provider.connect();

          const transaction = Transaction.from(txBuffer);
          const signedTx = await provider.signTransaction(transaction);
          const serialized = signedTx.serialize();
          const base58SignedTx = bs58.encode(serialized);

          // =========================================
          // 🔥 NEW: Kirim SEMUA DATA ke /confirm
          // =========================================

          const confirmResp: any = await this.http.post(
            `${environment.apiUrl}/auth/tournament/${this.activeTournament._id}/confirm`,
            {
              signedTx: base58SignedTx,
              walletAddress: this.walletAddress,
              teamId: this.selectedTeamId,
              characters: this.selectedCharacter,
              runes: this.characterRuneCache
            },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          ).toPromise();

          console.log("💰 Payment + Join Completed:", confirmResp);

          // =========================================
          //  UI Success
          // =========================================
          this.isSending = false;
          this.isJoining = false;
          this.joinSuccess = true;

          this.joinTx = {
            team: this.selectedTeamId,
            txSignature: confirmResp.txSignature
          };

          this.loadActiveTournament();
        } catch (err) {
          console.error("❌ Phantom desktop sign error:", err);
          const toast = await this.toastCtrl.create({
            message: "❌ Failed to sign or confirm transaction.",
            duration: 4000,
            color: "danger",
            position: "top"
          });
          toast.present();
        }
        return;
      }

      // =========================================
      // 📱 MOBILE FLOW — Phantom Deep Link
      // =========================================

      // Session
      const phantom_pubkey = localStorage.getItem("phantom_pubkey");
      const secretKeyStored = localStorage.getItem("dappSecretKey");
      const session = localStorage.getItem("phantomSession");

      if (!phantom_pubkey || !secretKeyStored || !session) {
        alert("⚠️ Please connect Phantom first.");
        this.isSending = false;
        return;
      }

      // Encrypt payload
      const phantomPubKey = bs58.decode(phantom_pubkey);
      const secretKey = bs58.decode(secretKeyStored);
      const sharedSecret = nacl.box.before(phantomPubKey, secretKey);
      const nonce = nacl.randomBytes(24);
      const nonceB58 = bs58.encode(nonce);

      const payloadObj = {
        session,
        transaction: txBase58,
        display: "signTransaction"
      };

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
      const relayUrl =
        `${relay}?target=${encodeURIComponent(baseUrl)}&app=${encodeURIComponent(appUrl)}`;

      // =========================================
      // 4️⃣ SIMPAN FULL CONTEXT UNTUK CALLBACK
      // =========================================

      localStorage.setItem("phantomFlow", "joinTournament");
      localStorage.setItem("pendingTournamentId", this.activeTournament._id);
      localStorage.setItem("pendingTournamentTeam", this.selectedTeamId || "");
      localStorage.setItem("pendingTournamentPrice", finalPrice.toString());
      localStorage.setItem("pendingTournamentSymbol", buyerSymbol);
      localStorage.setItem("pendingCharacters", JSON.stringify(this.selectedCharacter));
      localStorage.setItem("pendingRunes", JSON.stringify(this.characterRuneCache));

      // =========================================
      // 5️⃣ Redirect
      // =========================================

      if (isMobile) {
        setTimeout(() => (window.location.href = relayUrl), 500);
      } else {
        window.open(baseUrl, "_blank");
      }

    } catch (err) {
      console.error("❌ Tournament Payment Error:", err);
      const toast = await this.toastCtrl.create({
        message: "❌ Failed to process tournament payment.",
        duration: 4000,
        color: "danger",
        position: "top"
      });
      toast.present();
    } finally {
      this.isSending = false;
    }
  }

  // --------------------- RESET MODAL ---------------------
  resetJoinModal() {
    this.isClosingJoin = true;
    setTimeout(() => {
      this.showJoinModal = false;
      this.isClosingJoin = false;
      this.joinSuccess = false;
      this.selectedTeamId = null;
      this.selectedCharacter = [];
      this.selectedRunes = [];
    }, 280);
  }
}
