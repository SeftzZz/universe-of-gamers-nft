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
    } catch (err) {
      console.error('Error fetch tokens from API', err);
      this.router.navigateByUrl('/tabs/offline');
    }
  }

  get filteredTokens() {
    if (!this.tokenSearch) return this.tokens;
    return this.tokens.filter(t =>
      (t.symbol?.toLowerCase().includes(this.tokenSearch.toLowerCase()) ||
       t.name?.toLowerCase().includes(this.tokenSearch.toLowerCase()))
    );
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
  toggleSendModal(pack: any) {
    this.selectedPack = pack;
    this.showSendModal = true;
    this.isClosingSend = false;
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
    await this.shufflePackRewards(packId, 30, 100);
    this.gatchaPacks[packIndex].isShuffling = false;

    try {
      const resp: any = await this.http.post(
        `${environment.apiUrl}/gatcha/${packId}/pull`,
        {
          user: this.activeWallet,
          paymentMint: token.mint,   // 👈 kirim mint token yang dipilih (SOL/UOG)
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

    } catch (err: any) {
      console.error("❌ Error minting gatcha:", err);
      const toast = await this.toastCtrl.create({
        message: err.error?.error || "Mint failed",
        duration: 4000,
        color: "danger",
        position: "top",
      });
      toast.present();
    } finally {
      this.resetSendModal();
    }
  }
}
