import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Idl } from '../../services/idl';
import { Wallet } from '../../services/wallet';
import { firstValueFrom } from 'rxjs';
import { ToastController } from '@ionic/angular';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';

interface IGatchaReward {
  type: "character" | "rune";
  rarity: string;
  chance: number;
  previewImages?: string[];
}

interface IGatchaPack {
  _id: string;
  name: string;
  description: string;
  priceUOG: number;
  priceSOL: number;
  rewards: IGatchaReward[];
}

@Component({
  selector: 'app-gatcha',
  templateUrl: 'gatcha.page.html',
  styleUrls: ['gatcha.page.scss'],
  standalone: false,
})
export class GatchaPage implements OnInit {
  program: any;
  activeWallet: string = '';
  authToken: string | null = null;

  // === Gatcha Pack ===
  gatchaPacks: any[] = [];
  mintResult: any = null;
  selectedPack: any = null;

  // === Token Modal ===
  tokens: any[] = [];
  showSendModal = false;
  isClosingSend = false;
  selectedToken: any = null;
  tokenSearch: string = '';
  txSig: string | null = null;
  isSending: boolean = false;

  // === Data Character & Rune untuk preview ===
  characters: any[] = [];
  runes: any[] = [];
  characterMap: Record<string, any[]> = {};
  runeMap: Record<string, any[]> = {};

  usdcToSolRate: number = 0;  // 1 USDC = ? SOL
  solToUsdcRate: number = 0;  // 1 SOL = ? USDC
  listedPrice: number = 0;
  listedSymbol: string = "SOL";
  packPriceSOL: number = 0;

  constructor(
    private http: HttpClient,
    private idlService: Idl,
    private toastCtrl: ToastController,
    private walletService: Wallet,
    private auth: Auth,
    private router: Router
  ) {}

  async ngOnInit() {
    this.program = await this.idlService.loadProgram();

    this.walletService.getActiveWallet().subscribe(async (addr) => {
      if (addr) {
        this.activeWallet = addr;
        await this.loadTokens();
      }
    });

    const saved = localStorage.getItem('token');
    if (saved) this.authToken = saved;

    await this.loadCharacters();
    await this.loadRunes();
    await this.loadGatchaPacks();
    await this.fetchRates();
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
          selectable: t.mint === 'So11111111111111111111111111111111111111111', // hanya SOL yang bisa dipilih
        }));

      // Simpan hasilnya ke localStorage
      localStorage.setItem('walletTokens', JSON.stringify(this.tokens));

      console.log('💰 Filtered wallet tokens (SOL & USDC only):', this.tokens);
    } catch (err) {
      console.error('❌ Error fetch tokens from API', err);
      this.router.navigateByUrl('/tabs/offline');
    }
  }

  // === Character & Rune (untuk preview gambar) ===
  async loadCharacters() {
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/fetch-character`)
      );
      this.characters = data;
      this.characterMap = data.reduce((acc: Record<string, any[]>, c: any) => {
        acc[c.rarity] = [...(acc[c.rarity] || []), c];
        return acc;
      }, {});
    } catch (err) {
      console.error("❌ Error loading characters:", err);
    }
  }

  async loadRunes() {
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/rune`)
      );
      this.runes = data;
      this.runeMap = data.reduce((acc: Record<string, any[]>, r: any) => {
        acc[r.rarity] = [...(acc[r.rarity] || []), r];
        return acc;
      }, {});
    } catch (err) {
      console.error("❌ Error loading runes:", err);
    }
  }

  // === Gatcha Packs ===
  async loadGatchaPacks() {
    try {
      const data = await firstValueFrom(
        this.http.get<IGatchaPack[]>(`${environment.apiUrl}/gatcha`)
      );

      this.gatchaPacks = data.map((pack) => {
        const rewardsWithPreview = pack.rewards.map((reward) => {
          let pool: { image: string }[] = [];
          if (reward.type === "character") {
            pool = this.characterMap[reward.rarity] || [];
          } else if (reward.type === "rune") {
            pool = this.runeMap[reward.rarity] || [];
          }
          const preview = this.getRandomImages(pool, 2);
          return { ...reward, previewImages: preview };
        });
        return { ...pack, rewards: rewardsWithPreview };
      });

    } catch (err) {
      console.error("❌ Error loading gatcha packs:", err);
      this.gatchaPacks = [];
    }
  }

  private getRandomImages(pool: { image: string }[], max: number): string[] {
    const result: string[] = [];
    const copy = [...pool];
    while (result.length < max && copy.length > 0) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy[idx].image);
      copy.splice(idx, 1);
    }
    return result;
  }

  // === Modal Control ===
  async toggleSendModal(pack: any) {
    this.selectedPack = pack;
    this.packPriceSOL = pack.priceSOL || 0; // ✅ <── tambahkan ini
    this.showSendModal = true;
    this.isClosingSend = false;
    await this.loadTokens();
  }

  resetSendModal() {
    this.selectedToken = null;
    this.selectedPack = null;
    this.txSig = null;
    this.isSending = false;
    this.showSendModal = false;
  }

  async confirmBuyAndMint(token: any) {
    this.selectedToken = token;
    this.isSending = true;

    try {
      if (this.selectedPack?._id) {
        await this.buyAndMintPack(this.selectedPack._id, token);
      }
    } catch (err) {
      console.error("❌ Error confirmBuyAndMint", err);
    } finally {
      this.isSending = false;
    }
  }

  // === Buy & Mint ===
  private async shufflePackRewards(packId: string, times: number, delay: number) {
    const packIndex = this.gatchaPacks.findIndex(p => p._id === packId);
    if (packIndex === -1) return;

    for (let i = 0; i < times; i++) {
      const pack = this.gatchaPacks[packIndex];
      pack.rewards = pack.rewards.map((reward: IGatchaReward) => {
        let pool: { image: string }[] = [];
        if (reward.type === "character") {
          pool = this.characterMap[reward.rarity] || [];
        } else if (reward.type === "rune") {
          pool = this.runeMap[reward.rarity] || [];
        }
        const preview = this.getRandomImages(pool, 2);
        return { ...reward, previewImages: preview };
      });

      // Replace biar Angular rerender
      this.gatchaPacks[packIndex] = { ...pack };

      // jeda sebentar (contoh 100ms)
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  async buyAndMintPack(packId: string, token: any) {
    if (!this.activeWallet) {
      alert("⚠️ Please login with wallet first");
      return;
    }

    const packIndex = this.gatchaPacks.findIndex(p => p._id === packId);
    if (packIndex === -1) return;

    this.gatchaPacks[packIndex].finalImage = null;
    this.gatchaPacks[packIndex].isShuffling = true;

    console.log(`Gatcha Pack ${packId} in 30 times and 100ms delay`);
    await this.shufflePackRewards(packId, 30, 100);
    this.gatchaPacks[packIndex].isShuffling = false;

    try {
      const resp: any = await this.http.post(
        `${environment.apiUrl}/gatcha/${packId}/pull`,
        {
          user: this.activeWallet,
          paymentMint: token.mint,
        },
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      ).toPromise();

      this.mintResult = resp;
      this.txSig = resp.signature;

      this.gatchaPacks[packIndex] = {
        ...this.gatchaPacks[packIndex],
        finalImage: resp.nft.image,
      };

      const toast = await this.toastCtrl.create({
        message: `Mint success! NFT: ${resp.nft.name}`,
        duration: 4000,
        color: "success",
        position: "top",
      });
      toast.present();
      this.resetSendModal();
      await this.loadTokens();

    } catch (err: any) {
      console.error("❌ Error minting gatcha:", err);
      const toast = await this.toastCtrl.create({
        message: err.error?.error || "Mint failed",
        duration: 4000,
        color: "danger",
        position: "top",
      });
      toast.present();
      this.resetSendModal();
      await this.loadTokens();
    }
  }

  // === Fetch Coingecko Rates ===
  async fetchRates() {
    try {
      const resp: any = await this.http
        .get("https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd")
        .toPromise();

      const solToUsd = resp["solana"].usd;      // contoh: 187.25 USD per SOL
      const usdcToUsd = resp["usd-coin"].usd;   // contoh: 1.00 USD per USDC

      this.solToUsdcRate = solToUsd / usdcToUsd;   // 1 SOL = ? USDC
      this.usdcToSolRate = 1 / this.solToUsdcRate; // 1 USDC = ? SOL

      console.log("💱 [fetchRates] Rates updated:");
      console.log(`   • 1 SOL  = ${this.solToUsdcRate.toFixed(4)} USDC`);
      console.log(`   • 1 USDC = ${this.usdcToSolRate.toFixed(6)} SOL`);
    } catch (err) {
      console.error("❌ Failed to fetch Coingecko rates", err);
    }
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
    if (!solToken || !uogToken || !this.packPriceSOL) return null;

    const solUsd = solToken.priceUsd || 0;
    const uogUsd = uogToken.priceUsd || 0;

    const solFee = this.packPriceSOL * 0.1;
    const feeUsd = solFee * solUsd;
    const feeUog = uogUsd > 0 ? feeUsd / uogUsd : 0;

    return { solFee, feeInUSD: feeUsd, feeInUOG: feeUog };
  }

  // === Get Price Display (pakai rates di atas) ===
  getPriceDisplay(token: any) {
    if (!token || !this.selectedPack) return { amount: 0, usd: 0 };

    const activePack = this.selectedPack;
    const solToken = this.tokens.find(t => t.symbol === "SOL");
    const solUsd = solToken?.priceUsd || 0;
    const targetUsd = token.priceUsd || 0;

    // harga pack dalam USD (berdasarkan SOL)
    const packUsd = activePack.priceSOL * solUsd;

    // jika token = SOL → langsung
    if (token.symbol === "SOL") {
      return {
        amount: activePack.priceSOL,
        usd: packUsd,
      };
    }

    // jika token lain → konversi ke denominasi token itu
    const amount = targetUsd > 0 ? packUsd / targetUsd : 0;

    return {
      amount,
      usd: packUsd,
    };
  }

}
