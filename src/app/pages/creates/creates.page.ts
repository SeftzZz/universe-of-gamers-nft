import { Capacitor } from '@capacitor/core';
import { Component, OnInit, ViewChild } from '@angular/core';
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
import { IonContent } from '@ionic/angular';
import { GatchaService } from '../../services/gatcha';
import { WebSocket } from '../../services/websocket';
const web3 = require('@solana/web3.js');
const { Transaction } = require("@solana/web3.js");

import { Phantom } from '../../services/phantom';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { NgZone } from "@angular/core";
/**
 * Helper log universal — tampil di console browser dan Android Logcat
 */
function nativeLog(tag: string, data: any) {
  const time = new Date().toISOString();
  const msg = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const prefix = Capacitor.isNativePlatform() ? '🟩' : '🟢';
  console.log(`${prefix} [${tag}] ${time} → ${msg}`);
}

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
  usdcToSolRate: number = 0;
  solToUsdcRate: number = 0;  // 1 SOL = ? USDC
  listedPrice: number = 0;
  listedSymbol: string = "SOL";
  packPriceSOL: number = 0;

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

  @ViewChild(IonContent, { static: false }) ionContent!: IonContent;
  scrollIsActive = false;

  tournamentData = {
    name: "",
    description: "",
    image: "",
    priceUOG: 0,
    priceSOL: 0,
    maxParticipants: 8,
    minLevel: 1,
    startDate: "",
    endDate: "",
    totalRewardUOG: 0,
    rewardBreakdown: "",
  };

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private idlService: Idl,
    private toastCtrl: ToastController,   // untuk notif ===add by fpp 05/09/25===
    private nftService: NftService,
    private auth: Auth,   //inject Auth service
    private router: Router,
    private phantom: Phantom,
    private gatchaService: GatchaService,
    private ngZone: NgZone
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
    await this.loadCharacters();   // load data karakter ===add by fpp 05/09/25===
    await this.loadRunes();
    await this.loadGatchaPacks();
    await this.fetchRates();
    this.setLatestNfts();

    this.gatchaService.gatchaResult$.subscribe(nft => {
      if (!nft) return;
      this.ngZone.run(() => {
        const packId = localStorage.getItem("pendingPackId");
        const packIndex = this.gatchaPacks.findIndex(p => p._id === packId);

        if (packIndex !== -1) {
          this.gatchaPacks[packIndex].finalImage = nft.image;
          nativeLog("🖼️ FINAL_IMAGE_UPDATED", {
            packId,
            finalImage: nft.image,
          });
        }
      });
    });

    // 🪄 Fallback: jika event dikirim sebelum halaman aktif
    const cached = localStorage.getItem("lastMintedNFT");
    if (cached) {
      const nft = JSON.parse(cached);
      localStorage.removeItem("lastMintedNFT");
      const packId = localStorage.getItem("pendingPackId");
      const packIndex = this.gatchaPacks.findIndex(p => p._id === packId);
      if (packIndex !== -1) {
        this.gatchaPacks[packIndex].finalImage = nft.image;
        nativeLog("🖼️ FINAL_IMAGE_RESTORED", { packId, image: nft.image });
      }
    }
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
      this.characterMap = data.reduce((acc: Record<string, any[]>, c: any) => {
        acc[c.rarity] = [...(acc[c.rarity] || []), c];
        return acc;
      }, {});
    } catch (err) {
      console.error("❌ Error loading characters:", err);
    }
  }
  // =========================

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
  async toggleSendModal(pack: any) {
    this.selectedPack = pack;
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

    // 🎲 Animasi shuffle
    this.gatchaPacks[packIndex].finalImage = null;
    this.gatchaPacks[packIndex].isShuffling = true;
    await this.shufflePackRewards(packId, 30, 100);
    this.gatchaPacks[packIndex].isShuffling = false;

    try {
      // 1️⃣ Ambil unsigned transaction dari backend
      const resp: any = await this.http.post(
        `${environment.apiUrl}/gatcha/${packId}/pull`,
        { 
          paymentMint: token.mint,
          activeWallet: this.activeWallet,
        },
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      ).toPromise();

      const txBuffer = Buffer.from(resp.transaction, "base64");

      // 🔍 Deteksi platform
      const platform = Capacitor.getPlatform();
      const isMobile = platform === "android" || platform === "ios";
      const provider = (window as any).solana;

      // ========================================
      // 🖥️ DESKTOP FLOW (Phantom Extension)
      // ========================================
      if (!isMobile && provider?.isPhantom) {
        try {
          await provider.connect();
          const transaction = Transaction.from(txBuffer);

          // Minta tanda tangan Phantom
          const signedTx = await provider.signTransaction(transaction);
          const serialized = signedTx.serialize();
          const base58SignedTx = bs58.encode(serialized); // ✅ Gunakan Base58

          // Kirim ke backend untuk konfirmasi mint
          const confirmResp: any = await this.http.post(
            `${environment.apiUrl}/gatcha/${packId}/confirm`,
            {
              mintAddress: resp.mintAddress,
              signedTx: base58SignedTx
            },
            { headers: { Authorization: `Bearer ${this.authToken}` } }
          ).toPromise();

          nativeLog("GATCHA_CONFIRM_DESKTOP_SUCCESS", confirmResp);

          // 🎉 Notifikasi sukses
          const nft = confirmResp.nft;
          const toast = await this.toastCtrl.create({
            message: `🎉 Mint success! NFT: ${nft?.name || resp.mintAddress}`,
            duration: 4000,
            color: "success",
            position: "top",
          });
          toast.present();

          // Emit event hasil mint
          if (nft) {
            this.gatchaService.gatchaResult$.next(nft);
          }

        } catch (err: any) {
          console.error("❌ Phantom desktop mint error:", err);
          const toast = await this.toastCtrl.create({
            message: "❌ Failed to sign or confirm transaction via Phantom Extension.",
            duration: 4000,
            color: "danger",
            position: "top"
          });
          toast.present();
        }
        return; // ✅ Desktop selesai
      }

      // ========================================
      // 📱 MOBILE FLOW (Phantom Deeplink)
      // ========================================
      const phantom_pubkey = localStorage.getItem("phantom_pubkey");
      const secretKeyStored = localStorage.getItem("dappSecretKey");
      const session = localStorage.getItem("phantomSession");

      if (!phantom_pubkey || !secretKeyStored || !session) {
        alert("⚠️ Please connect Phantom first before minting.");
        return;
      }

      // 🔐 Enkripsi payload Phantom
      const phantomPubKey = bs58.decode(phantom_pubkey);
      const secretKey = bs58.decode(secretKeyStored);
      const sharedSecret = nacl.box.before(phantomPubKey, secretKey);
      const nonce = nacl.randomBytes(24);
      const nonceB58 = bs58.encode(nonce);

      const txBase58 = bs58.encode(txBuffer);
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

      // Simpan context
      localStorage.setItem("phantomFlow", "gatcha");
      localStorage.setItem("pendingPackId", packId);
      localStorage.setItem("pendingMintAddress", resp.mintAddress);

      nativeLog("PHANTOM_GATCHA_SIGN_URL", relayUrl);

      // Redirect ke Phantom
      if (isMobile) {
        setTimeout(() => (window.location.href = relayUrl), 500);
      } else {
        window.open(baseUrl, "_blank");
      }

    } catch (err: any) {
      console.error("❌ Error minting gatcha:", err);
      const toast = await this.toastCtrl.create({
        message: err.error?.error || "Failed to build mint transaction",
        duration: 4000,
        color: "danger",
        position: "top",
      });
      toast.present();
    }
  }

  async submitTournament() {
    try {
      const resp = await this.http.post(
        `${environment.apiUrl}/tournament/create-pack`,
        this.tournamentData
      ).toPromise();

      const toast = await this.toastCtrl.create({
        message: "Tournament Pack Successfully Created!",
        duration: 5000,
        color: "success",
        position: "top",
      });
      toast.present();
    } catch (err) {
      console.error(err);
      const toast = await this.toastCtrl.create({
        message: "Failed to Create Tournament Pack!",
        duration: 5000,
        color: "danger",
        position: "top",
      });
      toast.present();
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

  // async buyAndMintPack(packId: string, token: any) {
  //   if (!this.activeWallet) {
  //     alert("⚠️ Please login with wallet first");
  //     return;
  //   }

  //   const packIndex = this.gatchaPacks.findIndex(p => p._id === packId);
  //   if (packIndex === -1) return;

  //   this.gatchaPacks[packIndex].finalImage = null;
  //   this.gatchaPacks[packIndex].isShuffling = true;
  //   await this.shufflePackRewards(packId, 30, 100);
  //   this.gatchaPacks[packIndex].isShuffling = false;

  //   try {
  //     const resp: any = await this.http.post(
  //       `${environment.apiUrl}/gatcha/${packId}/pull`,
  //       {
  //         user: this.activeWallet,
  //         paymentMint: token.mint,   // 👈 kirim mint token yang dipilih (SOL/UOG)
  //       },
  //       { headers: { Authorization: `Bearer ${this.authToken}` } }
  //     ).toPromise();

  //     this.mintResult = resp;
  //     this.txSig = resp.signature;

  //     this.gatchaPacks[packIndex] = {
  //       ...this.gatchaPacks[packIndex],
  //       finalImage: resp.nft.image,
  //     };

  //     const toast = await this.toastCtrl.create({
  //       message: `Mint success! NFT: ${resp.nft.name}`,
  //       duration: 4000,
  //       color: "success",
  //       position: "top",
  //     });
  //     toast.present();
  //     await this.loadTokens();
  //   } catch (err: any) {
  //     console.error("❌ Error minting gatcha:", err);
  //     const toast = await this.toastCtrl.create({
  //       message: err.error?.error || "Mint failed",
  //       duration: 4000,
  //       color: "danger",
  //       position: "top",
  //     });
  //     toast.present();
  //     await this.loadTokens();
  //   } 
  // }
}