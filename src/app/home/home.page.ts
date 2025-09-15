import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { environment } from '../../environments/environment';
import { Transaction } from '@solana/web3.js';
import { Idl } from '../services/idl';
import { NftService } from '../services/nft.service';

import { ToastController } from '@ionic/angular'; // untuk notif ===add by fpp 05/09/25===

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  program: any;

  userAddress: string | null = null;
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
  selectedCharacter: string | null = null; // ===add by fpp 05/09/25===

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

  gatchaPacks: any[] = [];
  mintResult: any = null;

  gatchaForm: any = {
    packId: '',
  };

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private idlService: Idl,
    private toastCtrl: ToastController,   // untuk notif ===add by fpp 05/09/25===
    private nftService: NftService
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
      this.userAddress = saved;
      this.updateBalance();
    }

    await this.loadNft();
    await this.loadCharacters();   // load data karakter ===add by fpp 05/09/25===
    await this.loadGatchaPacks();
  }

  async connectWallet() {
    try {
      const resp = await (window as any).solana.connect();
      this.userAddress = resp.publicKey.toString();

      if (this.userAddress) {
        localStorage.setItem('walletAddress', this.userAddress);

        // ✅ update ke formData
        this.formData.owner = this.userAddress;
      }

      await this.updateBalance();
    } catch (err) {
      console.error('Wallet connect error', err);
    }
  }

  disconnectWallet() {
    localStorage.removeItem('walletAddress');
    this.userAddress = null;
    this.balance = null;
  }

  async updateBalance() {
    if (!this.userAddress) return;
    try {
      const connection = new Connection(environment.rpcUrl, 'confirmed');
      const pubkey = new PublicKey(this.userAddress);
      const lamports = await connection.getBalance(pubkey);
      this.balance = lamports / LAMPORTS_PER_SOL;
    } catch (err) {
      console.error('Error fetch balance', err);
    }
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
      const data: any = await this.http.get(`${environment.apiUrl}/nft/fetch-character`).toPromise();
      this.characters = data;
      console.log("Characters:", this.characters);
    } catch (err) {
      console.error("Error loading characters:", err);
    }
  }
  // =========================

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

  async loadGatchaPacks() {
    try {
      const data: any = await this.http.get(`${environment.apiUrl}/gatcha`).toPromise();
      this.gatchaPacks = data;
    } catch (err) {
      console.error("❌ Error loading gatcha packs:", err);
    }
  }

  async buyAndMint() {
    if (!this.userAddress) {
      alert("⚠️ Please login with wallet first");
      return;
    }

    try {
      const resp: any = await this.http.post(
        `${environment.apiUrl}/gatcha/${this.gatchaForm.packId}/pull`,
        { user: this.userAddress }
      ).toPromise();

      console.log("🎲 Gatcha Mint Response:", resp);
      this.mintResult = resp;

      const toast = await this.toastCtrl.create({
        message: `Mint success! NFT: ${resp.nft.name}`,
        duration: 4000,
        color: "success",
        position: "top"
      });
      toast.present();

    } catch (err) {
      console.error("❌ Error minting gatcha:", err);
      const toast = await this.toastCtrl.create({
        message: "Failed to mint gatcha!",
        duration: 4000,
        color: "danger",
        position: "top"
      });
      toast.present();
    }
  }
}