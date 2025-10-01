import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Idl } from '../../services/idl';
import { NftService } from '../../services/nft.service';
import { firstValueFrom } from 'rxjs';
import { ToastController } from '@ionic/angular'; // untuk notif ===add by fpp 05/09/25===
import { Auth } from '../../services/auth';
import { MarketLayoutPage } from '../market-layout/market-layout.page';
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
  selector: 'app-creates',
  templateUrl: 'creates.page.html',
  styleUrls: ['creates.page.scss'],
  standalone: false,
})
export class CreatesPage implements OnInit {
  program: any;
  authToken: string | null = null;

  userAddress: string | null = null;
  activeWallet: string = '';
  balance: number | null = null;
  uploadForm!: FormGroup;
  blockchainSelected: string | null = null;

  formData: any = {
    name: '',
    description: '',
    image: '',
    price: 0,
    royalty: 0,
    character: '',
    owner: ''
  };
  selectedFile: File | null = null;

  nft: any[] = []; // daftar NFT dari backend
  characters: any[] = [];   // daftar karakter dari backend ===add by fpp 05/09/25===
  runes: any[] = [];   // daftar rune dari backend
  selectedCharacter: string | null = null; // ===add by fpp 05/09/25===
  latestNfts: any[] = [];

  charData: any = {
    name: "",
    description: "",
    image: "",
    element: "Fire",
    rarity: "Common",

    baseHp: 0,
    baseAtk: 0,
    baseDef: 0,
    baseSpd: 0,
    baseCritRate: 0,
    baseCritDmg: 0,

    basicAttack: { name: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" },
    skillAttack: { name: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" },
    ultimateAttack: { name: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" }
  };

  runeDefault = {
    name: "",
    image: "",
    rarity: "Common",
    hpBonus: 0,
    atkBonus: 0,
    defBonus: 0,
    spdBonus: 0,
    critRateBonus: 0,
    critDmgBonus: 0,
    description: ""
  };

  runeList: any[] = [];

  // === Gatcha Pack ===
  gatchaData: any = {
    name: "",
    description: "",
    priceUOG: 0,
    priceSOL: 0,
  };
  gatchaRewards: any[] = [
    { type: "character", rarity: "Common", chance: 50 },
    { type: "rune", rarity: "Rare", chance: 50 }
  ];
  uogToSolRate: number = 0; // rate 1 UOG → SOL
  solToUogRate: number = 0; // rate 1 SOL → UOG

  gatchaForm: any = {
    packId: '',
  };

  characterMap: Record<string, any[]> = {};
  runeMap: Record<string, any[]> = {};

  nfts: any[] = [];
  nftMap: Record<string, any[]> = {};

  private shuffleArray<T>(array: T[]): T[] {
    return array
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
  }

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

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private idlService: Idl,
    private toastCtrl: ToastController,   // untuk notif ===add by fpp 05/09/25===
    private nftService: NftService,
    private auth: Auth,   //inject Auth service
    private router: Router
  ) {}

  async ngOnInit() {
    this.program = await this.idlService.loadProgram();
    // sekarang this.program bisa dipakai untuk call mintAndList, buyNft, dll.

    this.uploadForm = this.fb.group({
      name: ['', Validators.required],
      symbol: ['', Validators.required],
      uri: ['', Validators.required],
      description: ['', Validators.required],
      price: ['', Validators.required],
      properties: ['', Validators.required],
      size: ['', Validators.required],
      collection: ['', Validators.required],
      royalty: ['', Validators.required],
    });

    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      this.activeWallet = saved;
      await this.loadTokens();
    }

    await this.loadNft();
    // await this.loadCharacters();   // load data karakter ===add by fpp 05/09/25===
    // await this.loadRunes();
    await this.loadGatchaPacks();
    await this.fetchRates();
    await this.onChainAll();
    this.setLatestNfts();
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

  disconnectWallet() {
    localStorage.removeItem('walletAddress');
    this.userAddress = null;
    this.balance = null;
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  // --- Upload Logic ---
  onFileChange(event: any) {
    this.selectedFile = event.target.files[0] || null;
  }

  selectBlockchain(chain: string) {
    console.log('chain selected', chain);
    this.formData.blockchain = chain;
  }

  preview() {
    const data = {
      ...this.formData,
      file: this.selectedFile?.name || 'No file'
    };
    console.log('🔎 Preview Data:', data);
    alert('Preview:\n' + JSON.stringify(data, null, 2));
  }

  async loadNft() {
    try {
      const data: any = await this.http.get(`${environment.apiUrl}/nft/fetch-nft`).toPromise();
      this.nft = data;
      console.log('📦 NFT List:', this.nft);
    } catch (err) {
      console.error('❌ Error loading NFT:', err);
    }
  }

  // ===add by fpp 05/09/25===
  async loadCharacters() {
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/fetch-character`)
      );
      this.characters = data;
      console.log("Characters:", this.characters);

      this.characterMap = data.reduce((acc: Record<string, any[]>, c: any) => {
        acc[c.rarity] = [...(acc[c.rarity] || []), c];
        return acc;
      }, {} as Record<string, any[]>);
    } catch (err) {
      console.error("❌ Error loading characters:", err);
      this.characters = [];
      this.characterMap = {};
    }
  }
  // =========================

  async loadRunes() {
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/rune`)
      );
      this.runes = data;
      // console.log("Runes:", this.runes);

      this.runeMap = data.reduce((acc: Record<string, any[]>, r: any) => {
        acc[r.rarity] = [...(acc[r.rarity] || []), r];
        return acc;
      }, {} as Record<string, any[]>);
    } catch (err) {
      console.error("❌ Error loading runes:", err);
      this.runes = [];
      this.runeMap = {};
    }
  }

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

          // 🔥 ambil acak maksimal 2 gambar
          const preview = this.getRandomImages(pool, 2);

          return { ...reward, previewImages: preview };
        });
        return { ...pack, rewards: rewardsWithPreview };
      });

      console.log("🎲 Loaded gatcha packs with previews:", this.gatchaPacks);
    } catch (err) {
      console.error("❌ Error loading gatcha packs:", err);
      this.gatchaPacks = [];
    }
  }

  getRewardImages(reward: any): string[] {
    return reward.previewImages || ["fallback.png"];
  }

  private getRandomImages(pool: { image: string }[], max: number): string[] {
    const result: string[] = [];
    const copy = [...pool];

    while (result.length < max && copy.length > 0) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy[idx].image);
      copy.splice(idx, 1); // hapus supaya tidak dobel
    }

    return result;
  }

  // ===add by fpp 05/09/25===
  resetFormCreateCharacter() {
    this.charData = {
      name: "",
      description: "",
      image: "",
      element: "Fire",
      rarity: "Common",

      baseHp: 0,
      baseAtk: 0,
      baseDef: 0,
      baseSpd: 0,
      baseCritRate: 0,
      baseCritDmg: 0,

      basicAttack: { name: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" },
      skillAttack: { name: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" },
      ultimateAttack: { name: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" }
    };
  }
  // ==========================

  resetFormCreateNft() {
    this.formData = {
      name: '',
      description: '',
      image: '',
      price: 0,
      royalty: 0,
      attributes: [],
      character: '',
      owner: ''
    };
  }

  resetFormCreateRune() {
    this.runeDefault = {
      name: "",
      image: "",
      rarity: "Common",
      hpBonus: 0,
      atkBonus: 0,
      defBonus: 0,
      spdBonus: 0,
      critRateBonus: 0,
      critDmgBonus: 0,
      description: ""
    };
    this.runeList = [];
  }

  resetFormCreateGatcha() {
    this.gatchaData = {
      name: "",
      description: "",
      priceUOG: 0,
      priceSOL: 0,
    };
    this.gatchaRewards = [];
  }

  addRune() {
    this.runeList.push({
      name: "",
      image: "",
      hpBonus: 0,
      atkBonus: 0,
      defBonus: 0,
      spdBonus: 0,
      critRateBonus: 0,
      critDmgBonus: 0,
      description: ""
    });
  }

  addReward() {
    this.gatchaRewards.push({
      type: "character",
      rarity: "Common",
      chance: 0,
    });
  }

  async submitNft() {
    if (!this.userAddress) {
      alert('Please connect wallet first');
      return;
    }

    this.formData.owner = this.userAddress;

    try {
      // === 1. Mint NFT (web3 tx)
      // const sig = await this.nftService.makeTransaction(this.userAddress, this.formData);
      const sig = "txSignature";

      // === 2. Simpan ke MongoDB
      const saveResp = await this.nftService.saveNft({
        ...this.formData,
        owner: this.userAddress,
        txSignature: sig
      });

      console.log('✅ NFT saved:', saveResp);

      const toast = await this.toastCtrl.create({
          message: "NFT Successfully Created!",
          duration: 5000,
          color: "success",
          position: "top"
        });
        toast.present();

      // === 3. Reset form ===
      this.resetFormCreateNft();
    } catch (err) {
      console.error('❌ Submit error', err);
      if (err instanceof Error) {
        alert('❌ Error: ' + err.message);
      } else {
        alert('❌ Error: ' + JSON.stringify(err));
      }
    }
  }

  submitCharacter() {
    console.log("Submitting character:", this.charData);

    this.http.post(`${environment.apiUrl}/nft/character`, this.charData).subscribe({
      next: async (res) => {
        console.log("✅ Character saved", res);

        const toast = await this.toastCtrl.create({
          message: "Character Successfully Created!",
          duration: 5000,
          color: "success",
          position: "top"
        });
        toast.present();

        this.resetFormCreateCharacter();
      },
      error: async (err) => {
        console.error("❌ Error saving character", err);

        const toast = await this.toastCtrl.create({
          message: "Failed to Create a Character!",
          duration: 5000,
          color: "danger",
          position: "top"
        });
        toast.present();
      }
    });
  }

  submitRune() {
    const allRunes = [this.runeDefault, ...this.runeList];
    console.log("Submitting Runes:", allRunes);

    this.http.post(`${environment.apiUrl}/nft/rune`, allRunes).subscribe({
      next: async (res) => {
        console.log("✅ Runes saved", res);

        const toast = await this.toastCtrl.create({
          message: "Rune Successfully Created!",
          duration: 5000,
          color: "success",
          position: "top"
        });
        toast.present();

        this.resetFormCreateRune();
      },
      error: async (err) => {
        console.error("❌ Error saving runes", err);

        const toast = await this.toastCtrl.create({
          message: "Failed to Create a Rune!",
          duration: 5000,
          color: "danger",
          position: "top"
        });
        toast.present();
      }
    });
  }

  submitGatcha() {
    const payload = {
      ...this.gatchaData,
      rewards: this.gatchaRewards,
    };

    console.log("Submitting Gatcha Pack:", payload);

    this.http.post(`${environment.apiUrl}/gatcha`, payload).subscribe({
      next: async (res) => {
        console.log("✅ Gatcha Pack saved", res);

        const toast = await this.toastCtrl.create({
          message: "Gatcha Pack Successfully Created!",
          duration: 5000,
          color: "success",
          position: "top",
        });
        toast.present();

        this.resetFormCreateGatcha();
      },
      error: async (err) => {
        console.error("❌ Error saving gatcha pack", err);

        const toast = await this.toastCtrl.create({
          message: "Failed to Create Gatcha Pack!",
          duration: 5000,
          color: "danger",
          position: "top",
        });
        toast.present();
      },
    });
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

  async fetchRates() {
    try {
      const resp: any = await this.http
        .get("https://api.coingecko.com/api/v3/simple/price?ids=universe-of-gamers&vs_currencies=sol")
        .toPromise();

      this.uogToSolRate = resp["universe-of-gamers"].sol; // 1 UOG = X SOL
      this.solToUogRate = 1 / this.uogToSolRate;          // 1 SOL = Y UOG
      console.log("✅ Rates loaded:", this.uogToSolRate, "SOL per UOG");
    } catch (err) {
      console.error("❌ Failed to fetch Coingecko rates", err);
    }
  }

  // Dipanggil waktu user ubah priceUOG
  onPriceUOGChange() {
    if (this.uogToSolRate > 0) {
      this.gatchaData.priceSOL = this.gatchaData.priceUOG * this.uogToSolRate;
    }
  }

  // Dipanggil waktu user ubah priceSOL
  onPriceSOLChange() {
    if (this.solToUogRate > 0) {
      this.gatchaData.priceUOG = this.gatchaData.priceSOL * this.solToUogRate;
    }
  }

  async onChainAll() {
    try {
      const resp = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/onchain`)
      );

      this.nfts = resp || [];
      console.log("NFTs:", this.nfts);

      this.nftMap = this.nfts.reduce(
        (acc: Record<string, any[]>, nft: any) => {
          const rarity = nft?.rarity || nft?.metadata?.attributes?.find((a: any) => a.trait_type === "Rarity")?.value || "Unknown";
          acc[rarity] = [...(acc[rarity] || []), nft];
          return acc;
        },
        {} as Record<string, any[]>
      );
    } catch (err) {
      console.error("❌ Error loading NFTs:", err);
      this.nfts = [];
      this.nftMap = {};
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

    const result = `$${intPart}.0${zeroCountStr}${rest}`;

    console.log(`formatWithZeroCount(${num}) => ${result}`);
    return result;
  }

  goToNftDetail(mintAddress: string) {
    if (!mintAddress) return;
    console.log("Navigating to NFT detail:", mintAddress);
    this.router.navigate(['/nft-detail', mintAddress]);
  }

  setLatestNfts() {
    // gabungkan semua NFT dari Character & Rune
    const allNft = [...this.nft, ...this.runes];

    if (allNft.length > 0) {
      // urutkan dari terbaru
      this.latestNfts = allNft
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4); // ambil 4 terbaru
    }
  }

  logout() {
    this.auth.logout();
  }
}